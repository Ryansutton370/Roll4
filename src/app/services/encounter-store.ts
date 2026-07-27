import { Service, effect, inject, signal } from '@angular/core';
import {
  Unsubscribe,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { firestore } from '../firebase';
import { Combatant, CombatantType, Encounter, Timer } from '../models/encounter.model';
import { InitiativeAdvantageState } from '../models/initiative-advantage.model';
import { AuthService } from './auth-service';
import { NpcStore } from './npc-store';
import { PartyStore } from './party-store';

/** Keeps Current HP within [0, maxHp] — null maxHp means "not tracked", so there's nothing to clamp. */
function clampCurrentHp(currentHp: number, maxHp: number | null): number | null {
  if (maxHp === null) return null;
  return Math.min(Math.max(currentHp, 0), maxHp);
}

function rollD20(): number {
  return Math.floor(Math.random() * 20) + 1;
}

/**
 * Advantage/Disadvantage: roll twice and keep the higher/lower result
 * instead of a single roll. Exported alongside compareByInitiative/
 * reRollRound below for direct unit testing.
 */
export function rollD20WithAdvantage(state: InitiativeAdvantageState): number {
  if (state === 'none') return rollD20();
  const a = rollD20();
  const b = rollD20();
  return state === 'advantage' ? Math.max(a, b) : Math.min(a, b);
}

function rollInitiativeFor(combatant: Combatant): Combatant {
  const lastRoll = rollD20WithAdvantage(combatant.initiativeAdvantage);
  return { ...combatant, lastRoll, initiativeTotal: lastRoll + combatant.initiativeModifier };
}

/**
 * Ties are broken by highest Initiative Modifier, then — if still tied —
 * a random coin flip (see docs/PRODUCT.md open decisions). A null total
 * (Removed from Combat, i.e. "N/A") counts as 0, which is what sinks a
 * removed combatant toward the bottom of the order.
 *
 * Exported (along with reRollRound/firstActiveIndex below) so it can be unit
 * tested directly as plain logic, without going through the service/DI/
 * localStorage machinery — see docs/ARCHITECTURE.md's testing approach.
 */
export function compareByInitiative(a: Combatant, b: Combatant): number {
  const totalDiff = (b.initiativeTotal ?? 0) - (a.initiativeTotal ?? 0);
  if (totalDiff !== 0) return totalDiff;
  const modifierDiff = b.initiativeModifier - a.initiativeModifier;
  if (modifierDiff !== 0) return modifierDiff;
  return Math.random() < 0.5 ? -1 : 1;
}

/**
 * Same ordering as compareByInitiative, but without the coin-flip tie-break.
 * Used when re-inserting a single combatant (un-removing, holding) into an
 * otherwise-unchanged order — a random tie-break here would reshuffle
 * unrelated, already-tied combatants every time a checkbox is toggled, which
 * would be a confusing side effect for the GM.
 */
function compareStable(a: Combatant, b: Combatant): number {
  const totalDiff = (b.initiativeTotal ?? 0) - (a.initiativeTotal ?? 0);
  if (totalDiff !== 0) return totalDiff;
  return b.initiativeModifier - a.initiativeModifier;
}

/** Removes `moved` from `order` (by id) and reinserts it at its sorted position. */
function insertBySortedPosition(order: Combatant[], moved: Combatant): Combatant[] {
  const rest = order.filter((c) => c.id !== moved.id);
  const index = rest.findIndex((c) => compareStable(moved, c) < 0);
  if (index === -1) return [...rest, moved];
  return [...rest.slice(0, index), moved, ...rest.slice(index)];
}

/**
 * Keeps every on-hold combatant's displayed initiative equal to the Active
 * combatant's total — they live in the separate secondary Hold Action list
 * (ordered by Encounter.holdOrder, not by this total), so this is purely
 * cosmetic: "on deck, following the Active highlight." Called after
 * anything that can change who's Active (or the Active combatant's total).
 */
function syncHoldPositions(order: Combatant[], activeId: string | null): Combatant[] {
  const activeTotal = order.find((c) => c.id === activeId)?.initiativeTotal ?? 0;
  return order.reduce((acc, c) => {
    if (!c.onHold || c.id === activeId) return acc;
    if (c.initiativeTotal === activeTotal) return acc;
    return insertBySortedPosition(acc, { ...c, initiativeTotal: activeTotal });
  }, order);
}

/**
 * Rerolls every combatant except Removed (N/A, no roll to make). On-hold
 * combatants are also cleared here — a new round always empties the Hold
 * Action list, and when reRollEachRound is true that means a fresh roll
 * like everyone else, discarding the pre-hold snapshot. Ready to Join
 * combatants are folded in the same way — they're already sitting in
 * combatantIds, so clearing the flag before rolling is all that's needed
 * to fold them in alongside everyone else's fresh roll.
 */
export function reRollRound(order: Combatant[]): Combatant[] {
  const rerolled = order.map((c) => {
    if (c.removedFromCombat) return { ...c, lastRoll: null, initiativeTotal: null };
    const base = c.onHold
      ? { ...c, onHold: false, preHoldLastRoll: null, preHoldInitiativeTotal: null }
      : c;
    const ready = base.readyToJoin ? { ...base, readyToJoin: false } : base;
    return rollInitiativeFor(ready);
  });
  return [...rerolled].sort(compareByInitiative);
}

/**
 * Called at a round boundary when reRollEachRound is false: returns every
 * on-hold combatant to the main order with the initiative they had before
 * Hold Action was toggled on (Combatant.preHold*), rather than the
 * "pinned to Active" value syncHoldPositions had been displaying. A no-op
 * (same array reference) when nobody is on hold, so it never disturbs the
 * "existing order left alone" guarantee documented for this mode.
 */
export function clearHoldWithoutReroll(order: Combatant[]): Combatant[] {
  const heldIds = order.filter((c) => c.onHold).map((c) => c.id);
  if (heldIds.length === 0) return order;
  const restored = order.map((c) =>
    c.onHold
      ? {
          ...c,
          onHold: false,
          lastRoll: c.preHoldLastRoll,
          initiativeTotal: c.preHoldInitiativeTotal,
          preHoldLastRoll: null,
          preHoldInitiativeTotal: null,
        }
      : c,
  );
  return heldIds.reduce(
    (acc, id) =>
      insertBySortedPosition(
        acc,
        acc.find((c) => c.id === id)!,
      ),
    restored,
  );
}

/**
 * Called at a round boundary when reRollEachRound is false: the Classic-
 * mode counterpart to clearHoldWithoutReroll above, for Ready to Join
 * combatants instead of Hold Action ones. Unlike a held combatant, a
 * ready-to-join combatant has no prior roll to restore — there's no
 * preHold-style snapshot, since they were never in the turn order to
 * begin with — so each gets a fresh, uncapped roll (like joining combat
 * for the first time) instead. A no-op (same array reference) when nobody
 * is Ready to Join.
 */
export function foldInReadyToJoin(order: Combatant[]): Combatant[] {
  const pendingIds = order.filter((c) => c.readyToJoin).map((c) => c.id);
  if (pendingIds.length === 0) return order;
  const rolled = order.map((c) =>
    c.readyToJoin ? rollInitiativeFor({ ...c, readyToJoin: false }) : c,
  );
  return pendingIds.reduce(
    (acc, id) =>
      insertBySortedPosition(
        acc,
        acc.find((c) => c.id === id)!,
      ),
    rolled,
  );
}

/** The first combatant eligible to act — skips Removed, on-hold, and Ready to Join entries. */
export function firstActiveIndex(order: Combatant[]): number | null {
  const index = order.findIndex((c) => !c.removedFromCombat && !c.onHold && !c.readyToJoin);
  return index === -1 ? null : index;
}

/**
 * "Goblin"/"Goblin"/"goblin" (grouped case-insensitively, trimmed) become
 * "Goblin A"/"Goblin B"/"Goblin C" — letters assigned in the order they
 * appear in `combatantsInCreationOrder`, so the caller must pass creation
 * order (EncounterStore.combatantsForEncounterInCreationOrder), not
 * initiative order (combatantsForEncounter). Initiative order re-sorts on
 * every re-roll/manual-reorder/hold-return, which would relabel "A"/"B"
 * far more often than intended — creation order only changes when a
 * combatant is actually added or removed. A name with no duplicates is
 * returned unsuffixed. Exported and kept pure (no store/DI) for the same
 * standalone-testability reason as compareByInitiative above.
 */
export function computeDisplayNames(combatantsInCreationOrder: Combatant[]): Map<string, string> {
  const groups = new Map<string, Combatant[]>();
  for (const c of combatantsInCreationOrder) {
    const key = c.name.trim().toLowerCase();
    const group = groups.get(key);
    if (group) {
      group.push(c);
    } else {
      groups.set(key, [c]);
    }
  }

  const displayNames = new Map<string, string>();
  for (const group of groups.values()) {
    if (group.length === 1) {
      displayNames.set(group[0].id, group[0].name);
      continue;
    }
    group.forEach((c, index) => {
      displayNames.set(c.id, `${c.name.trim()} ${String.fromCharCode(65 + index)}`);
    });
  }
  return displayNames;
}

@Service()
export class EncounterStore {
  private readonly encountersSignal = signal<Encounter[]>([]);
  private readonly combatantsSignal = signal<Combatant[]>([]);
  private readonly timersSignal = signal<Timer[]>([]);

  readonly encounters = this.encountersSignal.asReadonly();
  readonly combatants = this.combatantsSignal.asReadonly();
  readonly timers = this.timersSignal.asReadonly();

  // inject(): fetches a dependency from Angular's DI container. It must be
  // called during class field initialization (an "injection context"),
  // which is why it replaces constructor-parameter injection for @Service
  // classes rather than appearing inside a constructor body.
  private readonly authService = inject(AuthService);
  private readonly partyStore = inject(PartyStore);
  private readonly npcStore = inject(NpcStore);

  constructor() {
    let unsubEncounters: Unsubscribe | null = null;
    let unsubCombatants: Unsubscribe | null = null;
    let unsubTimers: Unsubscribe | null = null;

    // Same pattern as PartyStore/NpcStore — see party-store.ts's
    // constructor comment for the full explanation. Three listeners
    // instead of two: EncounterStore owns three entity groups, but each
    // still just loads the signed-in GM's *entire* owned collection (not
    // scoped to any one open Encounter), same as combatantsSignal/
    // timersSignal always have — combatantsForEncounter/timersForEncounter
    // below stay plain client-side filters over that full set.
    effect(() => {
      const uid = this.authService.uid();
      unsubEncounters?.();
      unsubCombatants?.();
      unsubTimers?.();
      this.encountersSignal.set([]);
      this.combatantsSignal.set([]);
      this.timersSignal.set([]);
      if (!uid) return;

      unsubEncounters = onSnapshot(
        query(collection(firestore, 'encounters'), where('ownerId', '==', uid)),
        (snap) => this.encountersSignal.set(snap.docs.map((d) => d.data() as Encounter)),
      );
      unsubCombatants = onSnapshot(
        query(collection(firestore, 'combatants'), where('ownerId', '==', uid)),
        (snap) => this.combatantsSignal.set(snap.docs.map((d) => d.data() as Combatant)),
      );
      unsubTimers = onSnapshot(
        query(collection(firestore, 'timers'), where('ownerId', '==', uid)),
        (snap) => this.timersSignal.set(snap.docs.map((d) => d.data() as Timer)),
      );
    });
  }

  getEncounter(id: string): Encounter | undefined {
    return this.encountersSignal().find((e) => e.id === id);
  }

  /** Combatants for an Encounter, in current initiative order. */
  combatantsForEncounter(encounterId: string): Combatant[] {
    const encounter = this.getEncounter(encounterId);
    if (!encounter) return [];
    const byId = new Map(this.combatantsSignal().map((c) => [c.id, c]));
    return encounter.combatantIds.map((id) => byId.get(id)).filter((c): c is Combatant => !!c);
  }

  /**
   * Combatants for an Encounter in creation/insertion order — deliberately
   * NOT the initiative order combatantsForEncounter above returns (which
   * re-sorts on every re-roll/manual-reorder/hold-return). Filters
   * combatantsSignal directly by encounterId, same "no combatantIds
   * indirection" shape as timersForEncounter below, since combatantsSignal
   * itself is only ever appended to, never reordered — feeds
   * computeDisplayNames, which needs a stable order to letter duplicate
   * names consistently.
   */
  combatantsForEncounterInCreationOrder(encounterId: string): Combatant[] {
    return this.combatantsSignal().filter((c) => c.encounterId === encounterId);
  }

  /** Timers for an Encounter — no ordering guarantee needed, the UI sorts/groups as it sees fit. */
  timersForEncounter(encounterId: string): Timer[] {
    return this.timersSignal().filter((t) => t.encounterId === encounterId);
  }

  // Every method below that used to call combatantsSignal.update()/
  // encountersSignal.update()/timersSignal.update() directly now writes to
  // Firestore instead — the signals themselves are only ever set by the
  // onSnapshot listeners above (see party-store.ts's constructor comment
  // for the fuller "state flows storage -> app now, not app -> storage"
  // explanation). updateEncounter/updateCombatant keep their original
  // names and single-doc-partial-update signature on purpose: every call
  // site below that only ever touched one Encounter or one Combatant doc
  // needed zero changes once these two private helpers were swapped.

  private updateEncounter(id: string, changes: Partial<Encounter>): void {
    updateDoc(doc(firestore, 'encounters', id), changes).catch((err) =>
      console.error('Failed to update encounter', err),
    );
  }

  private updateCombatant(id: string, changes: Partial<Combatant>): void {
    updateDoc(doc(firestore, 'combatants', id), changes).catch((err) =>
      console.error('Failed to update combatant', err),
    );
  }

  /**
   * Commits a freshly-ordered combatant array: writes every (possibly
   * changed) combatant in `order` back to Firestore, saves the new order
   * onto the Encounter, and resolves activeId to its new index — all in
   * one writeBatch, so a page reload never sees the combatants updated
   * without the matching Encounter.combatantIds, or vice versa.
   * Re-resolving activeId by id rather than carrying an index through is
   * what lets syncHoldPositions reorder the list without every caller
   * having to track how indices shifted. `order` is always this
   * Encounter's *entire* combatant list (every caller passes
   * combatantsForEncounter's result, possibly reordered/modified) — a
   * writeBatch comfortably covers that (Firestore allows up to 500 writes
   * per batch; a single Encounter's combatant count is nowhere close).
   */
  private commitOrder(encounterId: string, order: Combatant[], activeId: string | null): void {
    const activeCombatantIndex =
      activeId === null ? null : order.findIndex((c) => c.id === activeId);
    const batch = writeBatch(firestore);
    order.forEach((c) => batch.set(doc(firestore, 'combatants', c.id), c));
    batch.update(doc(firestore, 'encounters', encounterId), {
      combatantIds: order.map((c) => c.id),
      activeCombatantIndex: activeCombatantIndex === -1 ? null : activeCombatantIndex,
    });
    batch.commit().catch((err) => console.error('Failed to commit combatant order', err));
  }

  private requireUid(): string {
    const uid = this.authService.uid();
    if (!uid) throw new Error('EncounterStore method called while signed out');
    return uid;
  }

  /**
   * Builds a fresh Combatant object — the one shape shared by every
   * creation path below (createEncounter's Party/Troop pull-in,
   * setEncounterParties/setEncounterTroops's diffed adds, addPlayerCombatant/
   * addNpcCombatant, addAdHocCombatant). Factored out once readyToJoin
   * needed adding to all of them, rather than repeating this ~20-line
   * literal (and now that field) at every call site.
   */
  private buildCombatant(
    encounterId: string,
    type: CombatantType,
    linkIds: { playerId: string | null; npcId: string | null },
    fields: {
      name: string;
      initiativeModifier: number;
      initiativeAdvantage?: InitiativeAdvantageState;
      ac: number | null;
      maxHp: number | null;
      notes: string;
      monsterTemplateId?: string | null;
      monsterName?: string | null;
    },
    readyToJoin = false,
  ): Combatant {
    return {
      id: crypto.randomUUID(),
      encounterId,
      ownerId: this.requireUid(),
      type,
      playerId: linkIds.playerId,
      npcId: linkIds.npcId,
      name: fields.name,
      initiativeModifier: fields.initiativeModifier,
      initiativeAdvantage: fields.initiativeAdvantage ?? 'none',
      ac: fields.ac,
      maxHp: fields.maxHp,
      currentHp: fields.maxHp,
      tempHp: 0,
      bonusAc: 0,
      notes: fields.notes,
      monsterTemplateId: fields.monsterTemplateId ?? null,
      monsterName: fields.monsterName ?? null,
      lastRoll: null,
      initiativeTotal: null,
      removedFromCombat: false,
      incapacitated: false,
      onHold: false,
      preHoldLastRoll: null,
      preHoldInitiativeTotal: null,
      readyToJoin,
    };
  }

  /** Creates an Encounter and pulls in every Player from the selected Parties, and every Npc from the selected Troops, as Combatants. */
  createEncounter(name: string, partyIds: string[], troopIds: string[] = []): Encounter {
    const ownerId = this.requireUid();
    const encounterId = crypto.randomUUID();
    const newPlayerCombatants: Combatant[] = partyIds.flatMap((partyId) =>
      this.partyStore
        .playersForParty(partyId)
        .map((pc) => this.buildCombatant(encounterId, 'pc', { playerId: pc.id, npcId: null }, pc)),
    );
    const newNpcCombatants: Combatant[] = troopIds.flatMap((troopId) =>
      this.npcStore
        .npcsForTroop(troopId)
        .map((npc) =>
          this.buildCombatant(encounterId, 'npc', { playerId: null, npcId: npc.id }, npc),
        ),
    );
    const newCombatants = [...newPlayerCombatants, ...newNpcCombatants];

    const encounter: Encounter = {
      id: encounterId,
      ownerId,
      name,
      partyIds,
      troopIds,
      combatantIds: newCombatants.map((c) => c.id),
      activeCombatantIndex: null,
      holdOrder: [],
      round: 0,
      reRollEachRound: true,
    };

    const batch = writeBatch(firestore);
    newCombatants.forEach((c) => batch.set(doc(firestore, 'combatants', c.id), c));
    batch.set(doc(firestore, 'encounters', encounterId), encounter);
    batch.commit().catch((err) => console.error('Failed to create encounter', err));

    // Optimistic local update: encountersSignal/combatantsSignal are
    // normally only ever set by the onSnapshot listeners in the
    // constructor, which don't fire until this write round-trips through
    // Firestore. But every real caller (see EncounterList's
    // ensureEncounterCreated) turns around and immediately calls a second
    // EncounterStore method — addPlayerCombatant, setEncounterParties,
    // etc. — that reads getEncounter(encounterId) in that same
    // synchronous tick, long before any round trip could possibly have
    // completed. Without this, that read silently comes back undefined
    // for an Encounter that very much exists, and any method gated on
    // "if (encounter)" (addCombatantAndLinkToEncounter chief among them)
    // quietly no-ops — which is how the first individual combatant added
    // to a brand-new Encounter used to vanish without a trace.
    //
    // Guarded by an existence check (not an unconditional append) because
    // the test double (fake-firestore.ts) notifies onSnapshot listeners
    // *synchronously* inside batch.commit() above — by the time this line
    // runs in a test, the "real" listener may already have set() this
    // exact encounter into the signal, and appending again would
    // duplicate it. Real Firestore's listener only ever catches up
    // *after* this line (never before), so the guard is a no-op there;
    // either way, the eventual onSnapshot echo fully replaces (not
    // merges into) both signals, so there's no risk of this optimistic
    // entry lingering once the authoritative copy arrives.
    if (!this.encountersSignal().some((e) => e.id === encounter.id)) {
      this.encountersSignal.update((list) => [...list, encounter]);
    }
    if (newCombatants.length > 0) {
      const knownIds = new Set(this.combatantsSignal().map((c) => c.id));
      const missing = newCombatants.filter((c) => !knownIds.has(c.id));
      if (missing.length > 0) {
        this.combatantsSignal.update((list) => [...list, ...missing]);
      }
    }

    return encounter;
  }

  /** Doesn't delete this Encounter's Timers — a pre-existing quirk, not introduced by this migration (see the old localStorage-era deleteEncounter, which had the same gap). */
  deleteEncounter(id: string): void {
    const batch = writeBatch(firestore);
    batch.delete(doc(firestore, 'encounters', id));
    this.combatantsSignal()
      .filter((c) => c.encounterId === id)
      .forEach((c) => batch.delete(doc(firestore, 'combatants', c.id)));
    batch.commit().catch((err) => console.error('Failed to delete encounter', err));
  }

  renameEncounter(id: string, name: string): void {
    this.updateEncounter(id, { name });
  }

  /**
   * Reconciles an Encounter's Party selection with its combatants: pulls in
   * PCs from newly-selected Parties (skipping any already present, e.g. a
   * PC added to two selected Parties) and drops PCs from de-selected ones.
   * Dropping is restricted to before the first Roll — same "setup mistake
   * correction" rule as removeCombatant — so de-selecting a Party mid-combat
   * doesn't yank a PC out of an active fight.
   */
  setEncounterParties(encounterId: string, partyIds: string[]): void {
    const encounter = this.getEncounter(encounterId);
    if (!encounter) return;

    const addedPartyIds = partyIds.filter((id) => !encounter.partyIds.includes(id));
    const removedPartyIds = encounter.partyIds.filter((id) => !partyIds.includes(id));

    // Snapshot once, up front — every removed/remaining computation below
    // reads from this same snapshot rather than re-reading
    // this.combatantsSignal() after issuing writes, since those writes
    // are async now and wouldn't be reflected in the signal yet anyway
    // (only the eventual onSnapshot callback updates it).
    const currentCombatants = this.combatantsForEncounter(encounterId);

    const existingPlayerIds = new Set(
      currentCombatants.filter((c) => c.type === 'pc').map((c) => c.playerId),
    );

    const newCombatants: Combatant[] = addedPartyIds.flatMap((partyId) =>
      this.partyStore
        .playersForParty(partyId)
        .filter((pc) => !existingPlayerIds.has(pc.id))
        .map((pc) => this.buildCombatant(encounterId, 'pc', { playerId: pc.id, npcId: null }, pc)),
    );

    const removedPlayerIds = new Set(
      encounter.activeCombatantIndex === null
        ? removedPartyIds.flatMap((partyId) =>
            this.partyStore.playersForParty(partyId).map((pc) => pc.id),
          )
        : [],
    );

    const combatantsToRemove = currentCombatants.filter(
      (c) => c.playerId && removedPlayerIds.has(c.playerId),
    );
    const remainingCombatantIds = encounter.combatantIds.filter(
      (id) => !combatantsToRemove.some((c) => c.id === id),
    );

    const batch = writeBatch(firestore);
    combatantsToRemove.forEach((c) => batch.delete(doc(firestore, 'combatants', c.id)));
    newCombatants.forEach((c) => batch.set(doc(firestore, 'combatants', c.id), c));
    batch.update(doc(firestore, 'encounters', encounterId), {
      partyIds,
      combatantIds: [...remainingCombatantIds, ...newCombatants.map((c) => c.id)],
    });
    batch.commit().catch((err) => console.error('Failed to update encounter parties', err));
  }

  /**
   * Troop-side mirror of setEncounterParties above — same "only drop before
   * the first Roll" rule, same add/remove-by-diff shape, but reads
   * npcStore.npcsForTroop() and sets npcId (not playerId) on the new
   * Combatants.
   */
  setEncounterTroops(encounterId: string, troopIds: string[]): void {
    const encounter = this.getEncounter(encounterId);
    if (!encounter) return;

    const addedTroopIds = troopIds.filter((id) => !encounter.troopIds.includes(id));
    const removedTroopIds = encounter.troopIds.filter((id) => !troopIds.includes(id));

    // See setEncounterParties' equivalent comment for why this is snapshot
    // once, up front, rather than re-read after issuing writes.
    const currentCombatants = this.combatantsForEncounter(encounterId);

    const existingNpcIds = new Set(
      currentCombatants.filter((c) => c.type === 'npc').map((c) => c.npcId),
    );

    const newCombatants: Combatant[] = addedTroopIds.flatMap((troopId) =>
      this.npcStore
        .npcsForTroop(troopId)
        .filter((npc) => !existingNpcIds.has(npc.id))
        .map((npc) =>
          this.buildCombatant(encounterId, 'npc', { playerId: null, npcId: npc.id }, npc),
        ),
    );

    const removedNpcIds = new Set(
      encounter.activeCombatantIndex === null
        ? removedTroopIds.flatMap((troopId) =>
            this.npcStore.npcsForTroop(troopId).map((npc) => npc.id),
          )
        : [],
    );

    const combatantsToRemove = currentCombatants.filter(
      (c) => c.npcId && removedNpcIds.has(c.npcId),
    );
    const remainingCombatantIds = encounter.combatantIds.filter(
      (id) => !combatantsToRemove.some((c) => c.id === id),
    );

    const batch = writeBatch(firestore);
    combatantsToRemove.forEach((c) => batch.delete(doc(firestore, 'combatants', c.id)));
    newCombatants.forEach((c) => batch.set(doc(firestore, 'combatants', c.id), c));
    batch.update(doc(firestore, 'encounters', encounterId), {
      troopIds,
      combatantIds: [...remainingCombatantIds, ...newCombatants.map((c) => c.id)],
    });
    batch.commit().catch((err) => console.error('Failed to update encounter troops', err));
  }

  /**
   * Pulls a single roster Player/Npc in as its own Combatant, without
   * pulling its whole Party/Troop — a no-op if that Player/Npc is already
   * present in this Encounter (same dedup spirit as setEncounterParties/
   * setEncounterTroops above, just for one id instead of a diffed list).
   * readyToJoin defaults to false (today's setup-phase behavior, straight
   * into the turn order); the run-phase "+" menu's Add Combatant flow
   * passes true instead, so the new Combatant lands in the Ready to Join
   * list rather than the active order — see docs/DATA_MODEL.md.
   */
  addPlayerCombatant(encounterId: string, playerId: string, readyToJoin = false): void {
    const player = this.partyStore.getPlayer(playerId);
    if (!player) return;
    const alreadyPresent = this.combatantsForEncounter(encounterId).some(
      (c) => c.playerId === playerId,
    );
    if (alreadyPresent) return;
    const combatant = this.buildCombatant(
      encounterId,
      'pc',
      { playerId: player.id, npcId: null },
      player,
      readyToJoin,
    );
    this.addCombatantAndLinkToEncounter(encounterId, combatant);
  }

  /** Npc-side mirror of addPlayerCombatant above. */
  addNpcCombatant(encounterId: string, npcId: string, readyToJoin = false): void {
    const npc = this.npcStore.getNpc(npcId);
    if (!npc) return;
    const alreadyPresent = this.combatantsForEncounter(encounterId).some((c) => c.npcId === npcId);
    if (alreadyPresent) return;
    const combatant = this.buildCombatant(
      encounterId,
      'npc',
      { playerId: null, npcId: npc.id },
      npc,
      readyToJoin,
    );
    this.addCombatantAndLinkToEncounter(encounterId, combatant);
  }

  /**
   * Shared by addPlayerCombatant/addNpcCombatant/addAdHocCombatant: writes
   * the new Combatant doc and appends its id to the Encounter's
   * combatantIds, batched together. Guards on the Encounter actually
   * existing (unlike the old localStorage-era code, which fell back to an
   * empty combatantIds array and no-op'd — harmless there since
   * updateEncounter's Array.map silently ignores a missing id, but a
   * Firestore updateDoc against a nonexistent document throws) — every
   * real call site always has a valid encounterId, so this only ever
   * matters for the same edge case the old code silently tolerated.
   */
  private addCombatantAndLinkToEncounter(encounterId: string, combatant: Combatant): void {
    const encounter = this.getEncounter(encounterId);
    const batch = writeBatch(firestore);
    batch.set(doc(firestore, 'combatants', combatant.id), combatant);
    if (encounter) {
      batch.update(doc(firestore, 'encounters', encounterId), {
        combatantIds: [...encounter.combatantIds, combatant.id],
      });
    }
    batch.commit().catch((err) => console.error('Failed to add combatant', err));

    // Optimistic local update — same reasoning as createEncounter's (see
    // its comment): encountersSignal/combatantsSignal only change once
    // Firestore's onSnapshot echo round-trips, which is too late for a
    // caller that adds several combatants in the same synchronous tick
    // (e.g. "Add All to Encounter" looping over every generated monster —
    // see EncounterList.onAddAllToEncounter). Without this, every
    // iteration's `getEncounter(encounterId)` above reads the SAME stale
    // combatantIds, so each one's batch.update computes
    // `[...originalIds, itsOwnId]` — the batches race, the last one to
    // commit on the server wins, and every combatant but one silently
    // fails to link (the combatant *document* still gets written, so it's
    // orphaned rather than visibly missing). Guarded against duplicates
    // the same way as createEncounter, for the same fake-firestore
    // synchronous-notify reason.
    if (!this.combatantsSignal().some((c) => c.id === combatant.id)) {
      this.combatantsSignal.update((list) => [...list, combatant]);
    }
    if (encounter) {
      this.encountersSignal.update((list) =>
        list.map((e) =>
          e.id === encounterId && !e.combatantIds.includes(combatant.id)
            ? { ...e, combatantIds: [...e.combatantIds, combatant.id] }
            : e,
        ),
      );
    }
  }

  /**
   * Adds a combatant that isn't backed by any library entry yet — today's
   * only NPC-creation path (Phase 1), generalized to also allow an ad-hoc
   * Player (e.g. a guest joining for one session). Replaces the old
   * type-locked addNpc. readyToJoin: see addPlayerCombatant above. Returns
   * the created Combatant so a caller that needs to track/update/remove it
   * again later (e.g. EncounterList's live-synced generator roster) has its
   * id without a separate lookup.
   */
  addAdHocCombatant(
    encounterId: string,
    type: CombatantType,
    fields: {
      name: string;
      initiativeModifier: number;
      initiativeAdvantage?: InitiativeAdvantageState;
      ac: number | null;
      maxHp: number | null;
      notes: string;
      monsterTemplateId?: string | null;
      monsterName?: string | null;
    },
    readyToJoin = false,
  ): Combatant {
    const combatant = this.buildCombatant(
      encounterId,
      type,
      { playerId: null, npcId: null },
      fields,
      readyToJoin,
    );
    this.addCombatantAndLinkToEncounter(encounterId, combatant);
    return combatant;
  }

  /**
   * The "Save to Roster" action: links an already-existing ad-hoc Combatant
   * to a library entry the page just created (or an existing one), without
   * creating a second Combatant. Sets playerId or npcId depending on the
   * combatant's existing type — a narrow, UI-driven id assignment, not
   * aware of PartyStore/NpcStore itself (that orchestration — creating the
   * library entry and assigning it to a Party/Troop — lives at the page
   * level; see EncounterDetail/EncounterList's saveToRoster).
   */
  linkCombatantToLibraryEntry(encounterId: string, combatantId: string, linkedId: string): void {
    const combatant = this.combatantsForEncounter(encounterId).find((c) => c.id === combatantId);
    if (!combatant) return;
    this.updateCombatant(
      combatantId,
      combatant.type === 'pc' ? { playerId: linkedId } : { npcId: linkedId },
    );
  }

  /** Only allowed before the first Roll — same "setup mistake correction" rule as removeCombatant. */
  setInitiativeModifier(
    encounterId: string,
    combatantId: string,
    initiativeModifier: number,
  ): void {
    const encounter = this.getEncounter(encounterId);
    if (!encounter || encounter.activeCombatantIndex !== null) return;
    this.updateCombatant(combatantId, { initiativeModifier });
  }

  /**
   * The Edit modal's save handler — name/ac/maxHp/notes apply unconditionally,
   * but initiativeModifier keeps setInitiativeModifier's existing "setup
   * mistake correction" rule (dropped silently once the encounter has
   * started) rather than gaining a second, looser way to change it. When
   * maxHp changes, currentHp is reclamped into the new range instead of
   * being reset to full — that preserves whatever damage was already being
   * tracked instead of surprising the GM with a full heal on every edit.
   */
  updateCombatantDetails(
    encounterId: string,
    combatantId: string,
    changes: {
      name?: string;
      initiativeModifier?: number;
      ac?: number | null;
      maxHp?: number | null;
      notes?: string;
    },
  ): void {
    const encounter = this.getEncounter(encounterId);
    const combatant = this.combatantsSignal().find((c) => c.id === combatantId);
    if (!encounter || !combatant) return;

    const { initiativeModifier, ...rest } = changes;
    const applied: Partial<Combatant> = { ...rest };
    if (initiativeModifier !== undefined && encounter.activeCombatantIndex === null) {
      applied.initiativeModifier = initiativeModifier;
    }
    if ('maxHp' in applied) {
      applied.currentHp = clampCurrentHp(
        combatant.currentHp ?? applied.maxHp ?? 0,
        applied.maxHp ?? null,
      );
    }
    this.updateCombatant(combatantId, applied);
  }

  /**
   * Applies a signed HP delta (damage is negative, healing is positive),
   * clamped to [0, maxHp]. No-op if maxHp isn't set — nothing to track.
   * Damage is deducted from Temp HP first, down to 0, before any
   * remainder spills over into real currentHp — Healing never restores
   * Temp HP, only ever real HP, same as before Temp HP existed.
   */
  adjustCurrentHp(encounterId: string, combatantId: string, delta: number): void {
    const combatant = this.combatantsForEncounter(encounterId).find((c) => c.id === combatantId);
    if (!combatant || combatant.maxHp === null) return;
    if (delta >= 0) {
      const currentHp = clampCurrentHp(
        (combatant.currentHp ?? combatant.maxHp) + delta,
        combatant.maxHp,
      );
      this.updateCombatant(combatantId, { currentHp });
      return;
    }
    const damage = -delta;
    const tempHpAbsorbed = Math.min(combatant.tempHp, damage);
    const spillover = damage - tempHpAbsorbed;
    const currentHp = clampCurrentHp(
      (combatant.currentHp ?? combatant.maxHp) - spillover,
      combatant.maxHp,
    );
    this.updateCombatant(combatantId, { currentHp, tempHp: combatant.tempHp - tempHpAbsorbed });
  }

  /** The HP popover's "+Temp" button, when no pool is currently active — sets a fresh Temp HP pool. No-op if maxHp isn't set (nothing to track) or amount isn't a positive number. */
  setTempHp(encounterId: string, combatantId: string, amount: number): void {
    const combatant = this.combatantsForEncounter(encounterId).find((c) => c.id === combatantId);
    if (!combatant || combatant.maxHp === null) return;
    if (!Number.isFinite(amount) || amount <= 0) return;
    this.updateCombatant(combatantId, { tempHp: amount });
  }

  /** The HP popover's "+Temp" button, when a pool is already active — clears it immediately, no confirmation. */
  clearTempHp(encounterId: string, combatantId: string): void {
    this.updateCombatant(combatantId, { tempHp: 0 });
  }

  /** The AC popover's add-value step, when no Bonus Armor is currently active. No-op if base AC isn't set (Bonus Armor stacks on a base AC, matching the AC badge's own "only shown when ac !== null" rule) or amount isn't a positive number. */
  setBonusAc(encounterId: string, combatantId: string, amount: number): void {
    const combatant = this.combatantsForEncounter(encounterId).find((c) => c.id === combatantId);
    if (!combatant || combatant.ac === null) return;
    if (!Number.isFinite(amount) || amount <= 0) return;
    this.updateCombatant(combatantId, { bonusAc: amount });
  }

  /** The AC popover's confirm-to-remove step, when Bonus Armor is already active. */
  clearBonusAc(encounterId: string, combatantId: string): void {
    this.updateCombatant(combatantId, { bonusAc: 0 });
  }

  /**
   * The Initiative popover's None/Advantage/Disadvantage radio choice.
   * Applies unconditionally, with none of setInitiativeModifier's "before
   * first Roll" gating — unlike the modifier, changing this can't leave an
   * already-computed initiativeTotal inconsistent, since it only affects
   * how the *next* roll is made (the initial Roll or a round-boundary
   * reroll), not an offset applied after the fact.
   *
   * Also writes through to the linked Player/Npc (if any), so this choice
   * becomes the sticky default the *next* Combatant built from that
   * library entry starts with (see buildCombatant and Player.
   * initiativeAdvantage's doc comment) — picking "None" here is what
   * dismisses it. An ad-hoc combatant (no playerId/npcId) only ever
   * updates its own Combatant, same as before this existed.
   */
  setInitiativeAdvantage(
    encounterId: string,
    combatantId: string,
    initiativeAdvantage: InitiativeAdvantageState,
  ): void {
    const combatant = this.combatantsSignal().find((c) => c.id === combatantId);
    this.updateCombatant(combatantId, { initiativeAdvantage });
    if (combatant?.playerId) {
      this.partyStore.updatePlayer(combatant.playerId, { initiativeAdvantage });
    } else if (combatant?.npcId) {
      this.npcStore.updateNpc(combatant.npcId, { initiativeAdvantage });
    }
  }

  /** Only allowed before the first Roll — corrects a setup mistake. */
  removeCombatant(encounterId: string, combatantId: string): void {
    const encounter = this.getEncounter(encounterId);
    if (!encounter || encounter.activeCombatantIndex !== null) return;
    const batch = writeBatch(firestore);
    batch.update(doc(firestore, 'encounters', encounterId), {
      combatantIds: encounter.combatantIds.filter((id) => id !== combatantId),
    });
    batch.delete(doc(firestore, 'combatants', combatantId));
    batch.commit().catch((err) => console.error('Failed to remove combatant', err));
  }

  setReRollEachRound(encounterId: string, reRollEachRound: boolean): void {
    this.updateEncounter(encounterId, { reRollEachRound });
  }

  /** The first Roll: rolls everyone, sorts the initiative order, starts round 1. */
  rollInitiative(encounterId: string): void {
    const order = this.combatantsForEncounter(encounterId);
    const rolled = reRollRound(order);
    const activeIndex = firstActiveIndex(rolled);
    const activeId = activeIndex !== null ? rolled[activeIndex].id : null;
    this.commitOrder(encounterId, syncHoldPositions(rolled, activeId), activeId);
    this.updateEncounter(encounterId, { round: 1 });
  }

  /** The id of whichever combatant is currently Active, if any. */
  private activeCombatantId(encounterId: string): string | null {
    const encounter = this.getEncounter(encounterId);
    if (!encounter || encounter.activeCombatantIndex === null) return null;
    return this.combatantsForEncounter(encounterId)[encounter.activeCombatantIndex]?.id ?? null;
  }

  /**
   * Rolls a fresh initiative for `combatant` — randomized, but always
   * capped below the current Active combatant's total — for "rejoining
   * mid-round, right where that roll would place them" rather than
   * snapping back to an original spot or interrupting whoever's turn it
   * currently is. Shared by toggleRemoved's un-remove branch and
   * joinReadyToJoinCombatant below, which use the exact same logic.
   */
  private rollCombatantInBelowActive(encounterId: string, combatant: Combatant): Combatant {
    const activeId = this.activeCombatantId(encounterId);
    const order = this.combatantsForEncounter(encounterId);
    const activeTotal = activeId ? (order.find((c) => c.id === activeId)?.initiativeTotal ?? 0) : 0;
    const roll = rollD20WithAdvantage(combatant.initiativeAdvantage);
    const total = Math.min(roll + combatant.initiativeModifier, activeTotal - 1);
    return { ...combatant, lastRoll: roll, initiativeTotal: total };
  }

  /**
   * Marking the currently-active combatant Removed would leave
   * activeCombatantIndex pointing at a skipped entry, so we auto-advance to
   * the next active combatant — the natural GM behavior when whoever's turn
   * it is drops out of the fight. That advance has to happen *before* we
   * sink the combatant to the bottom of the order: advanceTurn finds "the
   * next eligible index after the current one" by position, and moving the
   * removed combatant first would shift everything's position out from
   * under that lookup.
   *
   * Un-removing rolls a fresh initiative that's randomized but always below
   * the current Active total, and inserts the combatant at that point in
   * the order — "rejoining mid-round, right where that roll would place
   * them" rather than snapping back to their original spot.
   */
  toggleRemoved(encounterId: string, combatantId: string): void {
    const encounter = this.getEncounter(encounterId);
    if (!encounter) return;
    const order = this.combatantsForEncounter(encounterId);
    const combatant = order.find((c) => c.id === combatantId);
    if (!combatant) return;

    const nowRemoved = !combatant.removedFromCombat;

    if (nowRemoved) {
      const wasActive = this.activeCombatantId(encounterId) === combatantId;
      // Removed = "N/A", which compareByInitiative treats as 0 — that's
      // what sinks them toward the bottom once we reorder below. Flip the
      // flags in place first (no reordering yet) so advanceTurn's index
      // arithmetic still lines up with the pre-toggle order.
      this.updateCombatant(combatantId, {
        removedFromCombat: true,
        onHold: false,
        lastRoll: null,
        initiativeTotal: null,
        preHoldLastRoll: null,
        preHoldInitiativeTotal: null,
      });
      if (combatant.onHold) {
        this.updateEncounter(encounterId, {
          holdOrder: encounter.holdOrder.filter((id) => id !== combatantId),
        });
      }
      if (wasActive) this.advanceTurn(encounterId, 'forward');

      const activeId = this.activeCombatantId(encounterId);
      const refreshedOrder = this.combatantsForEncounter(encounterId);
      const removedCombatant = refreshedOrder.find((c) => c.id === combatantId)!;
      const reordered = insertBySortedPosition(refreshedOrder, removedCombatant);
      this.commitOrder(encounterId, syncHoldPositions(reordered, activeId), activeId);
      return;
    }

    // Un-removing: an already-removed combatant is never Active, so the
    // Active total we're capping against is unaffected by this toggle.
    const activeId = this.activeCombatantId(encounterId);
    const updated: Combatant = {
      ...this.rollCombatantInBelowActive(encounterId, combatant),
      removedFromCombat: false,
    };
    const reordered = insertBySortedPosition(order, updated);
    this.commitOrder(encounterId, syncHoldPositions(reordered, activeId), activeId);
  }

  /**
   * Manually joining a Ready to Join combatant — per the GM spec, "same
   * logic as leaving Removed from Combat": a fresh roll capped below the
   * current Active total, inserted at that sorted position. Never
   * interrupts whoever's turn it currently is. Combatants left un-joined
   * are folded into the main list automatically at the next round
   * boundary instead — see reRollRound/foldInReadyToJoin.
   */
  joinReadyToJoinCombatant(encounterId: string, combatantId: string): void {
    const order = this.combatantsForEncounter(encounterId);
    const combatant = order.find((c) => c.id === combatantId);
    if (!combatant || !combatant.readyToJoin) return;
    const activeId = this.activeCombatantId(encounterId);
    const updated: Combatant = {
      ...this.rollCombatantInBelowActive(encounterId, combatant),
      readyToJoin: false,
    };
    const reordered = insertBySortedPosition(order, updated);
    this.commitOrder(encounterId, syncHoldPositions(reordered, activeId), activeId);
  }

  /**
   * Purely a display flag — unlike toggleRemoved/toggleHoldAction above, it
   * doesn't touch ordering, activeCombatantIndex, or holdOrder: an
   * Incapacitated combatant keeps rolling, sorting, and taking turns exactly
   * like anyone else, just greyed out in the UI.
   */
  toggleIncapacitated(encounterId: string, combatantId: string): void {
    const combatant = this.combatantsForEncounter(encounterId).find((c) => c.id === combatantId);
    if (!combatant) return;
    this.updateCombatant(combatantId, { incapacitated: !combatant.incapacitated });
  }

  /**
   * Holding an action moves the combatant into the secondary Hold Action
   * list (Encounter.holdOrder, appended so first-to-hold sorts first) and
   * pins their displayed initiative to the Active combatant's total; Forward/
   * Back skip them until this is unchecked. Their pre-hold roll is snapshotted
   * so a new round can restore it later if the encounter isn't re-rolling
   * (see reRollRound/clearHoldWithoutReroll). If it's the Active combatant
   * choosing to hold, their turn passes immediately (same ordering-then-
   * advancing caveat as toggleRemoved above). Un-holding leaves them wherever
   * they already sat — effectively "jumping into the action" right after the
   * turn that was current when they un-held.
   */
  toggleHoldAction(encounterId: string, combatantId: string): void {
    const encounter = this.getEncounter(encounterId);
    if (!encounter) return;
    const combatant = this.combatantsForEncounter(encounterId).find((c) => c.id === combatantId);
    if (!combatant) return;

    const wasActive = this.activeCombatantId(encounterId) === combatantId;
    const nowOnHold = !combatant.onHold;

    if (nowOnHold) {
      this.updateCombatant(combatantId, {
        onHold: true,
        preHoldLastRoll: combatant.lastRoll,
        preHoldInitiativeTotal: combatant.initiativeTotal,
      });
      this.updateEncounter(encounterId, { holdOrder: [...encounter.holdOrder, combatantId] });
    } else {
      this.updateCombatant(combatantId, {
        onHold: false,
        preHoldLastRoll: null,
        preHoldInitiativeTotal: null,
      });
      this.updateEncounter(encounterId, {
        holdOrder: encounter.holdOrder.filter((id) => id !== combatantId),
      });
    }

    if (nowOnHold && wasActive) this.advanceTurn(encounterId, 'forward');

    if (!nowOnHold) return; // Un-holding: no repositioning, stay put.

    const activeId = this.activeCombatantId(encounterId);
    const order = this.combatantsForEncounter(encounterId);
    this.commitOrder(encounterId, syncHoldPositions(order, activeId), activeId);
  }

  /**
   * Places a combatant returning from Hold Action at an explicit spot next
   * to Active — one point above or below its total — rather than leaving it
   * wherever it happened to be pinned while holding. Driven by the GM
   * picking a placeholder or dropping the bubble there (see the
   * placement-mode signals in encounter-detail.ts); toggleHoldAction above
   * still handles turning Hold Action *on*.
   *
   * "Above" is treated as interrupting on the held trigger: the returning
   * combatant becomes the new Active combatant immediately, rather than
   * just visually sitting above the old one. The previous Active combatant
   * doesn't need any special handling to resume afterward — they're simply
   * the next-highest total left in the order, so Forward naturally lands
   * back on them once the interrupter's turn ends. "Below" only queues the
   * combatant up next, without disturbing whose turn it currently is.
   */
  returnFromHold(encounterId: string, combatantId: string, position: 'above' | 'below'): void {
    const encounter = this.getEncounter(encounterId);
    if (!encounter) return;
    const order = this.combatantsForEncounter(encounterId);
    const combatant = order.find((c) => c.id === combatantId);
    if (!combatant || !combatant.onHold) return;

    const previousActiveId = this.activeCombatantId(encounterId);
    const activeTotal = order.find((c) => c.id === previousActiveId)?.initiativeTotal ?? 0;
    const total = position === 'above' ? activeTotal + 1 : activeTotal - 1;

    const updated: Combatant = {
      ...combatant,
      onHold: false,
      initiativeTotal: total,
      lastRoll: total - combatant.initiativeModifier,
      preHoldLastRoll: null,
      preHoldInitiativeTotal: null,
    };
    this.updateEncounter(encounterId, {
      holdOrder: encounter.holdOrder.filter((id) => id !== combatantId),
    });
    // "Above" interrupts, immediately ending the previously-Active
    // combatant's turn — this is the one place activeCombatantIndex
    // changes without going through advanceTurn, so it needs its own
    // explicit linked-timer credit (see the guard's own comment for why
    // a redundant call elsewhere would be harmless anyway).
    if (position === 'above') {
      this.creditLinkedTimerDeparture(encounterId, previousActiveId, encounter.round);
    }
    const reordered = insertBySortedPosition(order, updated);
    const nextActiveId = position === 'above' ? combatantId : previousActiveId;
    this.commitOrder(encounterId, syncHoldPositions(reordered, nextActiveId), nextActiveId);
  }

  /**
   * Manually repositions a combatant within the main initiative order — the
   * GM dragging a bubble by its drag handle to a new spot. `newIndex`
   * follows the same "remove, then insert" convention as Array.splice /
   * Angular CDK's moveItemInArray: the target index within the order *with
   * the dragged combatant already removed*. Like every other manual
   * repositioning in this app (un-removing, Hold Action placement), it pins
   * to a neighbor's total ± 1 rather than computing a midpoint — one point
   * below whoever ends up above it, or one point above whoever ends up
   * below it if dropped at the very top. Removed/on-hold combatants aren't
   * draggable in the UI, so this is a no-op for either (they don't have a
   * real position to move within the main order).
   *
   * Spliced directly into `newIndex` rather than routed through
   * insertBySortedPosition: that helper re-derives position from the new
   * total via compareStable, which only works when the total lands strictly
   * between its neighbors. When the two neighbors are tied with each other
   * (e.g. dropping between two combatants who both rolled the same total),
   * there's no integer between them — above.total - 1 undercuts *both*, so
   * a sort-based placement would bounce the dragged combatant to the
   * bottom instead of leaving it where the GM dropped it. A direct splice
   * always honors the drop position; the computed total is then just
   * along for the ride, joining the tie when neighbors are tied.
   */
  reorderCombatant(encounterId: string, combatantId: string, newIndex: number): void {
    const encounter = this.getEncounter(encounterId);
    if (!encounter) return;
    const order = this.combatantsForEncounter(encounterId);
    const combatant = order.find((c) => c.id === combatantId);
    if (!combatant || combatant.removedFromCombat || combatant.onHold || combatant.readyToJoin)
      return;

    const rest = order.filter((c) => c.id !== combatantId);
    const above = rest[newIndex - 1] ?? null;
    const below = rest[newIndex] ?? null;
    const aboveTotal = above?.initiativeTotal ?? null;
    const belowTotal = below?.initiativeTotal ?? null;
    const total =
      aboveTotal !== null && belowTotal !== null && aboveTotal === belowTotal
        ? aboveTotal
        : aboveTotal !== null
          ? aboveTotal - 1
          : belowTotal !== null
            ? belowTotal + 1
            : (combatant.initiativeTotal ?? 0);

    const updated: Combatant = {
      ...combatant,
      initiativeTotal: total,
      lastRoll: total - combatant.initiativeModifier,
    };
    const reordered = [...rest.slice(0, newIndex), updated, ...rest.slice(newIndex)];
    const activeId = this.activeCombatantId(encounterId);
    this.commitOrder(encounterId, syncHoldPositions(reordered, activeId), activeId);
  }

  advanceTurn(encounterId: string, direction: 'forward' | 'back'): void {
    const encounter = this.getEncounter(encounterId);
    if (!encounter || encounter.activeCombatantIndex === null) return;

    const order = this.combatantsForEncounter(encounterId);
    const activeIndices = order.reduce<number[]>((acc, c, i) => {
      if (!c.removedFromCombat && !c.onHold && !c.readyToJoin) acc.push(i);
      return acc;
    }, []);
    if (activeIndices.length === 0) return;

    // Found by relative position (> / <), not indexOf: toggleRemoved()/
    // toggleHoldAction() may have just excluded the current active combatant
    // before calling us, in which case its old index is no longer *in*
    // activeIndices at all — an indexOf-based lookup would come back -1 and
    // misbehave. Comparing "is there an active index past/before this one"
    // works either way.
    const current = encounter.activeCombatantIndex;

    if (direction === 'back') {
      const previous = [...activeIndices].reverse().find((i) => i < current);
      if (previous === undefined) return; // Phase 1: Back doesn't cross a round boundary.
      const activeId = order[previous].id;
      this.uncreditLinkedTimerOnBack(encounterId, activeId, encounter.round);
      this.commitOrder(encounterId, syncHoldPositions(order, activeId), activeId);
      return;
    }

    // Forward always means the current Active combatant's turn just ended
    // — credit their linked timer (if any) before deciding whether that's
    // a same-round advance or a round rollover, since both cases count.
    this.creditLinkedTimerDeparture(encounterId, order[current]?.id ?? null, encounter.round);

    const next = activeIndices.find((i) => i > current);
    if (next !== undefined) {
      const activeId = order[next].id;
      this.commitOrder(encounterId, syncHoldPositions(order, activeId), activeId);
      return;
    }

    // Advancing past the last active combatant starts a new round: unlinked
    // timers tick once here, and any combatant still on Hold Action (never
    // returned to take a turn this round) credits its linked timer too —
    // creditLinkedTimerDeparture's once-per-round guard means this is a
    // no-op for anyone already credited above (e.g. they went on Hold
    // *this* round, which already fired the credit at that moment).
    this.decrementUnlinkedTimers(encounterId);
    order
      .filter((c) => c.onHold)
      .forEach((c) => this.creditLinkedTimerDeparture(encounterId, c.id, encounter.round));

    // The Hold Action list always empties back into the main order here,
    // either with a fresh reroll (default homebrew rule) or each
    // combatant's pre-hold initiative (see clearHoldWithoutReroll/
    // reRollRound for which) — and any Ready to Join combatant not
    // manually joined during the round folds in alongside them.
    const nextRound = encounter.round + 1;
    if (!encounter.reRollEachRound) {
      const cleared = clearHoldWithoutReroll(order);
      const folded = foldInReadyToJoin(cleared);
      const nextActiveIndex = firstActiveIndex(folded);
      const activeId = nextActiveIndex !== null ? folded[nextActiveIndex].id : null;
      this.commitOrder(encounterId, folded, activeId);
      this.updateEncounter(encounterId, { round: nextRound, holdOrder: [] });
      return;
    }

    const rolled = reRollRound(order);
    const nextActiveIndex = firstActiveIndex(rolled);
    const activeId = nextActiveIndex !== null ? rolled[nextActiveIndex].id : null;
    this.commitOrder(encounterId, rolled, activeId);
    this.updateEncounter(encounterId, { round: nextRound, holdOrder: [] });
  }

  /**
   * Decrements a timer linked to `combatantId`, floored at 0, at most once
   * per round (guarded by lastTickedRoundCredited !== round) — a linked
   * combatant's turn can "end" more than once in the same round (going on
   * Hold, then later actually taking a delayed turn after returning), and
   * the timer should still only tick once for that round, the same
   * once-per-round cadence an unlinked timer gets from the round boundary
   * itself. Safe to call defensively from multiple sites for the same
   * combatant/round — redundant calls are no-ops.
   */
  private creditLinkedTimerDeparture(
    encounterId: string,
    combatantId: string | null,
    round: number,
  ): void {
    if (!combatantId) return;
    const toCredit = this.timersSignal().filter(
      (t) =>
        t.encounterId === encounterId &&
        t.linkedCombatantId === combatantId &&
        t.lastTickedRoundCredited !== round,
    );
    if (toCredit.length === 0) return;
    const batch = writeBatch(firestore);
    toCredit.forEach((t) =>
      batch.update(doc(firestore, 'timers', t.id), {
        remaining: Math.max(0, t.remaining - 1),
        lastTickedRoundCredited: round,
      }),
    );
    batch.commit().catch((err) => console.error('Failed to credit linked timer', err));
  }

  /**
   * Back's mirror of creditLinkedTimerDeparture: undoes the current
   * round's credit for a timer linked to whoever Back just landed on, only
   * if that credit was actually applied this round. Back never crosses a
   * round boundary (see isFirstActiveCombatant in encounter-detail.ts), so
   * there's never an earlier round's credit here to worry about touching —
   * and unlike the automatic decrement, this undo is intentionally not
   * floored, so it exactly reverses whatever creditLinkedTimerDeparture did.
   */
  private uncreditLinkedTimerOnBack(
    encounterId: string,
    combatantId: string | null,
    round: number,
  ): void {
    if (!combatantId) return;
    const toUncredit = this.timersSignal().filter(
      (t) =>
        t.encounterId === encounterId &&
        t.linkedCombatantId === combatantId &&
        t.lastTickedRoundCredited === round,
    );
    if (toUncredit.length === 0) return;
    const batch = writeBatch(firestore);
    toUncredit.forEach((t) =>
      batch.update(doc(firestore, 'timers', t.id), {
        remaining: t.remaining + 1,
        lastTickedRoundCredited: null,
      }),
    );
    batch.commit().catch((err) => console.error('Failed to uncredit linked timer', err));
  }

  /** Unlinked timers tick once per round, at the round boundary itself — no guard needed, this only ever runs once per advanceTurn call. */
  private decrementUnlinkedTimers(encounterId: string): void {
    const unlinked = this.timersSignal().filter(
      (t) => t.encounterId === encounterId && t.linkedCombatantId === null,
    );
    if (unlinked.length === 0) return;
    const batch = writeBatch(firestore);
    unlinked.forEach((t) =>
      batch.update(doc(firestore, 'timers', t.id), { remaining: Math.max(0, t.remaining - 1) }),
    );
    batch.commit().catch((err) => console.error('Failed to decrement timers', err));
  }

  createTimer(
    encounterId: string,
    name: string,
    initialValue: number,
    linkedCombatantId: string | null,
  ): Timer {
    // If the timer is linked to whoever's turn it currently is, that turn is
    // already "in progress" from the timer's point of view — the upcoming
    // Next Turn ends it, but creditLinkedTimerDeparture would otherwise read
    // that as this combatant's first departure and tick immediately. Stamp
    // the current round as already credited so that departure is a no-op;
    // the timer gets its first real tick when this combatant's turn ends in
    // a later round instead.
    const linkedToActive =
      linkedCombatantId !== null && linkedCombatantId === this.activeCombatantId(encounterId);
    const timer: Timer = {
      id: crypto.randomUUID(),
      encounterId,
      ownerId: this.requireUid(),
      name,
      remaining: initialValue,
      initialValue,
      linkedCombatantId,
      lastTickedRoundCredited: linkedToActive
        ? (this.getEncounter(encounterId)?.round ?? null)
        : null,
    };
    setDoc(doc(firestore, 'timers', timer.id), timer).catch((err) =>
      console.error('Failed to create timer', err),
    );
    return timer;
  }

  renameTimer(encounterId: string, timerId: string, name: string): void {
    updateDoc(doc(firestore, 'timers', timerId), { name }).catch((err) =>
      console.error('Failed to rename timer', err),
    );
  }

  dismissTimer(encounterId: string, timerId: string): void {
    deleteDoc(doc(firestore, 'timers', timerId)).catch((err) =>
      console.error('Failed to dismiss timer', err),
    );
  }

  /** The GM's manual +/- nudge — unlike the automatic ticks above, deliberately unclamped, so a mistake can be corrected either direction. */
  adjustTimerValue(encounterId: string, timerId: string, delta: number): void {
    const timer = this.timersSignal().find(
      (t) => t.encounterId === encounterId && t.id === timerId,
    );
    if (!timer) return;
    updateDoc(doc(firestore, 'timers', timerId), { remaining: timer.remaining + delta }).catch(
      (err) => console.error('Failed to adjust timer', err),
    );
  }
}

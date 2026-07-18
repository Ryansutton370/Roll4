import { Service, effect, inject, signal } from '@angular/core';
import { Combatant, Encounter } from '../models/encounter.model';
import { PartyStore } from './party-store';

const STORAGE_KEY = 'roll4.encounters';

interface EncounterStorageShape {
  encounters: Encounter[];
  combatants: Combatant[];
}

function rollD20(): number {
  return Math.floor(Math.random() * 20) + 1;
}

function rollInitiativeFor(combatant: Combatant): Combatant {
  const lastRoll = rollD20();
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
 * like everyone else, discarding the pre-hold snapshot.
 */
export function reRollRound(order: Combatant[]): Combatant[] {
  const rerolled = order.map((c) => {
    if (c.removedFromCombat) return { ...c, lastRoll: null, initiativeTotal: null };
    const base = c.onHold
      ? { ...c, onHold: false, preHoldLastRoll: null, preHoldInitiativeTotal: null }
      : c;
    return rollInitiativeFor(base);
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
  return heldIds.reduce((acc, id) => insertBySortedPosition(acc, acc.find((c) => c.id === id)!), restored);
}

/** The first combatant eligible to act — skips Removed and on-hold entries. */
export function firstActiveIndex(order: Combatant[]): number | null {
  const index = order.findIndex((c) => !c.removedFromCombat && !c.onHold);
  return index === -1 ? null : index;
}

@Service()
export class EncounterStore {
  private readonly encountersSignal = signal<Encounter[]>([]);
  private readonly combatantsSignal = signal<Combatant[]>([]);

  readonly encounters = this.encountersSignal.asReadonly();
  readonly combatants = this.combatantsSignal.asReadonly();

  // inject(): fetches a dependency from Angular's DI container. It must be
  // called during class field initialization (an "injection context"),
  // which is why it replaces constructor-parameter injection for @Service
  // classes rather than appearing inside a constructor body.
  private readonly partyStore = inject(PartyStore);

  constructor() {
    this.load();

    effect(() => {
      const snapshot: EncounterStorageShape = {
        encounters: this.encountersSignal(),
        combatants: this.combatantsSignal(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    });
  }

  private load(): void {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as EncounterStorageShape;
      this.encountersSignal.set(parsed.encounters ?? []);
      this.combatantsSignal.set(parsed.combatants ?? []);
    } catch {
      // Corrupt/unreadable data — start fresh rather than crash the app.
    }
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

  private updateEncounter(id: string, changes: Partial<Encounter>): void {
    this.encountersSignal.update((encounters) =>
      encounters.map((e) => (e.id === id ? { ...e, ...changes } : e)),
    );
  }

  private updateCombatant(id: string, changes: Partial<Combatant>): void {
    this.combatantsSignal.update((combatants) =>
      combatants.map((c) => (c.id === id ? { ...c, ...changes } : c)),
    );
  }

  /**
   * Commits a freshly-ordered combatant array: writes the (possibly changed)
   * combatants back into the signal, saves the new order onto the Encounter,
   * and resolves activeId to its new index. Re-resolving by id rather than
   * carrying an index through is what lets syncHoldPositions reorder the
   * list without every caller having to track how indices shifted.
   */
  private commitOrder(encounterId: string, order: Combatant[], activeId: string | null): void {
    this.combatantsSignal.update((combatants) => {
      const byId = new Map(order.map((c) => [c.id, c]));
      return combatants.map((c) => byId.get(c.id) ?? c);
    });
    const activeCombatantIndex = activeId === null ? null : order.findIndex((c) => c.id === activeId);
    this.updateEncounter(encounterId, {
      combatantIds: order.map((c) => c.id),
      activeCombatantIndex: activeCombatantIndex === -1 ? null : activeCombatantIndex,
    });
  }

  /** Creates an Encounter and pulls in every PC from the selected Parties as Combatants. */
  createEncounter(name: string, partyIds: string[]): Encounter {
    const encounterId = crypto.randomUUID();
    const newCombatants: Combatant[] = partyIds.flatMap((partyId) =>
      this.partyStore.pcsForParty(partyId).map(
        (pc): Combatant => ({
          id: crypto.randomUUID(),
          encounterId,
          type: 'pc',
          pcId: pc.id,
          name: pc.name,
          initiativeModifier: pc.initiativeModifier,
          lastRoll: null,
          initiativeTotal: null,
          removedFromCombat: false,
          onHold: false,
          preHoldLastRoll: null,
          preHoldInitiativeTotal: null,
        }),
      ),
    );

    const encounter: Encounter = {
      id: encounterId,
      name,
      partyIds,
      combatantIds: newCombatants.map((c) => c.id),
      activeCombatantIndex: null,
      holdOrder: [],
      round: 0,
      reRollEachRound: true,
    };

    this.combatantsSignal.update((combatants) => [...combatants, ...newCombatants]);
    this.encountersSignal.update((encounters) => [...encounters, encounter]);
    return encounter;
  }

  deleteEncounter(id: string): void {
    this.encountersSignal.update((encounters) => encounters.filter((e) => e.id !== id));
    this.combatantsSignal.update((combatants) => combatants.filter((c) => c.encounterId !== id));
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

    const existingPcIds = new Set(
      this.combatantsForEncounter(encounterId)
        .filter((c) => c.type === 'pc')
        .map((c) => c.pcId),
    );

    const newCombatants: Combatant[] = addedPartyIds.flatMap((partyId) =>
      this.partyStore
        .pcsForParty(partyId)
        .filter((pc) => !existingPcIds.has(pc.id))
        .map(
          (pc): Combatant => ({
            id: crypto.randomUUID(),
            encounterId,
            type: 'pc',
            pcId: pc.id,
            name: pc.name,
            initiativeModifier: pc.initiativeModifier,
            lastRoll: null,
            initiativeTotal: null,
            removedFromCombat: false,
            onHold: false,
            preHoldLastRoll: null,
            preHoldInitiativeTotal: null,
          }),
        ),
    );

    const removedPcIds = new Set(
      encounter.activeCombatantIndex === null
        ? removedPartyIds.flatMap((partyId) => this.partyStore.pcsForParty(partyId).map((pc) => pc.id))
        : [],
    );

    this.combatantsSignal.update((combatants) => [
      ...combatants.filter(
        (c) => !(c.encounterId === encounterId && c.pcId && removedPcIds.has(c.pcId)),
      ),
      ...newCombatants,
    ]);

    const remainingCombatantIds = encounter.combatantIds.filter((id) => {
      const c = this.combatantsSignal().find((cc) => cc.id === id);
      return !!c && !(c.pcId && removedPcIds.has(c.pcId));
    });

    this.updateEncounter(encounterId, {
      partyIds,
      combatantIds: [...remainingCombatantIds, ...newCombatants.map((c) => c.id)],
    });
  }

  addNpc(encounterId: string, name: string, initiativeModifier: number): void {
    const npc: Combatant = {
      id: crypto.randomUUID(),
      encounterId,
      type: 'npc',
      pcId: null,
      name,
      initiativeModifier,
      lastRoll: null,
      initiativeTotal: null,
      removedFromCombat: false,
      onHold: false,
      preHoldLastRoll: null,
      preHoldInitiativeTotal: null,
    };
    this.combatantsSignal.update((combatants) => [...combatants, npc]);
    this.updateEncounter(encounterId, {
      combatantIds: [...(this.getEncounter(encounterId)?.combatantIds ?? []), npc.id],
    });
  }

  /** Only allowed before the first Roll — same "setup mistake correction" rule as removeCombatant. */
  setInitiativeModifier(encounterId: string, combatantId: string, initiativeModifier: number): void {
    const encounter = this.getEncounter(encounterId);
    if (!encounter || encounter.activeCombatantIndex !== null) return;
    this.updateCombatant(combatantId, { initiativeModifier });
  }

  /** Only allowed before the first Roll — corrects a setup mistake. */
  removeCombatant(encounterId: string, combatantId: string): void {
    const encounter = this.getEncounter(encounterId);
    if (!encounter || encounter.activeCombatantIndex !== null) return;
    this.updateEncounter(encounterId, {
      combatantIds: encounter.combatantIds.filter((id) => id !== combatantId),
    });
    this.combatantsSignal.update((combatants) => combatants.filter((c) => c.id !== combatantId));
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
    const activeTotal = activeId ? order.find((c) => c.id === activeId)?.initiativeTotal ?? 0 : 0;
    const roll = rollD20();
    const total = Math.min(roll + combatant.initiativeModifier, activeTotal - 1);
    const updated: Combatant = {
      ...combatant,
      removedFromCombat: false,
      lastRoll: roll,
      initiativeTotal: total,
    };
    const reordered = insertBySortedPosition(order, updated);
    this.commitOrder(encounterId, syncHoldPositions(reordered, activeId), activeId);
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
   */
  reorderCombatant(encounterId: string, combatantId: string, newIndex: number): void {
    const encounter = this.getEncounter(encounterId);
    if (!encounter) return;
    const order = this.combatantsForEncounter(encounterId);
    const combatant = order.find((c) => c.id === combatantId);
    if (!combatant || combatant.removedFromCombat || combatant.onHold) return;

    const rest = order.filter((c) => c.id !== combatantId);
    const above = rest[newIndex - 1] ?? null;
    const below = rest[newIndex] ?? null;
    const total = above
      ? (above.initiativeTotal ?? 0) - 1
      : below
        ? (below.initiativeTotal ?? 0) + 1
        : (combatant.initiativeTotal ?? 0);

    const updated: Combatant = {
      ...combatant,
      initiativeTotal: total,
      lastRoll: total - combatant.initiativeModifier,
    };
    const reordered = insertBySortedPosition(order, updated);
    const activeId = this.activeCombatantId(encounterId);
    this.commitOrder(encounterId, syncHoldPositions(reordered, activeId), activeId);
  }

  advanceTurn(encounterId: string, direction: 'forward' | 'back'): void {
    const encounter = this.getEncounter(encounterId);
    if (!encounter || encounter.activeCombatantIndex === null) return;

    const order = this.combatantsForEncounter(encounterId);
    const activeIndices = order.reduce<number[]>((acc, c, i) => {
      if (!c.removedFromCombat && !c.onHold) acc.push(i);
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
      this.commitOrder(encounterId, syncHoldPositions(order, activeId), activeId);
      return;
    }

    const next = activeIndices.find((i) => i > current);
    if (next !== undefined) {
      const activeId = order[next].id;
      this.commitOrder(encounterId, syncHoldPositions(order, activeId), activeId);
      return;
    }

    // Advancing past the last active combatant starts a new round: the Hold
    // Action list always empties back into the main order here, either with
    // a fresh reroll (default homebrew rule) or each combatant's pre-hold
    // initiative (see clearHoldWithoutReroll/reRollRound for which).
    const nextRound = encounter.round + 1;
    if (!encounter.reRollEachRound) {
      const cleared = clearHoldWithoutReroll(order);
      const nextActiveIndex = firstActiveIndex(cleared);
      const activeId = nextActiveIndex !== null ? cleared[nextActiveIndex].id : null;
      this.commitOrder(encounterId, cleared, activeId);
      this.updateEncounter(encounterId, { round: nextRound, holdOrder: [] });
      return;
    }

    const rolled = reRollRound(order);
    const nextActiveIndex = firstActiveIndex(rolled);
    const activeId = nextActiveIndex !== null ? rolled[nextActiveIndex].id : null;
    this.commitOrder(encounterId, rolled, activeId);
    this.updateEncounter(encounterId, { round: nextRound, holdOrder: [] });
  }
}

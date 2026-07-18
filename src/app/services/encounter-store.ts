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
 * Keeps every on-hold combatant pinned at "one less than the Active
 * combatant's total" — the homebrew rule that a held action is always next
 * in line without ever becoming the Active turn itself. Called after
 * anything that can change who's Active (or the Active combatant's total),
 * so on-hold combatants keep following the Active highlight down the list.
 */
function syncHoldPositions(order: Combatant[], activeId: string | null): Combatant[] {
  const activeTotal = order.find((c) => c.id === activeId)?.initiativeTotal ?? 0;
  return order.reduce((acc, c) => {
    if (!c.onHold || c.id === activeId) return acc;
    const holdTotal = activeTotal - 1;
    if (c.initiativeTotal === holdTotal) return acc;
    return insertBySortedPosition(acc, { ...c, initiativeTotal: holdTotal });
  }, order);
}

/**
 * Rerolls every combatant except Removed (N/A, no roll to make) and on-hold
 * ones (their total is a derived "one less than Active" value fixed up by
 * syncHoldPositions, not a real roll), then sorts the whole order.
 */
export function reRollRound(order: Combatant[]): Combatant[] {
  const rerolled = order.map((c) => {
    if (c.removedFromCombat) return { ...c, lastRoll: null, initiativeTotal: null };
    if (c.onHold) return c;
    return rollInitiativeFor(c);
  });
  return [...rerolled].sort(compareByInitiative);
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
        }),
      ),
    );

    const encounter: Encounter = {
      id: encounterId,
      name,
      partyIds,
      combatantIds: newCombatants.map((c) => c.id),
      activeCombatantIndex: null,
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
    };
    this.combatantsSignal.update((combatants) => [...combatants, npc]);
    this.updateEncounter(encounterId, {
      combatantIds: [...(this.getEncounter(encounterId)?.combatantIds ?? []), npc.id],
    });
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
      });
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
   * Holding an action pins the combatant at "Active total minus one" so
   * they always show as next-in-line; Forward/Back skip them until this is
   * unchecked. If it's the Active combatant choosing to hold, their turn
   * passes immediately (same ordering-then-advancing caveat as
   * toggleRemoved above). Un-holding leaves them wherever they already sat
   * — effectively "jumping into the action" right after the turn that was
   * current when they un-held.
   */
  toggleHoldAction(encounterId: string, combatantId: string): void {
    const encounter = this.getEncounter(encounterId);
    if (!encounter) return;
    const combatant = this.combatantsForEncounter(encounterId).find((c) => c.id === combatantId);
    if (!combatant) return;

    const wasActive = this.activeCombatantId(encounterId) === combatantId;
    const nowOnHold = !combatant.onHold;
    this.updateCombatant(combatantId, { onHold: nowOnHold });
    if (nowOnHold && wasActive) this.advanceTurn(encounterId, 'forward');

    if (!nowOnHold) return; // Un-holding: no repositioning, stay put.

    const activeId = this.activeCombatantId(encounterId);
    const order = this.combatantsForEncounter(encounterId);
    this.commitOrder(encounterId, syncHoldPositions(order, activeId), activeId);
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

    // Advancing past the last active combatant starts a new round.
    const nextRound = encounter.round + 1;
    if (!encounter.reRollEachRound) {
      const activeId = order[activeIndices[0]].id;
      this.commitOrder(encounterId, syncHoldPositions(order, activeId), activeId);
      this.updateEncounter(encounterId, { round: nextRound });
      return;
    }

    const rolled = reRollRound(order);
    const nextActiveIndex = firstActiveIndex(rolled);
    const activeId = nextActiveIndex !== null ? rolled[nextActiveIndex].id : null;
    this.commitOrder(encounterId, syncHoldPositions(rolled, activeId), activeId);
    this.updateEncounter(encounterId, { round: nextRound });
  }
}

export type CombatantType = 'pc' | 'npc';

/**
 * An Encounter-scoped participant. Wraps a PC (via pcId) or is a
 * standalone NPC — see docs/DATA_MODEL.md for why this is a separate
 * entity from PlayerCharacter rather than reusing it directly.
 */
export interface Combatant {
  id: string;
  encounterId: string;
  type: CombatantType;
  pcId: string | null;
  name: string;
  initiativeModifier: number;
  lastRoll: number | null;
  /** null renders as "N/A" and sorts/counts as 0 — see removedFromCombat below. */
  initiativeTotal: number | null;
  /** true = dropped to the bottom of the order with a null (N/A) initiative. */
  removedFromCombat: boolean;
  /** true = holding their action: shown in the secondary Hold Action list
   *  (pinned to the Active combatant's total for display), and skipped by
   *  Forward/Back until unchecked. */
  onHold: boolean;
  /** Snapshot of lastRoll/initiativeTotal taken the moment Hold Action was
   *  turned on. Restored at the next round boundary when reRollEachRound is
   *  false, instead of re-rolling — see EncounterStore.clearHold*. Always
   *  null while onHold is false. */
  preHoldLastRoll: number | null;
  preHoldInitiativeTotal: number | null;
}

export interface Encounter {
  id: string;
  name: string;
  partyIds: string[];
  /** Ordered by initiative descending; this order IS the turn order. */
  combatantIds: string[];
  /** Index into combatantIds; null before the first Roll. */
  activeCombatantIndex: number | null;
  /** Ids of combatants currently on Hold Action, oldest-first — this order
   *  drives the secondary Hold Action list, independent of combatantIds.
   *  Cleared at every round boundary. */
  holdOrder: string[];
  /** Starts at 1 once rolled; 0 beforehand. */
  round: number;
  /** true = re-roll every round (default homebrew rule); false = keep initial order. */
  reRollEachRound: boolean;
}

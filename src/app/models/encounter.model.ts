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
  /** true = holding their action: pinned to one less than the Active combatant's
   *  total (always "on deck"), lightly highlighted, and skipped by Forward/Back
   *  until unchecked. */
  onHold: boolean;
}

export interface Encounter {
  id: string;
  name: string;
  partyIds: string[];
  /** Ordered by initiative descending; this order IS the turn order. */
  combatantIds: string[];
  /** Index into combatantIds; null before the first Roll. */
  activeCombatantIndex: number | null;
  /** Starts at 1 once rolled; 0 beforehand. */
  round: number;
  /** true = re-roll every round (default homebrew rule); false = keep initial order. */
  reRollEachRound: boolean;
}

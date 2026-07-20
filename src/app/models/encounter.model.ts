export type CombatantType = 'pc' | 'npc';

/**
 * An Encounter-scoped participant. Wraps a Player (via playerId) or an Npc
 * (via npcId, when pulled from the library or later saved to it) — see
 * docs/DATA_MODEL.md for why this is a separate entity from Player/Npc
 * rather than reusing either directly.
 */
export interface Combatant {
  id: string;
  encounterId: string;
  type: CombatantType;
  playerId: string | null;
  /** Set when this NPC combatant is linked to a library Npc (pulled in via
   *  a Troop, an individual add, or saved to the roster after the fact).
   *  null for an ad-hoc/unsaved NPC — today's only NPC behavior, still
   *  fully supported. Always null when type === 'pc'. */
  npcId: string | null;
  name: string;
  initiativeModifier: number;
  /** Optional combat stats, copied from the source PC (or set directly for
   *  an NPC) when the Combatant is created — same "own copy" precedent as
   *  name/initiativeModifier above. null/'' means "not set". */
  ac: number | null;
  maxHp: number | null;
  /** Combatant-only — no PC/NPC-library equivalent, since it's inherently
   *  in-combat state (like lastRoll). Starts equal to maxHp, then clamped
   *  to [0, maxHp] on every change (damage/heal or a Max HP edit). */
  currentHp: number | null;
  notes: string;
  lastRoll: number | null;
  /** null renders as "N/A" and sorts/counts as 0 — see removedFromCombat below. */
  initiativeTotal: number | null;
  /** true = dropped to the bottom of the order with a null (N/A) initiative. */
  removedFromCombat: boolean;
  /** true = greyed out and marked as unable to act (unconscious, stunned,
   *  etc.). Purely cosmetic — unlike removedFromCombat/onHold, it doesn't
   *  affect rolling, sorting, or turn order in any way. */
  incapacitated: boolean;
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
  troopIds: string[];
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

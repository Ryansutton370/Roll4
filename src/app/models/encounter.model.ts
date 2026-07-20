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
  /** true = added mid-encounter via the "+" menu (see EncounterDetail),
   *  not yet rolled into the main list. Shown in a separate "Ready to
   *  Join" list; excluded from turn order (firstActiveIndex/advanceTurn's
   *  activeIndices) the same way removedFromCombat/onHold already are.
   *  Cleared either by manually joining (EncounterStore.
   *  joinReadyToJoinCombatant — same roll-capped-below-Active logic as
   *  un-removing) or automatically at the next round boundary. */
  readyToJoin: boolean;
}

/**
 * An Encounter-scoped countdown, created via the same "+" menu as an
 * ad-hoc mid-combat Combatant. Ticks down once per round — either at
 * every round boundary (linkedCombatantId null), or only when the linked
 * combatant's turn ends that round (see EncounterStore.advanceTurn's
 * creditLinkedTimerDeparture/uncreditLinkedTimerOnBack for the tick/untick
 * bookkeeping, and docs/DATA_MODEL.md for the full rationale).
 */
export interface Timer {
  id: string;
  encounterId: string;
  name: string;
  remaining: number;
  /** The value the GM set at creation — never changes afterward. Used only
   *  to compute the light-grey-to-black card background as a percentage
   *  (remaining / initialValue), so a timer that started at 3 and one that
   *  started at 20 both read as "urgent" as they approach their own zero. */
  initialValue: number;
  /** Optional link, chosen at creation from combatants currently in the
   *  main list or Hold Action panel. null = ticks at every round boundary.
   *  Set = ticks when that combatant's turn ends instead (see
   *  EncounterStore.advanceTurn). */
  linkedCombatantId: string | null;
  /** Internal bookkeeping, not GM-facing: the Encounter.round this timer
   *  was last decremented for. A linked timer ticks at most once per
   *  round no matter how many times its combatant's turn "ends" within
   *  that round (normal turn end, going on Hold mid-turn, then later
   *  actually acting after returning from Hold) — this is what makes that
   *  idempotent. null before the first credit, or after Back undoes it. */
  lastTickedRoundCredited: number | null;
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

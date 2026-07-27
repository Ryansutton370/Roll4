/**
 * Shared by Player, Npc, and Combatant — a combatant can roll initiative
 * normally, with Advantage (roll twice, keep the higher), or with
 * Disadvantage (roll twice, keep the lower). Kept in its own file rather
 * than folded into encounter.model.ts so Player/Npc (party.model.ts/
 * npc.model.ts) can use it without depending on the Encounter model for an
 * unrelated concept.
 */
export type InitiativeAdvantageState = 'none' | 'advantage' | 'disadvantage';

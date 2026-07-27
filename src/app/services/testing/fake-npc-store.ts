import { signal } from '@angular/core';
import { InitiativeAdvantageState } from '../../models/initiative-advantage.model';
import { Npc, Troop } from '../../models/npc.model';
import { addNpcIdToTroop, removeNpcIdFromAllTroops, removeNpcIdFromTroop } from '../npc-store';

/**
 * A synchronous, in-memory stand-in for NpcStore, for tests only — same
 * reasoning and shape as FakePartyStore (see fake-party-store.ts). Provide
 * this in place of the real NpcStore
 * (`{ provide: NpcStore, useValue: new FakeNpcStore() }`) in any spec that
 * needs a Troop/Npc fixture to actually exist synchronously.
 */
export class FakeNpcStore {
  private readonly troopsSignal = signal<Troop[]>([]);
  private readonly npcsSignal = signal<Npc[]>([]);
  readonly troops = this.troopsSignal.asReadonly();
  readonly npcs = this.npcsSignal.asReadonly();

  getTroop(id: string) {
    return this.troopsSignal().find((t) => t.id === id);
  }
  getNpc(id: string) {
    return this.npcsSignal().find((n) => n.id === id);
  }
  npcsForTroop(troopId: string) {
    const troop = this.getTroop(troopId);
    if (!troop) return [];
    return this.npcsSignal().filter((n) => troop.npcIds.includes(n.id));
  }
  troopsForNpc(npcId: string) {
    return this.troopsSignal().filter((t) => t.npcIds.includes(npcId));
  }
  createTroop(name: string): Troop {
    const troop: Troop = { id: crypto.randomUUID(), ownerId: 'test-gm', name, npcIds: [] };
    this.troopsSignal.update((troops) => [...troops, troop]);
    return troop;
  }
  renameTroop(id: string, name: string): void {
    this.troopsSignal.update((troops) => troops.map((t) => (t.id === id ? { ...t, name } : t)));
  }
  deleteTroop(id: string): void {
    this.troopsSignal.update((troops) => troops.filter((t) => t.id !== id));
  }
  addNpcToTroop(troopId: string, npcId: string): void {
    this.troopsSignal.update((troops) => addNpcIdToTroop(troops, troopId, npcId));
  }
  removeNpcFromTroop(troopId: string, npcId: string): void {
    this.troopsSignal.update((troops) => removeNpcIdFromTroop(troops, troopId, npcId));
  }
  createNpc(fields: {
    name: string;
    initiativeModifier: number;
    ac: number | null;
    maxHp: number | null;
    notes: string;
    monsterTemplateId?: string | null;
    monsterName?: string | null;
    initiativeAdvantage?: InitiativeAdvantageState;
  }): Npc {
    const npc: Npc = {
      id: crypto.randomUUID(),
      ownerId: 'test-gm',
      ...fields,
      monsterTemplateId: fields.monsterTemplateId ?? null,
      monsterName: fields.monsterName ?? null,
      initiativeAdvantage: fields.initiativeAdvantage ?? 'none',
    };
    this.npcsSignal.update((npcs) => [...npcs, npc]);
    return npc;
  }
  updateNpc(
    id: string,
    changes: Partial<
      Pick<Npc, 'name' | 'initiativeModifier' | 'ac' | 'maxHp' | 'notes' | 'initiativeAdvantage'>
    >,
  ): void {
    this.npcsSignal.update((npcs) => npcs.map((n) => (n.id === id ? { ...n, ...changes } : n)));
  }
  deleteNpc(id: string): void {
    this.npcsSignal.update((npcs) => npcs.filter((n) => n.id !== id));
    this.troopsSignal.update((troops) => removeNpcIdFromAllTroops(troops, id));
  }
}

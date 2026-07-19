import { TestBed } from '@angular/core/testing';

import { NpcStore } from './npc-store';

// Mirrors party-store.spec.ts exactly — NpcStore is a structural mirror of
// PartyStore, so the same behaviors need the same coverage.
const npcFields = { initiativeModifier: 2, ac: null, maxHp: null, notes: '' };

describe('NpcStore', () => {
  let service: NpcStore;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(NpcStore);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('creates a troop with no npcs', () => {
    const troop = service.createTroop('Goblin Warband');

    expect(troop.name).toBe('Goblin Warband');
    expect(troop.npcIds).toEqual([]);
    expect(service.troops()).toEqual([troop]);
  });

  it('creates an npc unattached to any troop', () => {
    const npc = service.createNpc({ name: 'Goblin', ...npcFields });

    expect(service.npcs()).toEqual([npc]);
    expect(service.troopsForNpc(npc.id)).toEqual([]);
  });

  it('stores the optional AC/Max HP/Notes fields', () => {
    const npc = service.createNpc({
      name: 'Goblin Shaman',
      initiativeModifier: 2,
      ac: 13,
      maxHp: 20,
      notes: 'Casts spells from range',
    });

    expect(npc).toMatchObject({ ac: 13, maxHp: 20, notes: 'Casts spells from range' });
  });

  it('adds and removes an npc from a troop', () => {
    const troop = service.createTroop('Goblin Warband');
    const npc = service.createNpc({ name: 'Goblin', ...npcFields });

    service.addNpcToTroop(troop.id, npc.id);
    expect(service.getTroop(troop.id)?.npcIds).toEqual([npc.id]);
    expect(service.npcsForTroop(troop.id)).toEqual([npc]);
    expect(service.troopsForNpc(npc.id)).toEqual([{ ...troop, npcIds: [npc.id] }]);

    service.removeNpcFromTroop(troop.id, npc.id);
    expect(service.getTroop(troop.id)?.npcIds).toEqual([]);
    expect(service.npcsForTroop(troop.id)).toEqual([]);
  });

  it('adding the same npc to a troop twice does not duplicate the membership', () => {
    const troop = service.createTroop('Goblin Warband');
    const npc = service.createNpc({ name: 'Goblin', ...npcFields });

    service.addNpcToTroop(troop.id, npc.id);
    service.addNpcToTroop(troop.id, npc.id);

    expect(service.getTroop(troop.id)?.npcIds).toEqual([npc.id]);
  });

  it('an npc can belong to multiple troops at once', () => {
    const troopA = service.createTroop('Troop A');
    const troopB = service.createTroop('Troop B');
    const npc = service.createNpc({ name: 'Goblin', ...npcFields });

    service.addNpcToTroop(troopA.id, npc.id);
    service.addNpcToTroop(troopB.id, npc.id);

    expect(service.troopsForNpc(npc.id).map((t) => t.name)).toEqual(['Troop A', 'Troop B']);
    expect(service.npcsForTroop(troopA.id)).toEqual([npc]);
    expect(service.npcsForTroop(troopB.id)).toEqual([npc]);
  });

  it('updates an npc in place', () => {
    const npc = service.createNpc({ name: 'Goblin', ...npcFields });

    service.updateNpc(npc.id, { name: 'Goblin Boss', initiativeModifier: 4, ac: 15, maxHp: 20 });

    expect(service.npcs()).toEqual([
      { ...npc, name: 'Goblin Boss', initiativeModifier: 4, ac: 15, maxHp: 20 },
    ]);
  });

  it('deleting a troop does NOT delete its npcs — they stay in the roster', () => {
    const troop = service.createTroop('Goblin Warband');
    const npc = service.createNpc({ name: 'Goblin', ...npcFields });
    service.addNpcToTroop(troop.id, npc.id);

    service.deleteTroop(troop.id);

    expect(service.troops()).toEqual([]);
    expect(service.npcs()).toEqual([npc]);
  });

  it('deleting an npc removes it from every troop it belonged to', () => {
    const troopA = service.createTroop('Troop A');
    const troopB = service.createTroop('Troop B');
    const npc = service.createNpc({ name: 'Goblin', ...npcFields });
    service.addNpcToTroop(troopA.id, npc.id);
    service.addNpcToTroop(troopB.id, npc.id);

    service.deleteNpc(npc.id);

    expect(service.npcs()).toEqual([]);
    expect(service.getTroop(troopA.id)?.npcIds).toEqual([]);
    expect(service.getTroop(troopB.id)?.npcIds).toEqual([]);
  });

  it('persists across service instances via localStorage', () => {
    const troop = service.createTroop('Goblin Warband');
    const npc = service.createNpc({ name: 'Goblin', ...npcFields });
    service.addNpcToTroop(troop.id, npc.id);

    TestBed.tick();

    TestBed.resetTestingModule();
    const reloaded = TestBed.inject(NpcStore);

    expect(reloaded.troops()).toEqual([{ ...troop, npcIds: [npc.id] }]);
    expect(reloaded.npcsForTroop(troop.id).map((n) => n.name)).toEqual(['Goblin']);
  });
});

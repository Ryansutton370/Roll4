import { Troop } from '../models/npc.model';
import { addNpcIdToTroop, removeNpcIdFromAllTroops, removeNpcIdFromTroop } from './npc-store';

// Mirrors party-store.spec.ts exactly — NpcStore is a structural mirror of
// PartyStore, so the same pure-logic coverage applies. See that spec file's
// header comment for why NpcStore itself (thin Firestore glue) isn't
// unit-tested here.

function troop(overrides: Partial<Troop> = {}): Troop {
  return { id: 'troop-a', ownerId: 'gm-1', name: 'Troop A', npcIds: [], ...overrides };
}

describe('addNpcIdToTroop', () => {
  it('adds an npc to the named troop', () => {
    const result = addNpcIdToTroop([troop()], 'troop-a', 'npc-1');
    expect(result).toEqual([troop({ npcIds: ['npc-1'] })]);
  });

  it('does not duplicate an already-present membership', () => {
    const result = addNpcIdToTroop([troop({ npcIds: ['npc-1'] })], 'troop-a', 'npc-1');
    expect(result).toEqual([troop({ npcIds: ['npc-1'] })]);
  });

  it('leaves other troops untouched', () => {
    const other = troop({ id: 'troop-b', name: 'Troop B' });
    const result = addNpcIdToTroop([troop(), other], 'troop-a', 'npc-1');
    expect(result).toEqual([troop({ npcIds: ['npc-1'] }), other]);
  });
});

describe('removeNpcIdFromTroop', () => {
  it('removes an npc from the named troop only', () => {
    const target = troop({ npcIds: ['npc-1', 'npc-2'] });
    const other = troop({ id: 'troop-b', name: 'Troop B', npcIds: ['npc-1'] });
    const result = removeNpcIdFromTroop([target, other], 'troop-a', 'npc-1');
    expect(result).toEqual([troop({ npcIds: ['npc-2'] }), other]);
  });

  it('is a no-op if the npc was never a member', () => {
    const result = removeNpcIdFromTroop([troop()], 'troop-a', 'npc-1');
    expect(result).toEqual([troop()]);
  });
});

describe('removeNpcIdFromAllTroops', () => {
  it('removes the npc from every troop that lists it', () => {
    const troopA = troop({ npcIds: ['npc-1'] });
    const troopB = troop({ id: 'troop-b', name: 'Troop B', npcIds: ['npc-1', 'npc-2'] });
    const result = removeNpcIdFromAllTroops([troopA, troopB], 'npc-1');
    expect(result).toEqual([
      troop({ npcIds: [] }),
      troop({ id: 'troop-b', name: 'Troop B', npcIds: ['npc-2'] }),
    ]);
  });

  it('leaves troops the npc was never in unchanged', () => {
    const result = removeNpcIdFromAllTroops([troop()], 'npc-1');
    expect(result).toEqual([troop()]);
  });
});

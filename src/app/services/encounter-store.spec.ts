import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { Combatant } from '../models/encounter.model';
import { AuthService } from './auth-service';
import {
  EncounterStore,
  clearHoldWithoutReroll,
  compareByInitiative,
  computeDisplayNames,
  firstActiveIndex,
  foldInReadyToJoin,
  reRollRound,
} from './encounter-store';
import { NpcStore } from './npc-store';
import { PartyStore } from './party-store';
import { FakeAuthService } from './testing/fake-auth-service';
import { __resetFakeFirestore } from './testing/fake-firestore';
import { FakeNpcStore } from './testing/fake-npc-store';
import { FakePartyStore } from './testing/fake-party-store';

// EncounterStore is Firestore-backed (see encounter-store.ts) — its own
// business logic (rollInitiative, advanceTurn, Hold Action, Ready to
// Join, Timers, ...) is what this file actually wants to exercise, so
// unlike PartyStore/NpcStore (whose specs were pared down to their
// extracted pure functions once they went Firestore-backed — see
// party-store.spec.ts's header comment), the REAL EncounterStore is still
// instantiated here. That only works because 'firebase/firestore' itself
// is swapped for a synchronous in-memory double (fake-firestore.ts) —
// every setDoc/updateDoc/deleteDoc/writeBatch.commit() call applies
// immediately and synchronously notifies any onSnapshot listener, so
// there's no real network involved and no await/tick needed around
// individual mutations, the same "call a method, assert immediately"
// shape these tests already had against the old localStorage store.
vi.mock('firebase/firestore', async () => {
  const { createFakeFirestoreModule } = await import('./testing/fake-firestore');
  return createFakeFirestoreModule();
});

function combatant(overrides: Partial<Combatant>): Combatant {
  return {
    id: 'c',
    encounterId: 'e',
    ownerId: 'test-gm',
    type: 'npc',
    playerId: null,
    npcId: null,
    name: 'Combatant',
    initiativeModifier: 0,
    ac: null,
    maxHp: null,
    currentHp: null,
    notes: '',
    monsterTemplateId: null,
    monsterName: null,
    lastRoll: null,
    initiativeTotal: null,
    removedFromCombat: false,
    incapacitated: false,
    onHold: false,
    preHoldLastRoll: null,
    preHoldInitiativeTotal: null,
    readyToJoin: false,
    ...overrides,
  };
}

/** Fields for an ad-hoc NPC with no AC/HP/Notes set — most tests only care about name/modifier. */
function npcFields(name: string, initiativeModifier: number) {
  return { name, initiativeModifier, ac: null, maxHp: null, notes: '' };
}

/** Same shape as npcFields, for PartyStore.createPlayer. */
function pcFields(name: string, initiativeModifier: number) {
  return { name, initiativeModifier, ac: null, maxHp: null, notes: '' };
}

/** Creates a Player and adds it to a Party in one step — PartyStore.addPc no longer exists now that creation and Party membership are separate (many-to-many). */
function addPlayerToParty(
  partyStore: FakePartyStore,
  partyId: string,
  fields: { name: string; initiativeModifier: number; ac: number | null; maxHp: number | null; notes: string },
) {
  const player = partyStore.createPlayer(fields);
  partyStore.addPlayerToParty(partyId, player.id);
  return player;
}

/** Npc-side mirror of addPlayerToParty above. */
function addNpcToTroop(
  npcStore: FakeNpcStore,
  troopId: string,
  fields: { name: string; initiativeModifier: number; ac: number | null; maxHp: number | null; notes: string },
) {
  const npc = npcStore.createNpc(fields);
  npcStore.addNpcToTroop(troopId, npc.id);
  return npc;
}

describe('compareByInitiative (pure logic)', () => {
  it('sorts by initiative total descending', () => {
    const low = combatant({ id: 'low', initiativeTotal: 10 });
    const high = combatant({ id: 'high', initiativeTotal: 15 });
    expect(compareByInitiative(high, low)).toBeLessThan(0);
    expect(compareByInitiative(low, high)).toBeGreaterThan(0);
  });

  it('breaks a tied total by the higher Initiative Modifier', () => {
    const lowMod = combatant({ id: 'lowMod', initiativeTotal: 12, initiativeModifier: 0 });
    const highMod = combatant({ id: 'highMod', initiativeTotal: 12, initiativeModifier: 3 });
    expect(compareByInitiative(highMod, lowMod)).toBeLessThan(0);
  });

  it('breaks a fully tied total+modifier by a coin flip', () => {
    const a = combatant({ id: 'a', initiativeTotal: 12, initiativeModifier: 2 });
    const b = combatant({ id: 'b', initiativeTotal: 12, initiativeModifier: 2 });

    const heads = vi.spyOn(Math, 'random').mockReturnValue(0.1);
    expect(compareByInitiative(a, b)).toBeLessThan(0);
    heads.mockReturnValue(0.9);
    expect(compareByInitiative(a, b)).toBeGreaterThan(0);
    heads.mockRestore();
  });

  it('treats a null (N/A) total as 0', () => {
    const removed = combatant({ id: 'removed', initiativeTotal: null });
    const positive = combatant({ id: 'positive', initiativeTotal: 1 });
    expect(compareByInitiative(positive, removed)).toBeLessThan(0);
  });
});

describe('reRollRound (pure logic)', () => {
  it('rerolls active combatants and sorts everyone, giving Removed combatants a null (N/A) total', () => {
    const removed = combatant({ id: 'removed', removedFromCombat: true, lastRoll: 7, initiativeTotal: 7 });
    const a = combatant({ id: 'a', initiativeModifier: 0 });
    const b = combatant({ id: 'b', initiativeModifier: 0 });

    // rollD20 for 'a' then 'b' (removed is skipped, consumes no random call).
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0) // -> roll 1
      .mockReturnValueOnce(0.95); // -> roll 20

    const result = reRollRound([removed, a, b]);

    expect(result.map((c) => c.id)).toEqual(['b', 'a', 'removed']); // b rolled 20, a rolled 1, removed sinks to 0
    expect(result[2].initiativeTotal).toBeNull();
    expect(result[2].lastRoll).toBeNull();

    vi.restoreAllMocks();
  });

  it('clears and rerolls an on-hold combatant too — a new round always empties the Hold Action list', () => {
    const onHold = combatant({
      id: 'held',
      onHold: true,
      lastRoll: 3,
      initiativeTotal: 3,
      preHoldLastRoll: 9,
      preHoldInitiativeTotal: 9,
    });
    const a = combatant({ id: 'a', initiativeModifier: 0 });

    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0.5) // held -> rolls 11
      .mockReturnValueOnce(0); // a -> rolls 1

    const result = reRollRound([onHold, a]);
    const held = result.find((c) => c.id === 'held')!;
    expect(held.onHold).toBe(false);
    expect(held.lastRoll).toBe(11);
    expect(held.initiativeTotal).toBe(11);
    expect(held.preHoldLastRoll).toBeNull();
    expect(held.preHoldInitiativeTotal).toBeNull();

    vi.restoreAllMocks();
  });
});

describe('clearHoldWithoutReroll (pure logic)', () => {
  it('returns the same array reference when nobody is on hold', () => {
    const order = [combatant({ id: 'a' }), combatant({ id: 'b' })];
    expect(clearHoldWithoutReroll(order)).toBe(order);
  });

  it('restores an on-hold combatant to their pre-hold roll and un-sets onHold', () => {
    const active = combatant({ id: 'active', initiativeTotal: 20 });
    const held = combatant({
      id: 'held',
      onHold: true,
      lastRoll: 20,
      initiativeTotal: 20, // pinned to Active while holding
      preHoldLastRoll: 4,
      preHoldInitiativeTotal: 4,
    });

    const result = clearHoldWithoutReroll([active, held]);
    const restored = result.find((c) => c.id === 'held')!;
    expect(restored.onHold).toBe(false);
    expect(restored.lastRoll).toBe(4);
    expect(restored.initiativeTotal).toBe(4);
    expect(restored.preHoldLastRoll).toBeNull();
    expect(restored.preHoldInitiativeTotal).toBeNull();
    expect(result.map((c) => c.id)).toEqual(['active', 'held']); // 4 sorts below 20
  });
});

describe('firstActiveIndex (pure logic)', () => {
  it('finds the first non-removed, non-held combatant', () => {
    const order = [
      combatant({ id: 'a', removedFromCombat: true }),
      combatant({ id: 'b', removedFromCombat: false }),
    ];
    expect(firstActiveIndex(order)).toBe(1);
  });

  it('skips on-hold entries too', () => {
    const order = [combatant({ id: 'a', onHold: true }), combatant({ id: 'b' })];
    expect(firstActiveIndex(order)).toBe(1);
  });

  it('returns null when everyone is removed or on hold', () => {
    const order = [
      combatant({ id: 'a', removedFromCombat: true }),
      combatant({ id: 'b', onHold: true }),
    ];
    expect(firstActiveIndex(order)).toBeNull();
  });

  it('skips Ready to Join entries too', () => {
    const order = [combatant({ id: 'a', readyToJoin: true }), combatant({ id: 'b' })];
    expect(firstActiveIndex(order)).toBe(1);
  });
});

describe('foldInReadyToJoin (pure logic)', () => {
  it('returns the same array reference when nobody is Ready to Join', () => {
    const order = [combatant({ id: 'a' }), combatant({ id: 'b' })];
    expect(foldInReadyToJoin(order)).toBe(order);
  });

  it('gives a Ready to Join combatant a fresh, uncapped roll and un-sets the flag', () => {
    const active = combatant({ id: 'active', initiativeTotal: 3 });
    const pending = combatant({ id: 'pending', readyToJoin: true, initiativeModifier: 0 });

    vi.spyOn(Math, 'random').mockReturnValueOnce(0.95); // -> roll 20
    const result = foldInReadyToJoin([active, pending]);
    vi.restoreAllMocks();

    const joined = result.find((c) => c.id === 'pending')!;
    expect(joined.readyToJoin).toBe(false);
    expect(joined.initiativeTotal).toBe(20); // uncapped — well above Active's 3
    expect(result.map((c) => c.id)).toEqual(['pending', 'active']); // sorted in by the new total
  });
});

describe('computeDisplayNames (pure logic)', () => {
  it('leaves a name with no duplicates unsuffixed', () => {
    const solo = combatant({ id: 'a', name: 'Goblin' });
    const other = combatant({ id: 'b', name: 'Kobold' });
    const displayNames = computeDisplayNames([solo, other]);
    expect(displayNames.get('a')).toBe('Goblin');
    expect(displayNames.get('b')).toBe('Kobold');
  });

  it('suffixes a 2-way duplicate " A"/" B" in creation order', () => {
    const first = combatant({ id: 'a', name: 'Goblin' });
    const second = combatant({ id: 'b', name: 'Goblin' });
    const displayNames = computeDisplayNames([first, second]);
    expect(displayNames.get('a')).toBe('Goblin A');
    expect(displayNames.get('b')).toBe('Goblin B');
  });

  it('suffixes a 3-way duplicate " A"/" B"/" C"', () => {
    const combatants = [
      combatant({ id: 'a', name: 'Goblin' }),
      combatant({ id: 'b', name: 'Goblin' }),
      combatant({ id: 'c', name: 'Goblin' }),
    ];
    const displayNames = computeDisplayNames(combatants);
    expect(displayNames.get('a')).toBe('Goblin A');
    expect(displayNames.get('b')).toBe('Goblin B');
    expect(displayNames.get('c')).toBe('Goblin C');
  });

  it('groups case-insensitively and trims whitespace, but keeps each combatant\'s own casing in the suffixed name', () => {
    const combatants = [
      combatant({ id: 'a', name: 'Goblin' }),
      combatant({ id: 'b', name: 'goblin' }),
      combatant({ id: 'c', name: ' Goblin ' }),
    ];
    const displayNames = computeDisplayNames(combatants);
    expect(displayNames.get('a')).toBe('Goblin A');
    expect(displayNames.get('b')).toBe('goblin B');
    expect(displayNames.get('c')).toBe('Goblin C');
  });

  it('does not change output when only initiative order (not creation order) churns', () => {
    const first = combatant({ id: 'a', name: 'Goblin', initiativeTotal: 5 });
    const second = combatant({ id: 'b', name: 'Goblin', initiativeTotal: 12 });
    const creationOrder = [first, second]; // 'a' created before 'b', regardless of initiative

    const beforeReroll = computeDisplayNames(creationOrder);
    // Simulates a re-roll: initiativeTotal changes, order-in-array (if the
    // caller mistakenly used initiative order) would flip, but creation
    // order — what this function actually takes — doesn't.
    const rerolled = [
      { ...first, initiativeTotal: 18 },
      { ...second, initiativeTotal: 2 },
    ];
    const afterReroll = computeDisplayNames(rerolled);

    expect(afterReroll.get('a')).toBe(beforeReroll.get('a'));
    expect(afterReroll.get('b')).toBe(beforeReroll.get('b'));
  });
});

describe('EncounterStore', () => {
  let service: EncounterStore;
  let partyStore: FakePartyStore;
  let npcStore: FakeNpcStore;

  beforeEach(() => {
    __resetFakeFirestore();
    partyStore = new FakePartyStore();
    npcStore = new FakeNpcStore();
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: new FakeAuthService() },
        { provide: PartyStore, useValue: partyStore },
        { provide: NpcStore, useValue: npcStore },
      ],
    });
    service = TestBed.inject(EncounterStore);
    // Flushes the constructor's effect() — which is what actually
    // subscribes the (fake) Firestore onSnapshot listeners — so every
    // signal is populated (here, with empty arrays) before a test's first
    // mutation call. Without this, the listeners wouldn't exist yet and a
    // write's synchronous notify() would have nothing to call.
    TestBed.tick();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('pulls every PC from the selected Parties in as Combatants', () => {
    const party = partyStore.createParty('Party A');
    const pc = addPlayerToParty(partyStore, party.id, pcFields('Aria', 3));

    const encounter = service.createEncounter('Goblin Ambush', [party.id]);

    const combatants = service.combatantsForEncounter(encounter.id);
    expect(combatants).toHaveLength(1);
    expect(combatants[0]).toMatchObject({
      type: 'pc',
      playerId: pc.id,
      name: 'Aria',
      initiativeModifier: 3,
    });
    expect(encounter.activeCombatantIndex).toBeNull();
    expect(encounter.round).toBe(0);
  });

  it('copies AC/Max HP/Notes onto the Combatant and initializes Current HP to Max HP', () => {
    const party = partyStore.createParty('Party A');
    addPlayerToParty(partyStore, party.id, { name: 'Aria', initiativeModifier: 3, ac: 16, maxHp: 30, notes: 'Longsword' });

    const encounter = service.createEncounter('Goblin Ambush', [party.id]);

    const [aria] = service.combatantsForEncounter(encounter.id);
    expect(aria).toMatchObject({ ac: 16, maxHp: 30, currentHp: 30, notes: 'Longsword' });
  });

  it('adds ad-hoc NPCs to an encounter', () => {
    const encounter = service.createEncounter('Goblin Ambush', []);

    service.addAdHocCombatant(encounter.id, 'npc', npcFields('Goblin 1', 2));

    const combatants = service.combatantsForEncounter(encounter.id);
    expect(combatants.map((c) => c.name)).toEqual(['Goblin 1']);
  });

  it('removeCombatant only works before the first Roll', () => {
    const encounter = service.createEncounter('Goblin Ambush', []);
    service.addAdHocCombatant(encounter.id, 'npc', npcFields('Goblin 1', 2));
    const [npc] = service.combatantsForEncounter(encounter.id);

    service.rollInitiative(encounter.id);
    service.removeCombatant(encounter.id, npc.id);

    expect(service.combatantsForEncounter(encounter.id)).toHaveLength(1);
  });

  it('rollInitiative rolls everyone and starts round 1', () => {
    const encounter = service.createEncounter('Goblin Ambush', []);
    service.addAdHocCombatant(encounter.id, 'npc', npcFields('Goblin 1', 2));
    service.addAdHocCombatant(encounter.id, 'npc', npcFields('Goblin 2', -1));

    service.rollInitiative(encounter.id);

    const updated = service.getEncounter(encounter.id)!;
    expect(updated.round).toBe(1);
    expect(updated.activeCombatantIndex).toBe(0);

    const combatants = service.combatantsForEncounter(encounter.id);
    for (const c of combatants) {
      expect(c.lastRoll).toBeGreaterThanOrEqual(1);
      expect(c.lastRoll).toBeLessThanOrEqual(20);
    }
    // Sorted descending (allowing ties).
    for (let i = 1; i < combatants.length; i++) {
      expect(combatants[i - 1].initiativeTotal!).toBeGreaterThanOrEqual(combatants[i].initiativeTotal!);
    }
  });

  it('advances turns, then wraps into a new round', () => {
    const encounter = service.createEncounter('Goblin Ambush', []);
    // Modifiers far enough apart that roll variance (1-20) can't flip the order.
    service.addAdHocCombatant(encounter.id, 'npc', npcFields('High', 100));
    service.addAdHocCombatant(encounter.id, 'npc', npcFields('Low', -100));
    service.setReRollEachRound(encounter.id, false);
    service.rollInitiative(encounter.id);

    let combatants = service.combatantsForEncounter(encounter.id);
    expect(combatants.map((c) => c.name)).toEqual(['High', 'Low']);
    expect(service.getEncounter(encounter.id)!.activeCombatantIndex).toBe(0);

    service.advanceTurn(encounter.id, 'forward');
    expect(service.getEncounter(encounter.id)!.activeCombatantIndex).toBe(1);
    expect(service.getEncounter(encounter.id)!.round).toBe(1);

    service.advanceTurn(encounter.id, 'forward');
    const wrapped = service.getEncounter(encounter.id)!;
    expect(wrapped.round).toBe(2);
    expect(wrapped.activeCombatantIndex).toBe(0);
    // reRollEachRound is off, so order is untouched.
    combatants = service.combatantsForEncounter(encounter.id);
    expect(combatants.map((c) => c.name)).toEqual(['High', 'Low']);
  });

  it('Back moves to the previous combatant but stops at the start of the round', () => {
    const encounter = service.createEncounter('Goblin Ambush', []);
    service.addAdHocCombatant(encounter.id, 'npc', npcFields('High', 100));
    service.addAdHocCombatant(encounter.id, 'npc', npcFields('Low', -100));
    service.rollInitiative(encounter.id);

    service.advanceTurn(encounter.id, 'forward'); // now on Low
    service.advanceTurn(encounter.id, 'back'); // back to High
    expect(service.getEncounter(encounter.id)!.activeCombatantIndex).toBe(0);

    service.advanceTurn(encounter.id, 'back'); // no-op, already first
    expect(service.getEncounter(encounter.id)!.activeCombatantIndex).toBe(0);
  });

  it('toggling Removed on the active combatant auto-advances the turn', () => {
    const encounter = service.createEncounter('Goblin Ambush', []);
    service.addAdHocCombatant(encounter.id, 'npc', npcFields('High', 100));
    service.addAdHocCombatant(encounter.id, 'npc', npcFields('Low', -100));
    service.rollInitiative(encounter.id);

    const [high] = service.combatantsForEncounter(encounter.id);
    service.toggleRemoved(encounter.id, high.id);

    const updated = service.getEncounter(encounter.id)!;
    const combatants = service.combatantsForEncounter(encounter.id);
    expect(combatants.find((c) => c.id === high.id)?.removedFromCombat).toBe(true);
    expect(combatants[updated.activeCombatantIndex!].name).toBe('Low');
    // Should advance within the same round, not spuriously trigger a re-roll.
    expect(updated.round).toBe(1);
  });

  it('removing the active combatant in the middle of the order advances to the one after it', () => {
    // Regression test: with a combatant *after* the removed one, a buggy
    // lookup (indexOf on an index that toggleRemoved had just excluded from
    // the active set) fell through to "start a new round" instead of
    // advancing to the correct next combatant.
    const encounter = service.createEncounter('Goblin Ambush', []);
    service.addAdHocCombatant(encounter.id, 'npc', npcFields('High', 100));
    service.addAdHocCombatant(encounter.id, 'npc', npcFields('Mid', 0));
    service.addAdHocCombatant(encounter.id, 'npc', npcFields('Low', -100));
    service.rollInitiative(encounter.id);
    service.advanceTurn(encounter.id, 'forward'); // active is now Mid

    const [, mid] = service.combatantsForEncounter(encounter.id);
    service.toggleRemoved(encounter.id, mid.id);

    const updated = service.getEncounter(encounter.id)!;
    const combatants = service.combatantsForEncounter(encounter.id);
    expect(combatants[updated.activeCombatantIndex!].name).toBe('Low');
    expect(updated.round).toBe(1);
  });

  it('toggling Removed sets initiative to N/A (null) and sinks the combatant to the bottom of the order', () => {
    const encounter = service.createEncounter('Goblin Ambush', []);
    service.addAdHocCombatant(encounter.id, 'npc', npcFields('A', 0));
    service.addAdHocCombatant(encounter.id, 'npc', npcFields('B', 0));
    service.addAdHocCombatant(encounter.id, 'npc', npcFields('C', 0));

    // In add order A, B, C: rolls of 1, 11, 20 -> sorted order becomes C, B, A.
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0) // A -> 1
      .mockReturnValueOnce(0.5) // B -> 11
      .mockReturnValueOnce(0.95); // C -> 20
    service.rollInitiative(encounter.id);
    vi.restoreAllMocks();

    expect(service.combatantsForEncounter(encounter.id).map((c) => c.name)).toEqual(['C', 'B', 'A']);

    const [, b] = service.combatantsForEncounter(encounter.id); // 'B', not Active
    service.toggleRemoved(encounter.id, b.id);

    const combatants = service.combatantsForEncounter(encounter.id);
    const removed = combatants.find((c) => c.id === b.id)!;
    expect(removed.initiativeTotal).toBeNull();
    expect(removed.lastRoll).toBeNull();
    expect(combatants.map((c) => c.name)).toEqual(['C', 'A', 'B']); // sank below A (total 1 > N/A's 0)
  });

  it('un-removing rolls a fresh initiative capped below the Active total and reinserts there', () => {
    const encounter = service.createEncounter('Goblin Ambush', []);
    service.addAdHocCombatant(encounter.id, 'npc', npcFields('A', 15));
    service.addAdHocCombatant(encounter.id, 'npc', npcFields('B', 0));

    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0) // A -> roll 1, total 16
      .mockReturnValueOnce(0); // B -> roll 1, total 1
    service.rollInitiative(encounter.id);
    vi.restoreAllMocks();

    const [a, b] = service.combatantsForEncounter(encounter.id); // A (16, Active), B (1)
    service.toggleRemoved(encounter.id, b.id); // B -> N/A

    // A natural roll of 20 (+0 modifier = 20) would exceed A's total of 16,
    // so it must be clamped down to 15 (one less than Active).
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.95);
    service.toggleRemoved(encounter.id, b.id); // un-remove
    vi.restoreAllMocks();

    const combatants = service.combatantsForEncounter(encounter.id);
    const rejoined = combatants.find((c) => c.id === b.id)!;
    expect(rejoined.removedFromCombat).toBe(false);
    expect(rejoined.initiativeTotal).toBe(a.initiativeTotal! - 1);
    expect(combatants.map((c) => c.id)).toEqual([a.id, b.id]); // reinserted right below Active
  });

  it('holding a combatant pins their displayed initiative to the Active total and adds them to holdOrder', () => {
    const encounter = service.createEncounter('Goblin Ambush', []);
    service.addAdHocCombatant(encounter.id, 'npc', npcFields('High', 100));
    service.addAdHocCombatant(encounter.id, 'npc', npcFields('Mid', 0));
    service.addAdHocCombatant(encounter.id, 'npc', npcFields('Low', -100));
    service.rollInitiative(encounter.id); // order: High (Active), Mid, Low

    const [high, , low] = service.combatantsForEncounter(encounter.id);
    service.toggleHoldAction(encounter.id, low.id);

    const updated = service.getEncounter(encounter.id)!;
    const combatants = service.combatantsForEncounter(encounter.id);
    const held = combatants.find((c) => c.id === low.id)!;
    expect(held.onHold).toBe(true);
    expect(held.initiativeTotal).toBe(high.initiativeTotal);
    expect(updated.holdOrder).toEqual([low.id]);
    expect(updated.activeCombatantIndex).toBe(0); // High is still Active
  });

  it('tracks Hold Action order by insertion, not initiative — first to hold sorts first', () => {
    const encounter = service.createEncounter('Goblin Ambush', []);
    service.addAdHocCombatant(encounter.id, 'npc', npcFields('High', 100));
    service.addAdHocCombatant(encounter.id, 'npc', npcFields('Mid', 0));
    service.addAdHocCombatant(encounter.id, 'npc', npcFields('Low', -100));
    service.rollInitiative(encounter.id);

    const [, mid, low] = service.combatantsForEncounter(encounter.id);
    service.toggleHoldAction(encounter.id, low.id); // Low holds first
    service.toggleHoldAction(encounter.id, mid.id); // Mid holds second

    expect(service.getEncounter(encounter.id)!.holdOrder).toEqual([low.id, mid.id]);
  });

  it('returnFromHold "above" places the combatant above Active and makes them the new Active — interrupting', () => {
    const encounter = service.createEncounter('Goblin Ambush', []);
    service.addAdHocCombatant(encounter.id, 'npc', npcFields('High', 100));
    service.addAdHocCombatant(encounter.id, 'npc', npcFields('Mid', 0));
    service.addAdHocCombatant(encounter.id, 'npc', npcFields('Low', -100));
    service.rollInitiative(encounter.id); // order: High (Active), Mid, Low

    const [high, mid, low] = service.combatantsForEncounter(encounter.id);
    service.toggleHoldAction(encounter.id, low.id);
    service.returnFromHold(encounter.id, low.id, 'above');

    const updated = service.getEncounter(encounter.id)!;
    const combatants = service.combatantsForEncounter(encounter.id);
    const returned = combatants.find((c) => c.id === low.id)!;
    expect(returned.onHold).toBe(false);
    expect(returned.initiativeTotal).toBe(high.initiativeTotal! + 1);
    expect(updated.holdOrder).toEqual([]);
    expect(combatants.map((c) => c.id)).toEqual([low.id, high.id, mid.id]); // above Active
    expect(combatants[updated.activeCombatantIndex!].id).toBe(low.id); // interrupted: now Active

    // High never got to act this round — Forward should land back on them,
    // resuming right where the interrupt happened.
    service.advanceTurn(encounter.id, 'forward');
    const afterForward = service.getEncounter(encounter.id)!;
    const combatantsAfter = service.combatantsForEncounter(encounter.id);
    expect(combatantsAfter[afterForward.activeCombatantIndex!].id).toBe(high.id);
  });

  it('returnFromHold "below" places the combatant below Active, without disturbing whose turn it is', () => {
    const encounter = service.createEncounter('Goblin Ambush', []);
    service.addAdHocCombatant(encounter.id, 'npc', npcFields('High', 100));
    service.addAdHocCombatant(encounter.id, 'npc', npcFields('Mid', 0));
    service.addAdHocCombatant(encounter.id, 'npc', npcFields('Low', -100));
    service.rollInitiative(encounter.id);

    const [high, , low] = service.combatantsForEncounter(encounter.id);
    service.toggleHoldAction(encounter.id, low.id);
    service.returnFromHold(encounter.id, low.id, 'below');

    const updated = service.getEncounter(encounter.id)!;
    const combatants = service.combatantsForEncounter(encounter.id);
    const returned = combatants.find((c) => c.id === low.id)!;
    expect(returned.initiativeTotal).toBe(high.initiativeTotal! - 1);
    expect(combatants[0].id).toBe(high.id);
    expect(combatants[1].id).toBe(low.id); // below Active, above whoever was already there
    expect(combatants[updated.activeCombatantIndex!].id).toBe(high.id); // still High's turn
  });

  describe('reorderCombatant (manual drag reordering)', () => {
    function rollThreeDeterministic(encounterId: string): void {
      // A -> 1, B -> 11, C -> 20 (all modifier 0) -> sorted order C, B, A.
      vi.spyOn(Math, 'random')
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(0.5)
        .mockReturnValueOnce(0.95);
      service.rollInitiative(encounterId);
      vi.restoreAllMocks();
    }

    it('moves a combatant to the top, one above its new upper neighbor', () => {
      const encounter = service.createEncounter('Goblin Ambush', []);
      service.addAdHocCombatant(encounter.id, 'npc', npcFields('A', 0));
      service.addAdHocCombatant(encounter.id, 'npc', npcFields('B', 0));
      service.addAdHocCombatant(encounter.id, 'npc', npcFields('C', 0));
      rollThreeDeterministic(encounter.id);
      expect(service.combatantsForEncounter(encounter.id).map((c) => c.name)).toEqual(['C', 'B', 'A']);

      const [c, , a] = service.combatantsForEncounter(encounter.id);
      service.reorderCombatant(encounter.id, a.id, 0); // drag A to the very top

      const combatants = service.combatantsForEncounter(encounter.id);
      expect(combatants.map((cc) => cc.name)).toEqual(['A', 'C', 'B']);
      expect(combatants.find((cc) => cc.id === a.id)!.initiativeTotal).toBe(c.initiativeTotal! + 1);
    });

    it('moves a combatant to the bottom, one below its new lower neighbor', () => {
      const encounter = service.createEncounter('Goblin Ambush', []);
      service.addAdHocCombatant(encounter.id, 'npc', npcFields('A', 0));
      service.addAdHocCombatant(encounter.id, 'npc', npcFields('B', 0));
      service.addAdHocCombatant(encounter.id, 'npc', npcFields('C', 0));
      rollThreeDeterministic(encounter.id);

      const [c] = service.combatantsForEncounter(encounter.id);
      service.reorderCombatant(encounter.id, c.id, 2); // drag C (top) to the very bottom

      const combatants = service.combatantsForEncounter(encounter.id);
      expect(combatants.map((cc) => cc.name)).toEqual(['B', 'A', 'C']);
      const a = combatants.find((cc) => cc.name === 'A')!;
      expect(combatants.find((cc) => cc.id === c.id)!.initiativeTotal).toBe(a.initiativeTotal! - 1);
    });

    it('combatantsForEncounterInCreationOrder stays in add order regardless of roll/reorder', () => {
      const encounter = service.createEncounter('Goblin Ambush', []);
      service.addAdHocCombatant(encounter.id, 'npc', npcFields('A', 0));
      service.addAdHocCombatant(encounter.id, 'npc', npcFields('B', 0));
      service.addAdHocCombatant(encounter.id, 'npc', npcFields('C', 0));
      rollThreeDeterministic(encounter.id);
      expect(service.combatantsForEncounter(encounter.id).map((c) => c.name)).toEqual(['C', 'B', 'A']);

      const [c] = service.combatantsForEncounter(encounter.id);
      service.reorderCombatant(encounter.id, c.id, 2);
      expect(service.combatantsForEncounter(encounter.id).map((cc) => cc.name)).toEqual(['B', 'A', 'C']);

      // Initiative order above got fully scrambled by the roll + reorder —
      // creation order, what computeDisplayNames' "A"/"B" lettering
      // actually depends on, never moves.
      expect(service.combatantsForEncounterInCreationOrder(encounter.id).map((cc) => cc.name)).toEqual([
        'A',
        'B',
        'C',
      ]);
    });

    it('moves a combatant to a middle position, one below its new upper neighbor', () => {
      const encounter = service.createEncounter('Goblin Ambush', []);
      service.addAdHocCombatant(encounter.id, 'npc', npcFields('A', 0));
      service.addAdHocCombatant(encounter.id, 'npc', npcFields('B', 0));
      service.addAdHocCombatant(encounter.id, 'npc', npcFields('C', 0));
      rollThreeDeterministic(encounter.id);

      const [c, , a] = service.combatantsForEncounter(encounter.id);
      service.reorderCombatant(encounter.id, a.id, 1); // drag A to between C and B

      const combatants = service.combatantsForEncounter(encounter.id);
      expect(combatants.map((cc) => cc.name)).toEqual(['C', 'A', 'B']);
      expect(combatants.find((cc) => cc.id === a.id)!.initiativeTotal).toBe(c.initiativeTotal! - 1);
    });

    it('drops into place between two tied neighbors instead of sinking to the bottom', () => {
      // Regression test: Gozer/Edgar both roll a total of 6 (tie broken by
      // modifier, not the coin flip, so this stays deterministic), Goblin
      // rolls 5. Dragging Goblin up between the tied pair used to compute
      // above.total - 1 === 5 — Goblin's own total — so it re-sorted right
      // back to the bottom instead of landing where it was dropped.
      const encounter = service.createEncounter('Goblin Ambush', []);
      service.addAdHocCombatant(encounter.id, 'npc', npcFields('Gozer', 5));
      service.addAdHocCombatant(encounter.id, 'npc', npcFields('Edgar', 4));
      service.addAdHocCombatant(encounter.id, 'npc', npcFields('Goblin', 3));
      vi.spyOn(Math, 'random')
        .mockReturnValueOnce(0) // Gozer -> roll 1, total 6
        .mockReturnValueOnce(0.05) // Edgar -> roll 2, total 6
        .mockReturnValueOnce(0.05); // Goblin -> roll 2, total 5
      service.rollInitiative(encounter.id);
      vi.restoreAllMocks();
      expect(service.combatantsForEncounter(encounter.id).map((c) => c.name)).toEqual([
        'Gozer',
        'Edgar',
        'Goblin',
      ]);

      const [, , goblin] = service.combatantsForEncounter(encounter.id);
      service.reorderCombatant(encounter.id, goblin.id, 1); // drag Goblin between Gozer and Edgar

      const combatants = service.combatantsForEncounter(encounter.id);
      expect(combatants.map((cc) => cc.name)).toEqual(['Gozer', 'Goblin', 'Edgar']);
      expect(combatants.find((cc) => cc.id === goblin.id)!.initiativeTotal).toBe(6);
    });

    it('is a no-op for a Removed combatant', () => {
      const encounter = service.createEncounter('Goblin Ambush', []);
      service.addAdHocCombatant(encounter.id, 'npc', npcFields('A', 0));
      service.addAdHocCombatant(encounter.id, 'npc', npcFields('B', 0));
      service.rollInitiative(encounter.id);

      const [a] = service.combatantsForEncounter(encounter.id);
      service.toggleRemoved(encounter.id, a.id);
      const before = service.combatantsForEncounter(encounter.id);

      service.reorderCombatant(encounter.id, a.id, 0);

      expect(service.combatantsForEncounter(encounter.id)).toEqual(before);
    });

    it('is a no-op for an on-hold combatant', () => {
      const encounter = service.createEncounter('Goblin Ambush', []);
      service.addAdHocCombatant(encounter.id, 'npc', npcFields('A', 0));
      service.addAdHocCombatant(encounter.id, 'npc', npcFields('B', 0));
      service.rollInitiative(encounter.id);

      const [a] = service.combatantsForEncounter(encounter.id);
      service.toggleHoldAction(encounter.id, a.id);
      const before = service.combatantsForEncounter(encounter.id);

      service.reorderCombatant(encounter.id, a.id, 0);

      expect(service.combatantsForEncounter(encounter.id)).toEqual(before);
    });
  });

  it('a new round clears holdOrder and returns held combatants to the main list, rerolled by default', () => {
    const encounter = service.createEncounter('Goblin Ambush', []);
    service.addAdHocCombatant(encounter.id, 'npc', npcFields('High', 100));
    service.addAdHocCombatant(encounter.id, 'npc', npcFields('Mid', 0));
    service.addAdHocCombatant(encounter.id, 'npc', npcFields('Low', -100));
    service.rollInitiative(encounter.id);

    const [, mid] = service.combatantsForEncounter(encounter.id);
    service.toggleHoldAction(encounter.id, mid.id);
    service.advanceTurn(encounter.id, 'forward'); // High -> Low (Mid held, skipped)
    service.advanceTurn(encounter.id, 'forward'); // wraps into round 2, clearing the hold

    const updated = service.getEncounter(encounter.id)!;
    expect(updated.round).toBe(2);
    expect(updated.holdOrder).toEqual([]);
    const combatants = service.combatantsForEncounter(encounter.id);
    expect(combatants.find((c) => c.id === mid.id)?.onHold).toBe(false);
  });

  it('a new round restores the pre-hold initiative instead of rerolling when reRollEachRound is off', () => {
    const encounter = service.createEncounter('Goblin Ambush', []);
    service.addAdHocCombatant(encounter.id, 'npc', npcFields('High', 100));
    service.addAdHocCombatant(encounter.id, 'npc', npcFields('Mid', 0));
    service.addAdHocCombatant(encounter.id, 'npc', npcFields('Low', -100));
    service.setReRollEachRound(encounter.id, false);
    service.rollInitiative(encounter.id);

    const [, mid] = service.combatantsForEncounter(encounter.id);
    const midRollBeforeHold = mid.initiativeTotal;
    service.toggleHoldAction(encounter.id, mid.id);
    service.advanceTurn(encounter.id, 'forward'); // High -> Low
    service.advanceTurn(encounter.id, 'forward'); // wraps into round 2, clearing the hold

    const updated = service.getEncounter(encounter.id)!;
    expect(updated.round).toBe(2);
    expect(updated.holdOrder).toEqual([]);
    const restored = service.combatantsForEncounter(encounter.id).find((c) => c.id === mid.id)!;
    expect(restored.onHold).toBe(false);
    expect(restored.initiativeTotal).toBe(midRollBeforeHold);
  });

  it('Forward skips on-hold combatants', () => {
    const encounter = service.createEncounter('Goblin Ambush', []);
    service.addAdHocCombatant(encounter.id, 'npc', npcFields('High', 100));
    service.addAdHocCombatant(encounter.id, 'npc', npcFields('Mid', 0));
    service.addAdHocCombatant(encounter.id, 'npc', npcFields('Low', -100));
    service.rollInitiative(encounter.id);

    const [, mid] = service.combatantsForEncounter(encounter.id);
    service.toggleHoldAction(encounter.id, mid.id);
    service.advanceTurn(encounter.id, 'forward');

    const updated = service.getEncounter(encounter.id)!;
    const combatants = service.combatantsForEncounter(encounter.id);
    expect(combatants[updated.activeCombatantIndex!].name).toBe('Low');
  });

  it('un-holding leaves the combatant in place, so the next Forward lands on them', () => {
    const encounter = service.createEncounter('Goblin Ambush', []);
    service.addAdHocCombatant(encounter.id, 'npc', npcFields('High', 100));
    service.addAdHocCombatant(encounter.id, 'npc', npcFields('Mid', 0));
    service.addAdHocCombatant(encounter.id, 'npc', npcFields('Low', -100));
    service.rollInitiative(encounter.id);

    const [, mid] = service.combatantsForEncounter(encounter.id);
    service.toggleHoldAction(encounter.id, mid.id); // hold
    service.toggleHoldAction(encounter.id, mid.id); // un-hold

    service.advanceTurn(encounter.id, 'forward');

    const updated = service.getEncounter(encounter.id)!;
    const combatants = service.combatantsForEncounter(encounter.id);
    expect(combatants.find((c) => c.id === mid.id)?.onHold).toBe(false);
    expect(combatants[updated.activeCombatantIndex!].name).toBe('Mid');
  });

  it('renameEncounter updates the name only', () => {
    const encounter = service.createEncounter('Goblin Ambush', []);
    service.renameEncounter(encounter.id, 'Goblin Ambush Redux');
    expect(service.getEncounter(encounter.id)!.name).toBe('Goblin Ambush Redux');
  });

  describe('setEncounterParties', () => {
    it('pulls in PCs from a newly-selected Party', () => {
      const partyA = partyStore.createParty('Party A');
      const pcA = addPlayerToParty(partyStore, partyA.id, pcFields('Aria', 3));
      const encounter = service.createEncounter('Goblin Ambush', []);

      service.setEncounterParties(encounter.id, [partyA.id]);

      const combatants = service.combatantsForEncounter(encounter.id);
      expect(combatants).toHaveLength(1);
      expect(combatants[0]).toMatchObject({ type: 'pc', playerId: pcA.id, name: 'Aria' });
      expect(service.getEncounter(encounter.id)!.partyIds).toEqual([partyA.id]);
    });

    it('drops PCs from a de-selected Party before the first Roll', () => {
      const partyA = partyStore.createParty('Party A');
      addPlayerToParty(partyStore, partyA.id, pcFields('Aria', 3));
      const encounter = service.createEncounter('Goblin Ambush', [partyA.id]);
      expect(service.combatantsForEncounter(encounter.id)).toHaveLength(1);

      service.setEncounterParties(encounter.id, []);

      expect(service.combatantsForEncounter(encounter.id)).toHaveLength(0);
      expect(service.getEncounter(encounter.id)!.partyIds).toEqual([]);
    });

    it('leaves already-in-combat PCs alone when their Party is de-selected after the first Roll', () => {
      const partyA = partyStore.createParty('Party A');
      addPlayerToParty(partyStore, partyA.id, pcFields('Aria', 3));
      const encounter = service.createEncounter('Goblin Ambush', [partyA.id]);
      service.rollInitiative(encounter.id);

      service.setEncounterParties(encounter.id, []);

      expect(service.combatantsForEncounter(encounter.id)).toHaveLength(1);
      // The Party selection itself still updates even though the combatant stays.
      expect(service.getEncounter(encounter.id)!.partyIds).toEqual([]);
    });

    it('does not duplicate a PC already pulled in from another selected Party', () => {
      const partyA = partyStore.createParty('Party A');
      const pc = addPlayerToParty(partyStore, partyA.id, pcFields('Aria', 3));
      const encounter = service.createEncounter('Goblin Ambush', [partyA.id]);

      // Re-selecting the same Party (e.g. alongside a newly-added one) shouldn't add a duplicate.
      service.setEncounterParties(encounter.id, [partyA.id]);

      const combatants = service.combatantsForEncounter(encounter.id);
      expect(combatants.filter((c) => c.playerId === pc.id)).toHaveLength(1);
    });
  });

  it('holding your own action while Active passes the turn, moving you into the Hold Action list', () => {
    const encounter = service.createEncounter('Goblin Ambush', []);
    service.addAdHocCombatant(encounter.id, 'npc', npcFields('High', 100));
    service.addAdHocCombatant(encounter.id, 'npc', npcFields('Mid', 0));
    service.addAdHocCombatant(encounter.id, 'npc', npcFields('Low', -100));
    service.rollInitiative(encounter.id);

    const [high] = service.combatantsForEncounter(encounter.id);
    service.toggleHoldAction(encounter.id, high.id);

    const updated = service.getEncounter(encounter.id)!;
    const combatants = service.combatantsForEncounter(encounter.id);
    expect(combatants[updated.activeCombatantIndex!].name).toBe('Mid');
    expect(combatants.find((c) => c.id === high.id)?.onHold).toBe(true);
    expect(updated.holdOrder).toEqual([high.id]);
    expect(updated.round).toBe(1);
  });

  describe('updateCombatantDetails', () => {
    it('applies name/ac/maxHp/notes unconditionally', () => {
      const encounter = service.createEncounter('Goblin Ambush', []);
      service.addAdHocCombatant(encounter.id, 'npc', npcFields('Goblin', 2));
      const [npc] = service.combatantsForEncounter(encounter.id);

      service.updateCombatantDetails(encounter.id, npc.id, {
        name: 'Goblin Boss',
        ac: 15,
        maxHp: 20,
        notes: 'Wears a crown',
      });

      const updated = service.combatantsForEncounter(encounter.id)[0];
      expect(updated).toMatchObject({
        name: 'Goblin Boss',
        ac: 15,
        maxHp: 20,
        currentHp: 20,
        notes: 'Wears a crown',
      });
    });

    it('keeps the "initiative modifier locked after the first Roll" rule', () => {
      const encounter = service.createEncounter('Goblin Ambush', []);
      service.addAdHocCombatant(encounter.id, 'npc', npcFields('Goblin', 2));
      const [npc] = service.combatantsForEncounter(encounter.id);
      service.rollInitiative(encounter.id);

      service.updateCombatantDetails(encounter.id, npc.id, { initiativeModifier: 10, name: 'Goblin Boss' });

      const updated = service.combatantsForEncounter(encounter.id).find((c) => c.id === npc.id)!;
      expect(updated.initiativeModifier).toBe(2); // unchanged
      expect(updated.name).toBe('Goblin Boss'); // other fields still applied
    });

    it('reclamps currentHp into a lowered maxHp instead of resetting to full', () => {
      const encounter = service.createEncounter('Goblin Ambush', []);
      service.addAdHocCombatant(encounter.id, 'npc',{ name: 'Goblin', initiativeModifier: 2, ac: null, maxHp: 30, notes: '' });
      const [npc] = service.combatantsForEncounter(encounter.id);
      service.adjustCurrentHp(encounter.id, npc.id, -25); // 30 -> 5

      service.updateCombatantDetails(encounter.id, npc.id, { maxHp: 10 });

      const updated = service.combatantsForEncounter(encounter.id)[0];
      expect(updated.currentHp).toBe(5); // preserved, still within [0, 10]
      expect(updated.maxHp).toBe(10);
    });
  });

  describe('adjustCurrentHp', () => {
    it('applies a signed delta, clamped at 0', () => {
      const encounter = service.createEncounter('Goblin Ambush', []);
      service.addAdHocCombatant(encounter.id, 'npc',{ name: 'Goblin', initiativeModifier: 2, ac: null, maxHp: 7, notes: '' });
      const [npc] = service.combatantsForEncounter(encounter.id);

      service.adjustCurrentHp(encounter.id, npc.id, -100);

      expect(service.combatantsForEncounter(encounter.id)[0].currentHp).toBe(0);
    });

    it('clamps healing at maxHp', () => {
      const encounter = service.createEncounter('Goblin Ambush', []);
      service.addAdHocCombatant(encounter.id, 'npc',{ name: 'Goblin', initiativeModifier: 2, ac: null, maxHp: 7, notes: '' });
      const [npc] = service.combatantsForEncounter(encounter.id);
      service.adjustCurrentHp(encounter.id, npc.id, -5); // 7 -> 2

      service.adjustCurrentHp(encounter.id, npc.id, 100);

      expect(service.combatantsForEncounter(encounter.id)[0].currentHp).toBe(7);
    });

    it('is a no-op when maxHp is not set — nothing to track', () => {
      const encounter = service.createEncounter('Goblin Ambush', []);
      service.addAdHocCombatant(encounter.id, 'npc', npcFields('Goblin', 2));
      const [npc] = service.combatantsForEncounter(encounter.id);

      service.adjustCurrentHp(encounter.id, npc.id, -5);

      expect(service.combatantsForEncounter(encounter.id)[0].currentHp).toBeNull();
    });
  });

  describe('setEncounterTroops', () => {
    it('pulls in NPCs from a newly-selected Troop', () => {
      const troopA = npcStore.createTroop('Troop A');
      const npcA = addNpcToTroop(npcStore, troopA.id, npcFields('Goblin', 2));
      const encounter = service.createEncounter('Goblin Ambush', []);

      service.setEncounterTroops(encounter.id, [troopA.id]);

      const combatants = service.combatantsForEncounter(encounter.id);
      expect(combatants).toHaveLength(1);
      expect(combatants[0]).toMatchObject({ type: 'npc', npcId: npcA.id, name: 'Goblin' });
      expect(service.getEncounter(encounter.id)!.troopIds).toEqual([troopA.id]);
    });

    it('drops NPCs from a de-selected Troop before the first Roll', () => {
      const troopA = npcStore.createTroop('Troop A');
      addNpcToTroop(npcStore, troopA.id, npcFields('Goblin', 2));
      const encounter = service.createEncounter('Goblin Ambush', [], [troopA.id]);
      expect(service.combatantsForEncounter(encounter.id)).toHaveLength(1);

      service.setEncounterTroops(encounter.id, []);

      expect(service.combatantsForEncounter(encounter.id)).toHaveLength(0);
      expect(service.getEncounter(encounter.id)!.troopIds).toEqual([]);
    });

    it('leaves already-in-combat NPCs alone when their Troop is de-selected after the first Roll', () => {
      const troopA = npcStore.createTroop('Troop A');
      addNpcToTroop(npcStore, troopA.id, npcFields('Goblin', 2));
      const encounter = service.createEncounter('Goblin Ambush', [], [troopA.id]);
      service.rollInitiative(encounter.id);

      service.setEncounterTroops(encounter.id, []);

      expect(service.combatantsForEncounter(encounter.id)).toHaveLength(1);
      expect(service.getEncounter(encounter.id)!.troopIds).toEqual([]);
    });

    it('does not duplicate an NPC already pulled in from another selected Troop', () => {
      const troopA = npcStore.createTroop('Troop A');
      const npc = addNpcToTroop(npcStore, troopA.id, npcFields('Goblin', 2));
      const encounter = service.createEncounter('Goblin Ambush', [], [troopA.id]);

      service.setEncounterTroops(encounter.id, [troopA.id]);

      const combatants = service.combatantsForEncounter(encounter.id);
      expect(combatants.filter((c) => c.npcId === npc.id)).toHaveLength(1);
    });
  });

  describe('addPlayerCombatant / addNpcCombatant (individual roster pulls)', () => {
    it('pulls in a single roster Player as a Combatant', () => {
      const party = partyStore.createParty('Party A');
      const player = addPlayerToParty(partyStore, party.id, pcFields('Aria', 3));
      const encounter = service.createEncounter('Goblin Ambush', []);

      service.addPlayerCombatant(encounter.id, player.id);

      const combatants = service.combatantsForEncounter(encounter.id);
      expect(combatants).toHaveLength(1);
      expect(combatants[0]).toMatchObject({ type: 'pc', playerId: player.id, name: 'Aria' });
    });

    it('pulls in a single roster Npc as a Combatant', () => {
      const troop = npcStore.createTroop('Troop A');
      const npc = addNpcToTroop(npcStore, troop.id, npcFields('Goblin', 2));
      const encounter = service.createEncounter('Goblin Ambush', []);

      service.addNpcCombatant(encounter.id, npc.id);

      const combatants = service.combatantsForEncounter(encounter.id);
      expect(combatants).toHaveLength(1);
      expect(combatants[0]).toMatchObject({ type: 'npc', npcId: npc.id, name: 'Goblin' });
    });

    it('is a no-op when the Player/Npc is already present in the Encounter', () => {
      const party = partyStore.createParty('Party A');
      const player = addPlayerToParty(partyStore, party.id, pcFields('Aria', 3));
      const encounter = service.createEncounter('Goblin Ambush', []);

      service.addPlayerCombatant(encounter.id, player.id);
      service.addPlayerCombatant(encounter.id, player.id);

      expect(service.combatantsForEncounter(encounter.id)).toHaveLength(1);
    });
  });

  describe('addAdHocCombatant', () => {
    it('creates an unlinked NPC combatant', () => {
      const encounter = service.createEncounter('Goblin Ambush', []);
      service.addAdHocCombatant(encounter.id, 'npc', npcFields('Goblin', 2));

      const [combatant] = service.combatantsForEncounter(encounter.id);
      expect(combatant).toMatchObject({ type: 'npc', playerId: null, npcId: null, name: 'Goblin' });
    });

    it('creates an unlinked ad-hoc Player combatant', () => {
      const encounter = service.createEncounter('Goblin Ambush', []);
      service.addAdHocCombatant(encounter.id, 'pc', pcFields('Guest Hero', 1));

      const [combatant] = service.combatantsForEncounter(encounter.id);
      expect(combatant).toMatchObject({ type: 'pc', playerId: null, npcId: null, name: 'Guest Hero' });
    });
  });

  describe('linkCombatantToLibraryEntry', () => {
    it('sets npcId on an ad-hoc NPC combatant without creating a second Combatant', () => {
      const encounter = service.createEncounter('Goblin Ambush', []);
      service.addAdHocCombatant(encounter.id, 'npc', npcFields('Goblin', 2));
      const [combatant] = service.combatantsForEncounter(encounter.id);
      const npc = npcStore.createNpc(npcFields('Goblin', 2));

      service.linkCombatantToLibraryEntry(encounter.id, combatant.id, npc.id);

      const combatants = service.combatantsForEncounter(encounter.id);
      expect(combatants).toHaveLength(1); // no duplicate created
      expect(combatants[0]).toMatchObject({ id: combatant.id, npcId: npc.id, playerId: null });
    });

    it('sets playerId on an ad-hoc Player combatant without creating a second Combatant', () => {
      const encounter = service.createEncounter('Goblin Ambush', []);
      service.addAdHocCombatant(encounter.id, 'pc', pcFields('Guest Hero', 1));
      const [combatant] = service.combatantsForEncounter(encounter.id);
      const player = partyStore.createPlayer(pcFields('Guest Hero', 1));

      service.linkCombatantToLibraryEntry(encounter.id, combatant.id, player.id);

      const combatants = service.combatantsForEncounter(encounter.id);
      expect(combatants).toHaveLength(1); // no duplicate created
      expect(combatants[0]).toMatchObject({ id: combatant.id, playerId: player.id, npcId: null });
    });
  });

  describe('Ready to Join (mid-encounter adds)', () => {
    it('addAdHocCombatant with readyToJoin true keeps the combatant out of turn order', () => {
      const encounter = service.createEncounter('Goblin Ambush', []);
      service.addAdHocCombatant(encounter.id, 'npc', npcFields('High', 100));
      service.rollInitiative(encounter.id);

      service.addAdHocCombatant(encounter.id, 'npc', npcFields('Late Arrival', 0), true);

      const combatants = service.combatantsForEncounter(encounter.id);
      const late = combatants.find((c) => c.name === 'Late Arrival')!;
      expect(late.readyToJoin).toBe(true);
      expect(late.initiativeTotal).toBeNull();
      // Still the only active combatant — Forward has nowhere else to go.
      const updated = service.getEncounter(encounter.id)!;
      expect(combatants[updated.activeCombatantIndex!].name).toBe('High');
    });

    it('joinReadyToJoinCombatant rolls capped below Active and inserts without interrupting', () => {
      const encounter = service.createEncounter('Goblin Ambush', []);
      service.addAdHocCombatant(encounter.id, 'npc', npcFields('High', 15));
      vi.spyOn(Math, 'random').mockReturnValueOnce(0); // High -> roll 1, total 16
      service.rollInitiative(encounter.id);
      vi.restoreAllMocks();

      service.addAdHocCombatant(encounter.id, 'npc', npcFields('Late Arrival', 0), true);
      const late = service.combatantsForEncounter(encounter.id).find((c) => c.name === 'Late Arrival')!;

      // A natural roll of 20 would exceed High's total of 16, so it's capped to 15.
      vi.spyOn(Math, 'random').mockReturnValueOnce(0.95);
      service.joinReadyToJoinCombatant(encounter.id, late.id);
      vi.restoreAllMocks();

      const combatants = service.combatantsForEncounter(encounter.id);
      const joined = combatants.find((c) => c.id === late.id)!;
      expect(joined.readyToJoin).toBe(false);
      expect(joined.initiativeTotal).toBe(15);
      expect(combatants[0].name).toBe('High'); // still Active, not interrupted
      const updated = service.getEncounter(encounter.id)!;
      expect(combatants[updated.activeCombatantIndex!].name).toBe('High');
    });

    it('folds an un-joined Ready to Join combatant into the main list at the next round boundary (re-roll mode)', () => {
      const encounter = service.createEncounter('Goblin Ambush', []);
      service.addAdHocCombatant(encounter.id, 'npc', npcFields('Only', 0));
      service.rollInitiative(encounter.id);
      service.addAdHocCombatant(encounter.id, 'npc', npcFields('Late Arrival', 0), true);

      service.advanceTurn(encounter.id, 'forward'); // Only was the only eligible combatant -> new round

      const updated = service.getEncounter(encounter.id)!;
      expect(updated.round).toBe(2);
      const late = service.combatantsForEncounter(encounter.id).find((c) => c.name === 'Late Arrival')!;
      expect(late.readyToJoin).toBe(false);
      expect(late.initiativeTotal).not.toBeNull();
    });

    it('folds an un-joined Ready to Join combatant in with a fresh, uncapped roll at the round boundary (Classic mode)', () => {
      const encounter = service.createEncounter('Goblin Ambush', []);
      service.addAdHocCombatant(encounter.id, 'npc', npcFields('Only', 0));
      service.setReRollEachRound(encounter.id, false);
      vi.spyOn(Math, 'random').mockReturnValueOnce(0); // Only -> roll 1, total 1
      service.rollInitiative(encounter.id);
      vi.restoreAllMocks();
      service.addAdHocCombatant(encounter.id, 'npc', npcFields('Late Arrival', 0), true);

      vi.spyOn(Math, 'random').mockReturnValueOnce(0.95); // Late Arrival -> roll 20, well above Only's 1
      service.advanceTurn(encounter.id, 'forward'); // wraps into round 2
      vi.restoreAllMocks();

      const combatants = service.combatantsForEncounter(encounter.id);
      const late = combatants.find((c) => c.name === 'Late Arrival')!;
      expect(late.readyToJoin).toBe(false);
      expect(late.initiativeTotal).toBe(20);
      expect(combatants[0].name).toBe('Late Arrival'); // sorted in above Only's untouched roll
    });

    it('is not draggable via reorderCombatant', () => {
      const encounter = service.createEncounter('Goblin Ambush', []);
      service.addAdHocCombatant(encounter.id, 'npc', npcFields('High', 100));
      service.rollInitiative(encounter.id);
      service.addAdHocCombatant(encounter.id, 'npc', npcFields('Late Arrival', 0), true);
      const late = service.combatantsForEncounter(encounter.id).find((c) => c.name === 'Late Arrival')!;
      const before = service.combatantsForEncounter(encounter.id);

      service.reorderCombatant(encounter.id, late.id, 0);

      expect(service.combatantsForEncounter(encounter.id)).toEqual(before);
    });
  });

  describe('Timers', () => {
    it('createTimer/dismissTimer/adjustTimerValue/renameTimer', () => {
      const encounter = service.createEncounter('Goblin Ambush', []);

      const timer = service.createTimer(encounter.id, 'Flooding room', 3, null);
      expect(service.timersForEncounter(encounter.id)).toEqual([timer]);
      expect(timer.remaining).toBe(3);

      service.adjustTimerValue(encounter.id, timer.id, -1);
      expect(service.timersForEncounter(encounter.id)[0].remaining).toBe(2);
      service.adjustTimerValue(encounter.id, timer.id, 5); // unclamped, can exceed initialValue
      expect(service.timersForEncounter(encounter.id)[0].remaining).toBe(7);

      service.renameTimer(encounter.id, timer.id, 'Flooding room (fixed)');
      expect(service.timersForEncounter(encounter.id)[0].name).toBe('Flooding room (fixed)');

      service.dismissTimer(encounter.id, timer.id);
      expect(service.timersForEncounter(encounter.id)).toEqual([]);
    });

    it('an unlinked timer ticks once at each round boundary, floored at 0', () => {
      const encounter = service.createEncounter('Goblin Ambush', []);
      service.addAdHocCombatant(encounter.id, 'npc', npcFields('Only', 0));
      service.rollInitiative(encounter.id);
      const timer = service.createTimer(encounter.id, 'Flooding room', 1, null);

      service.advanceTurn(encounter.id, 'forward'); // Only is the sole active combatant -> new round
      expect(service.timersForEncounter(encounter.id)[0].remaining).toBe(0);

      service.advanceTurn(encounter.id, 'forward'); // another round boundary — stays floored
      expect(service.timersForEncounter(encounter.id)[0].remaining).toBe(0);
    });

    it('a linked timer ticks when the linked combatant\'s turn ends, and unticks on Back', () => {
      const encounter = service.createEncounter('Goblin Ambush', []);
      service.addAdHocCombatant(encounter.id, 'npc', npcFields('High', 100));
      service.addAdHocCombatant(encounter.id, 'npc', npcFields('Low', -100));
      service.rollInitiative(encounter.id); // order: High (Active), Low
      const [high] = service.combatantsForEncounter(encounter.id);
      const timer = service.createTimer(encounter.id, 'Illusion', 3, high.id);

      service.advanceTurn(encounter.id, 'forward'); // High's turn ends
      expect(service.timersForEncounter(encounter.id)[0].remaining).toBe(2);

      service.advanceTurn(encounter.id, 'back'); // undo, back onto High
      expect(service.timersForEncounter(encounter.id)[0].remaining).toBe(3);

      service.advanceTurn(encounter.id, 'forward'); // redo
      expect(service.timersForEncounter(encounter.id)[0].remaining).toBe(2);
      expect(timer.linkedCombatantId).toBe(high.id);
    });

    it('a linked timer ticks only once per round even if its combatant goes on Hold then still holds through the round boundary', () => {
      const encounter = service.createEncounter('Goblin Ambush', []);
      service.addAdHocCombatant(encounter.id, 'npc', npcFields('High', 100));
      service.addAdHocCombatant(encounter.id, 'npc', npcFields('Low', -100));
      service.rollInitiative(encounter.id); // order: High (Active), Low
      const [high] = service.combatantsForEncounter(encounter.id);
      service.createTimer(encounter.id, 'Illusion', 5, high.id);

      service.toggleHoldAction(encounter.id, high.id); // High holds -> auto-advances to Low, ticks once
      expect(service.timersForEncounter(encounter.id)[0].remaining).toBe(4);

      service.advanceTurn(encounter.id, 'forward'); // Low's turn ends -> round boundary; High still on Hold
      expect(service.timersForEncounter(encounter.id)[0].remaining).toBe(4); // not double-ticked
      expect(service.getEncounter(encounter.id)!.round).toBe(2);
    });

    it('a linked timer ticks at the round boundary for a combatant who was already on Hold the whole round and never acted', () => {
      const encounter = service.createEncounter('Goblin Ambush', []);
      service.addAdHocCombatant(encounter.id, 'npc', npcFields('High', 100));
      service.addAdHocCombatant(encounter.id, 'npc', npcFields('Low', -100));
      service.rollInitiative(encounter.id);
      const [high] = service.combatantsForEncounter(encounter.id);
      service.toggleHoldAction(encounter.id, high.id); // High holds before the timer is even created

      service.createTimer(encounter.id, 'Illusion', 5, high.id);

      service.advanceTurn(encounter.id, 'forward'); // Low's turn ends -> round boundary; High still held
      expect(service.timersForEncounter(encounter.id)[0].remaining).toBe(4);
      expect(service.getEncounter(encounter.id)!.round).toBe(2);
    });

    it('returnFromHold "above" credits the interrupted combatant\'s linked timer', () => {
      const encounter = service.createEncounter('Goblin Ambush', []);
      service.addAdHocCombatant(encounter.id, 'npc', npcFields('High', 100));
      service.addAdHocCombatant(encounter.id, 'npc', npcFields('Low', -100));
      service.rollInitiative(encounter.id);
      const [high, low] = service.combatantsForEncounter(encounter.id);
      service.createTimer(encounter.id, 'Illusion', 3, high.id);
      service.toggleHoldAction(encounter.id, low.id); // Low holds, High still Active

      service.returnFromHold(encounter.id, low.id, 'above'); // interrupts High mid-turn

      expect(service.timersForEncounter(encounter.id)[0].remaining).toBe(2);
    });
  });
});

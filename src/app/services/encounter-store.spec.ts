import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { Combatant } from '../models/encounter.model';
import { EncounterStore, compareByInitiative, firstActiveIndex, reRollRound } from './encounter-store';
import { PartyStore } from './party-store';

function combatant(overrides: Partial<Combatant>): Combatant {
  return {
    id: 'c',
    encounterId: 'e',
    type: 'npc',
    pcId: null,
    name: 'Combatant',
    initiativeModifier: 0,
    lastRoll: null,
    initiativeTotal: null,
    removedFromCombat: false,
    onHold: false,
    ...overrides,
  };
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

  it('leaves an on-hold combatant unrolled — their total is fixed up separately, relative to Active', () => {
    const onHold = combatant({ id: 'held', onHold: true, lastRoll: 3, initiativeTotal: 3 });
    const a = combatant({ id: 'a', initiativeModifier: 0 });

    vi.spyOn(Math, 'random').mockReturnValueOnce(0); // -> a rolls 1

    const result = reRollRound([onHold, a]);
    const held = result.find((c) => c.id === 'held')!;
    expect(held.lastRoll).toBe(3);
    expect(held.initiativeTotal).toBe(3);

    vi.restoreAllMocks();
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
});

describe('EncounterStore', () => {
  let service: EncounterStore;
  let partyStore: PartyStore;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(EncounterStore);
    partyStore = TestBed.inject(PartyStore);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('pulls every PC from the selected Parties in as Combatants', () => {
    const party = partyStore.createParty('Party A');
    const pc = partyStore.addPc(party.id, 'Aria', 3);

    const encounter = service.createEncounter('Goblin Ambush', [party.id]);

    const combatants = service.combatantsForEncounter(encounter.id);
    expect(combatants).toHaveLength(1);
    expect(combatants[0]).toMatchObject({
      type: 'pc',
      pcId: pc.id,
      name: 'Aria',
      initiativeModifier: 3,
    });
    expect(encounter.activeCombatantIndex).toBeNull();
    expect(encounter.round).toBe(0);
  });

  it('adds ad-hoc NPCs to an encounter', () => {
    const encounter = service.createEncounter('Goblin Ambush', []);

    service.addNpc(encounter.id, 'Goblin 1', 2);

    const combatants = service.combatantsForEncounter(encounter.id);
    expect(combatants.map((c) => c.name)).toEqual(['Goblin 1']);
  });

  it('removeCombatant only works before the first Roll', () => {
    const encounter = service.createEncounter('Goblin Ambush', []);
    service.addNpc(encounter.id, 'Goblin 1', 2);
    const [npc] = service.combatantsForEncounter(encounter.id);

    service.rollInitiative(encounter.id);
    service.removeCombatant(encounter.id, npc.id);

    expect(service.combatantsForEncounter(encounter.id)).toHaveLength(1);
  });

  it('rollInitiative rolls everyone and starts round 1', () => {
    const encounter = service.createEncounter('Goblin Ambush', []);
    service.addNpc(encounter.id, 'Goblin 1', 2);
    service.addNpc(encounter.id, 'Goblin 2', -1);

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
    service.addNpc(encounter.id, 'High', 100);
    service.addNpc(encounter.id, 'Low', -100);
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
    service.addNpc(encounter.id, 'High', 100);
    service.addNpc(encounter.id, 'Low', -100);
    service.rollInitiative(encounter.id);

    service.advanceTurn(encounter.id, 'forward'); // now on Low
    service.advanceTurn(encounter.id, 'back'); // back to High
    expect(service.getEncounter(encounter.id)!.activeCombatantIndex).toBe(0);

    service.advanceTurn(encounter.id, 'back'); // no-op, already first
    expect(service.getEncounter(encounter.id)!.activeCombatantIndex).toBe(0);
  });

  it('toggling Removed on the active combatant auto-advances the turn', () => {
    const encounter = service.createEncounter('Goblin Ambush', []);
    service.addNpc(encounter.id, 'High', 100);
    service.addNpc(encounter.id, 'Low', -100);
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
    service.addNpc(encounter.id, 'High', 100);
    service.addNpc(encounter.id, 'Mid', 0);
    service.addNpc(encounter.id, 'Low', -100);
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
    service.addNpc(encounter.id, 'A', 0);
    service.addNpc(encounter.id, 'B', 0);
    service.addNpc(encounter.id, 'C', 0);

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
    service.addNpc(encounter.id, 'A', 15);
    service.addNpc(encounter.id, 'B', 0);

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

  it('holding a combatant pins their initiative to one less than the Active total and repositions them just below Active', () => {
    const encounter = service.createEncounter('Goblin Ambush', []);
    service.addNpc(encounter.id, 'High', 100);
    service.addNpc(encounter.id, 'Mid', 0);
    service.addNpc(encounter.id, 'Low', -100);
    service.rollInitiative(encounter.id); // order: High (Active), Mid, Low

    const [high, , low] = service.combatantsForEncounter(encounter.id);
    service.toggleHoldAction(encounter.id, low.id);

    const updated = service.getEncounter(encounter.id)!;
    const combatants = service.combatantsForEncounter(encounter.id);
    expect(combatants.map((c) => c.name)).toEqual(['High', 'Low', 'Mid']);
    expect(combatants[1].onHold).toBe(true);
    expect(combatants[1].initiativeTotal).toBe(high.initiativeTotal! - 1);
    expect(updated.activeCombatantIndex).toBe(0); // High is still Active
  });

  it('Forward skips on-hold combatants', () => {
    const encounter = service.createEncounter('Goblin Ambush', []);
    service.addNpc(encounter.id, 'High', 100);
    service.addNpc(encounter.id, 'Mid', 0);
    service.addNpc(encounter.id, 'Low', -100);
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
    service.addNpc(encounter.id, 'High', 100);
    service.addNpc(encounter.id, 'Mid', 0);
    service.addNpc(encounter.id, 'Low', -100);
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

  it('holding your own action while Active passes the turn, keeping you pinned as next-in-line', () => {
    const encounter = service.createEncounter('Goblin Ambush', []);
    service.addNpc(encounter.id, 'High', 100);
    service.addNpc(encounter.id, 'Mid', 0);
    service.addNpc(encounter.id, 'Low', -100);
    service.rollInitiative(encounter.id);

    const [high] = service.combatantsForEncounter(encounter.id);
    service.toggleHoldAction(encounter.id, high.id);

    const updated = service.getEncounter(encounter.id)!;
    const combatants = service.combatantsForEncounter(encounter.id);
    expect(combatants.map((c) => c.name)).toEqual(['Mid', 'High', 'Low']);
    expect(combatants[updated.activeCombatantIndex!].name).toBe('Mid');
    expect(combatants[1].onHold).toBe(true); // High, now pinned just below Mid
    expect(updated.round).toBe(1);
  });
});

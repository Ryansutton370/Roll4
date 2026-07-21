import { MonsterTemplate } from '../models/monster-template.model';
import {
  adjustedXp,
  encounterMultiplier,
  generate5eEncounter,
  generateShadowdarkEncounter,
  xpBudget,
} from './encounter-generator';

function monster(overrides: Partial<MonsterTemplate>): MonsterTemplate {
  return {
    id: 'test',
    source: '5e-srd',
    homebrew: false,
    name: 'Test Monster',
    difficulty: 1,
    ac: 10,
    maxHp: 10,
    initiativeModifier: 0,
    statBlock: [],
    ...overrides,
  };
}

describe('encounterMultiplier', () => {
  it('matches the DMG group-size table', () => {
    expect(encounterMultiplier(1)).toBe(1);
    expect(encounterMultiplier(2)).toBe(1.5);
    expect(encounterMultiplier(3)).toBe(2);
    expect(encounterMultiplier(6)).toBe(2);
    expect(encounterMultiplier(7)).toBe(2.5);
    expect(encounterMultiplier(10)).toBe(2.5);
    expect(encounterMultiplier(11)).toBe(3);
    expect(encounterMultiplier(14)).toBe(3);
    expect(encounterMultiplier(15)).toBe(4);
    expect(encounterMultiplier(20)).toBe(4);
  });
});

describe('xpBudget', () => {
  it('multiplies the per-level threshold by party size', () => {
    // Level 1 Medium threshold is 50 XP (DMG p.82).
    expect(xpBudget(1, 4, 'medium')).toBe(200);
  });

  it('scales with difficulty tier', () => {
    expect(xpBudget(5, 1, 'easy')).toBeLessThan(xpBudget(5, 1, 'medium'));
    expect(xpBudget(5, 1, 'medium')).toBeLessThan(xpBudget(5, 1, 'hard'));
    expect(xpBudget(5, 1, 'hard')).toBeLessThan(xpBudget(5, 1, 'deadly'));
  });
});

describe('adjustedXp', () => {
  it('applies the group multiplier to the summed raw XP', () => {
    // Two CR 1 monsters: raw 200 + 200 = 400 XP, x1.5 multiplier = 600.
    const entries = [{ template: monster({ difficulty: 1 }), count: 2 }];
    expect(adjustedXp(entries)).toBe(600);
  });
});

describe('generate5eEncounter', () => {
  const pool: MonsterTemplate[] = [
    monster({ id: 'goblin', name: 'Goblin', difficulty: 0.25 }),
    monster({ id: 'orc', name: 'Orc', difficulty: 0.5 }),
    monster({ id: 'ancient-dragon', name: 'Ancient Dragon', difficulty: 24 }),
  ];

  it('returns an empty list when the pool has nothing at or under budget', () => {
    const result = generate5eEncounter({
      partyLevel: 1,
      partySize: 1,
      difficulty: 'easy',
      pool: [monster({ id: 'ancient-dragon', difficulty: 24 })],
    });
    expect(result).toEqual([]);
  });

  it('returns an empty list for an empty pool', () => {
    expect(
      generate5eEncounter({ partyLevel: 5, partySize: 4, difficulty: 'medium', pool: [] }),
    ).toEqual([]);
  });

  it('never includes a monster whose difficulty is null', () => {
    const nullDifficultyPool = [monster({ id: 'scaling', difficulty: null })];
    expect(
      generate5eEncounter({
        partyLevel: 10,
        partySize: 4,
        difficulty: 'deadly',
        pool: nullDifficultyPool,
      }),
    ).toEqual([]);
  });

  it('only picks monsters actually present in the pool', () => {
    const poolIds = new Set(pool.map((m) => m.id));
    for (let i = 0; i < 20; i++) {
      const result = generate5eEncounter({
        partyLevel: 3,
        partySize: 4,
        difficulty: 'medium',
        pool,
      });
      for (const entry of result) {
        expect(poolIds.has(entry.template.id)).toBe(true);
        expect(entry.count).toBeGreaterThan(0);
      }
    }
  });

  it('does not wildly exceed the party budget', () => {
    for (let i = 0; i < 20; i++) {
      const result = generate5eEncounter({
        partyLevel: 3,
        partySize: 4,
        difficulty: 'medium',
        pool,
      });
      const budget = xpBudget(3, 4, 'medium');
      expect(adjustedXp(result)).toBeLessThanOrEqual(budget * 1.1);
    }
  });
});

describe('generateShadowdarkEncounter', () => {
  const pool: MonsterTemplate[] = [
    monster({ id: 'goblin', source: 'shadowdark', name: 'Goblin', difficulty: 1 }),
    monster({ id: 'owlbear', source: 'shadowdark', name: 'Owlbear', difficulty: 6 }),
    monster({ id: 'ancient-dragon', source: 'shadowdark', name: 'Dragon', difficulty: 16 }),
  ];

  it('only draws from templates within the level range', () => {
    const result = generateShadowdarkEncounter({
      minLevel: 1,
      maxLevel: 3,
      monsterCount: 10,
      pool,
    });
    for (const entry of result) {
      expect(entry.template.id).toBe('goblin');
    }
  });

  it('produces the requested total monster count', () => {
    const result = generateShadowdarkEncounter({
      minLevel: 1,
      maxLevel: 20,
      monsterCount: 5,
      pool,
    });
    const total = result.reduce((sum, e) => sum + e.count, 0);
    expect(total).toBe(5);
  });

  it('excludes a null-difficulty monster even within an otherwise-matching range', () => {
    const result = generateShadowdarkEncounter({
      minLevel: 0,
      maxLevel: 30,
      monsterCount: 5,
      pool: [monster({ id: 'scaling', source: 'shadowdark', difficulty: null })],
    });
    expect(result).toEqual([]);
  });

  it('returns an empty list when nothing in the pool matches the range', () => {
    expect(
      generateShadowdarkEncounter({ minLevel: 25, maxLevel: 30, monsterCount: 5, pool }),
    ).toEqual([]);
  });
});

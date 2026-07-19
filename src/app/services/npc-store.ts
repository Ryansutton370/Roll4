import { Service, effect, signal } from '@angular/core';
import { Npc, Troop } from '../models/npc.model';

// New key — NPCs had no persisted library at all before this (they were
// always created ad-hoc, inline in an Encounter). See docs/ARCHITECTURE.md
// for why this app doesn't bother migrating old-shaped data.
const STORAGE_KEY = 'roll4.troops.v1';

interface NpcStorageShape {
  troops: Troop[];
  npcs: Npc[];
}

// Structural mirror of PartyStore (party-store.ts) — same reasoning
// throughout: a @Service() singleton, a many-to-many group/member pair of
// signals persisted together, and the group (Troop.npcIds) as the single
// owning source of truth for membership rather than a back-reference on
// the member (Npc has none).
@Service()
export class NpcStore {
  private readonly troopsSignal = signal<Troop[]>([]);
  private readonly npcsSignal = signal<Npc[]>([]);

  readonly troops = this.troopsSignal.asReadonly();
  readonly npcs = this.npcsSignal.asReadonly();

  constructor() {
    this.load();

    effect(() => {
      const snapshot: NpcStorageShape = {
        troops: this.troopsSignal(),
        npcs: this.npcsSignal(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    });
  }

  private load(): void {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as NpcStorageShape;
      this.troopsSignal.set(parsed.troops ?? []);
      this.npcsSignal.set(parsed.npcs ?? []);
    } catch {
      // Corrupt/unreadable data — start fresh rather than crash the app.
    }
  }

  getTroop(id: string): Troop | undefined {
    return this.troopsSignal().find((t) => t.id === id);
  }

  getNpc(id: string): Npc | undefined {
    return this.npcsSignal().find((n) => n.id === id);
  }

  /** All NPCs belonging to a given Troop, in roster (creation) order. */
  npcsForTroop(troopId: string): Npc[] {
    const troop = this.getTroop(troopId);
    if (!troop) return [];
    return this.npcsSignal().filter((n) => troop.npcIds.includes(n.id));
  }

  /** Derived, not stored — Npc has no back-reference field; Troop.npcIds is the single source of truth for membership. */
  troopsForNpc(npcId: string): Troop[] {
    return this.troopsSignal().filter((t) => t.npcIds.includes(npcId));
  }

  createTroop(name: string): Troop {
    const troop: Troop = { id: crypto.randomUUID(), name, npcIds: [] };
    this.troopsSignal.update((troops) => [...troops, troop]);
    return troop;
  }

  renameTroop(id: string, name: string): void {
    this.troopsSignal.update((troops) =>
      troops.map((t) => (t.id === id ? { ...t, name } : t)),
    );
  }

  /** Doesn't cascade-delete member NPCs — a Troop is a tag on the shared NPC roster, same as Party for Players. */
  deleteTroop(id: string): void {
    this.troopsSignal.update((troops) => troops.filter((t) => t.id !== id));
  }

  addNpcToTroop(troopId: string, npcId: string): void {
    this.troopsSignal.update((troops) =>
      troops.map((t) =>
        t.id === troopId && !t.npcIds.includes(npcId)
          ? { ...t, npcIds: [...t.npcIds, npcId] }
          : t,
      ),
    );
  }

  removeNpcFromTroop(troopId: string, npcId: string): void {
    this.troopsSignal.update((troops) =>
      troops.map((t) =>
        t.id === troopId ? { ...t, npcIds: t.npcIds.filter((id) => id !== npcId) } : t,
      ),
    );
  }

  /** Created directly into the roster, unattached to any Troop — use addNpcToTroop to assign it to one. */
  createNpc(fields: {
    name: string;
    initiativeModifier: number;
    ac: number | null;
    maxHp: number | null;
    notes: string;
  }): Npc {
    const npc: Npc = { id: crypto.randomUUID(), ...fields };
    this.npcsSignal.update((npcs) => [...npcs, npc]);
    return npc;
  }

  updateNpc(
    id: string,
    changes: Partial<Pick<Npc, 'name' | 'initiativeModifier' | 'ac' | 'maxHp' | 'notes'>>,
  ): void {
    this.npcsSignal.update((npcs) => npcs.map((n) => (n.id === id ? { ...n, ...changes } : n)));
  }

  /** Reverse-cascades across every Troop's npcIds, not just one — an NPC can belong to several Troops at once. */
  deleteNpc(id: string): void {
    this.npcsSignal.update((npcs) => npcs.filter((n) => n.id !== id));
    this.troopsSignal.update((troops) =>
      troops.map((t) =>
        t.npcIds.includes(id) ? { ...t, npcIds: t.npcIds.filter((nid) => nid !== id) } : t,
      ),
    );
  }
}

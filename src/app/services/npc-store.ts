import { Service, effect, inject, signal } from '@angular/core';
import {
  Unsubscribe,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { firestore } from '../firebase';
import { Npc, Troop } from '../models/npc.model';
import { AuthService } from './auth-service';

// Structural mirror of party-store.ts — same reasoning throughout: a
// @Service() singleton whose signals mirror an ownerId-scoped Firestore
// onSnapshot listener, and a many-to-many group/member pair where the
// group (Troop.npcIds) is the single owning source of truth for
// membership rather than a back-reference on the member (Npc has none).
// See party-store.ts's own comments for the fuller explanation of every
// pattern reused here — this file exists mainly to prove that pattern
// actually generalizes to a second store, not to re-explain it.

/** Pure, DI-free reconciliation logic — see party-store.ts's equivalent functions for why this is kept separate from the Firestore glue below. */

export function addNpcIdToTroop(troops: Troop[], troopId: string, npcId: string): Troop[] {
  return troops.map((t) =>
    t.id === troopId && !t.npcIds.includes(npcId) ? { ...t, npcIds: [...t.npcIds, npcId] } : t,
  );
}

export function removeNpcIdFromTroop(troops: Troop[], troopId: string, npcId: string): Troop[] {
  return troops.map((t) =>
    t.id === troopId ? { ...t, npcIds: t.npcIds.filter((id) => id !== npcId) } : t,
  );
}

/** Removes npcId from every Troop's membership — the reverse-cascade a full NPC deletion needs. */
export function removeNpcIdFromAllTroops(troops: Troop[], npcId: string): Troop[] {
  return troops.map((t) =>
    t.npcIds.includes(npcId) ? { ...t, npcIds: t.npcIds.filter((id) => id !== npcId) } : t,
  );
}

@Service()
export class NpcStore {
  private readonly authService = inject(AuthService);

  private readonly troopsSignal = signal<Troop[]>([]);
  private readonly npcsSignal = signal<Npc[]>([]);

  readonly troops = this.troopsSignal.asReadonly();
  readonly npcs = this.npcsSignal.asReadonly();

  constructor() {
    let unsubTroops: Unsubscribe | null = null;
    let unsubNpcs: Unsubscribe | null = null;

    effect(() => {
      const uid = this.authService.uid();
      unsubTroops?.();
      unsubNpcs?.();
      this.troopsSignal.set([]);
      this.npcsSignal.set([]);
      if (!uid) return;

      unsubTroops = onSnapshot(
        query(collection(firestore, 'troops'), where('ownerId', '==', uid)),
        (snap) => this.troopsSignal.set(snap.docs.map((d) => d.data() as Troop)),
      );
      unsubNpcs = onSnapshot(
        query(collection(firestore, 'npcs'), where('ownerId', '==', uid)),
        (snap) => this.npcsSignal.set(snap.docs.map((d) => d.data() as Npc)),
      );
    });
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
    const ownerId = this.requireUid();
    const troop: Troop = { id: crypto.randomUUID(), ownerId, name, npcIds: [] };
    setDoc(doc(firestore, 'troops', troop.id), troop).catch((err) =>
      console.error('Failed to save troop', err),
    );
    return troop;
  }

  renameTroop(id: string, name: string): void {
    updateDoc(doc(firestore, 'troops', id), { name }).catch((err) =>
      console.error('Failed to rename troop', err),
    );
  }

  /** Doesn't cascade-delete member NPCs — a Troop is a tag on the shared NPC roster, same as Party for Players. */
  deleteTroop(id: string): void {
    deleteDoc(doc(firestore, 'troops', id)).catch((err) =>
      console.error('Failed to delete troop', err),
    );
  }

  addNpcToTroop(troopId: string, npcId: string): void {
    updateDoc(doc(firestore, 'troops', troopId), { npcIds: arrayUnion(npcId) }).catch((err) =>
      console.error('Failed to add npc to troop', err),
    );
  }

  removeNpcFromTroop(troopId: string, npcId: string): void {
    updateDoc(doc(firestore, 'troops', troopId), { npcIds: arrayRemove(npcId) }).catch((err) =>
      console.error('Failed to remove npc from troop', err),
    );
  }

  /** Created directly into the roster, unattached to any Troop — use addNpcToTroop to assign it to one. monsterTemplateId/monsterName are optional so every existing hand-entered-NPc call site is unaffected; only the Encounter Generator's "Save as Troop" step sets them. */
  createNpc(fields: {
    name: string;
    initiativeModifier: number;
    ac: number | null;
    maxHp: number | null;
    notes: string;
    monsterTemplateId?: string | null;
    monsterName?: string | null;
  }): Npc {
    const ownerId = this.requireUid();
    const npc: Npc = {
      id: crypto.randomUUID(),
      ownerId,
      ...fields,
      monsterTemplateId: fields.monsterTemplateId ?? null,
      monsterName: fields.monsterName ?? null,
    };
    setDoc(doc(firestore, 'npcs', npc.id), npc).catch((err) =>
      console.error('Failed to save npc', err),
    );
    return npc;
  }

  updateNpc(
    id: string,
    changes: Partial<Pick<Npc, 'name' | 'initiativeModifier' | 'ac' | 'maxHp' | 'notes'>>,
  ): void {
    updateDoc(doc(firestore, 'npcs', id), changes).catch((err) =>
      console.error('Failed to update npc', err),
    );
  }

  /** Reverse-cascades across every Troop's npcIds, not just one — an NPC can belong to several Troops at once. writeBatch keeps the delete and every troop-update atomic, same as PartyStore.deletePlayer. */
  deleteNpc(id: string): void {
    const batch = writeBatch(firestore);
    batch.delete(doc(firestore, 'npcs', id));
    this.troopsSignal()
      .filter((t) => t.npcIds.includes(id))
      .forEach((t) => batch.update(doc(firestore, 'troops', t.id), { npcIds: arrayRemove(id) }));
    batch.commit().catch((err) => console.error('Failed to delete npc', err));
  }

  private requireUid(): string {
    const uid = this.authService.uid();
    if (!uid) throw new Error('NpcStore method called while signed out');
    return uid;
  }
}

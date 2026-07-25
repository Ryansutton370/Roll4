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
import { Party, Player } from '../models/party.model';
import { AuthService } from './auth-service';

/**
 * Pure, DI-free reconciliation logic — kept separate from the Firestore
 * glue below so it stays unit-testable without a live/mocked backend, the
 * same "extract the real logic, leave the storage plumbing untested"
 * split EncounterStore already uses for its own pure functions (see
 * compareByInitiative etc. in encounter-store.ts).
 */

/** Adds playerId to partyId's membership, unless it's already there. */
export function addPlayerIdToParty(parties: Party[], partyId: string, playerId: string): Party[] {
  return parties.map((p) =>
    p.id === partyId && !p.playerIds.includes(playerId)
      ? { ...p, playerIds: [...p.playerIds, playerId] }
      : p,
  );
}

/** Removes playerId from partyId's membership, if present. */
export function removePlayerIdFromParty(
  parties: Party[],
  partyId: string,
  playerId: string,
): Party[] {
  return parties.map((p) =>
    p.id === partyId ? { ...p, playerIds: p.playerIds.filter((id) => id !== playerId) } : p,
  );
}

/** Removes playerId from every Party's membership — the reverse-cascade a full player deletion needs. */
export function removePlayerIdFromAllParties(parties: Party[], playerId: string): Party[] {
  return parties.map((p) =>
    p.playerIds.includes(playerId)
      ? { ...p, playerIds: p.playerIds.filter((id) => id !== playerId) }
      : p,
  );
}

@Service()
export class PartyStore {
  private readonly authService = inject(AuthService);

  private readonly partiesSignal = signal<Party[]>([]);
  private readonly playersSignal = signal<Player[]>([]);

  readonly parties = this.partiesSignal.asReadonly();
  readonly players = this.playersSignal.asReadonly();

  constructor() {
    let unsubParties: Unsubscribe | null = null;
    let unsubPlayers: Unsubscribe | null = null;

    // effect() re-runs whenever authService.uid() changes (sign-in,
    // sign-out, or switching accounts) — tearing down the previous
    // Firestore listeners and clearing the signals first, so a second
    // account signing in on the same tab never briefly shows the first
    // account's data. onSnapshot() is Firestore's realtime listener: it
    // fires once immediately with the current matching documents, then
    // again on every future change — this replaces the old load()/
    // localStorage effect() pair entirely; nothing else ever calls
    // .set() on these signals.
    effect(() => {
      const uid = this.authService.uid();
      unsubParties?.();
      unsubPlayers?.();
      this.partiesSignal.set([]);
      this.playersSignal.set([]);
      if (!uid) return;

      unsubParties = onSnapshot(
        query(collection(firestore, 'parties'), where('ownerId', '==', uid)),
        (snap) => this.partiesSignal.set(snap.docs.map((d) => d.data() as Party)),
      );
      unsubPlayers = onSnapshot(
        query(collection(firestore, 'players'), where('ownerId', '==', uid)),
        (snap) => this.playersSignal.set(snap.docs.map((d) => d.data() as Player)),
      );
    });
  }

  getParty(id: string): Party | undefined {
    return this.partiesSignal().find((p) => p.id === id);
  }

  getPlayer(id: string): Player | undefined {
    return this.playersSignal().find((p) => p.id === id);
  }

  /** All Players belonging to a given Party, in roster (creation) order. */
  playersForParty(partyId: string): Player[] {
    const party = this.getParty(partyId);
    if (!party) return [];
    return this.playersSignal().filter((p) => party.playerIds.includes(p.id));
  }

  /** Derived, not stored — Player has no back-reference field; Party.playerIds is the single source of truth for membership. */
  partiesForPlayer(playerId: string): Party[] {
    return this.partiesSignal().filter((p) => p.playerIds.includes(playerId));
  }

  // Every create* method below returns its new object synchronously,
  // without awaiting the Firestore write — the id (crypto.randomUUID())
  // and full shape are already known before the network is touched, so
  // callers keep working exactly as before (e.g. `const party =
  // partyStore.createParty(name); router.navigate([...party.id])`). The
  // write itself is fire-and-forget; a failure is logged rather than
  // surfaced to the caller, matching this app's existing "corrupt/missing
  // data — carry on rather than crash" posture (see the old load()'s
  // try/catch, before this store talked to Firestore at all).
  createParty(name: string): Party {
    const ownerId = this.requireUid();
    const party: Party = { id: crypto.randomUUID(), ownerId, name, playerIds: [] };
    setDoc(doc(firestore, 'parties', party.id), party).catch((err) =>
      console.error('Failed to save party', err),
    );
    return party;
  }

  renameParty(id: string, name: string): void {
    updateDoc(doc(firestore, 'parties', id), { name }).catch((err) =>
      console.error('Failed to rename party', err),
    );
  }

  /**
   * Unlike Phase 1's deleteParty, this no longer cascades to delete member
   * Players — many-to-many membership means a Party is a tag on the
   * shared Player roster, not an owner of it, so deleting a Party just
   * removes that grouping. The Players in it stay in the roster (and in
   * any other Party they also belong to).
   */
  deleteParty(id: string): void {
    deleteDoc(doc(firestore, 'parties', id)).catch((err) =>
      console.error('Failed to delete party', err),
    );
  }

  addPlayerToParty(partyId: string, playerId: string): void {
    // arrayUnion: a Firestore FieldValue that appends playerId only if
    // it's not already present — a dedup-guarded add without reading the
    // document first, matching addPlayerIdToParty's pure-logic behavior
    // above (kept as a pure function for the unit tests; this is the
    // Firestore-native equivalent, used for the real write).
    updateDoc(doc(firestore, 'parties', partyId), { playerIds: arrayUnion(playerId) }).catch(
      (err) => console.error('Failed to add player to party', err),
    );
  }

  removePlayerFromParty(partyId: string, playerId: string): void {
    updateDoc(doc(firestore, 'parties', partyId), { playerIds: arrayRemove(playerId) }).catch(
      (err) => console.error('Failed to remove player from party', err),
    );
  }

  /** Created directly into the roster, unattached to any Party — use addPlayerToParty to assign it to one. */
  createPlayer(fields: {
    name: string;
    initiativeModifier: number;
    ac: number | null;
    maxHp: number | null;
    notes: string;
  }): Player {
    const ownerId = this.requireUid();
    const player: Player = { id: crypto.randomUUID(), ownerId, ...fields };
    setDoc(doc(firestore, 'players', player.id), player).catch((err) =>
      console.error('Failed to save player', err),
    );
    return player;
  }

  updatePlayer(
    id: string,
    changes: Partial<Pick<Player, 'name' | 'initiativeModifier' | 'ac' | 'maxHp' | 'notes'>>,
  ): void {
    updateDoc(doc(firestore, 'players', id), changes).catch((err) =>
      console.error('Failed to update player', err),
    );
  }

  /**
   * Reverse-cascades across *every* Party's playerIds, not just one —
   * unlike Phase 1's removePc (a PC only ever had one owning Party), a
   * Player can now belong to several Parties at once, so deleting one
   * from the roster has to clean up every membership list that names it.
   * A writeBatch keeps the player-delete and every party-update atomic —
   * Firestore doesn't apply any of a batch's writes unless all of them
   * succeed.
   */
  deletePlayer(id: string): void {
    const batch = writeBatch(firestore);
    batch.delete(doc(firestore, 'players', id));
    this.partiesSignal()
      .filter((p) => p.playerIds.includes(id))
      .forEach((p) => batch.update(doc(firestore, 'parties', p.id), { playerIds: arrayRemove(id) }));
    batch.commit().catch((err) => console.error('Failed to delete player', err));
  }

  private requireUid(): string {
    const uid = this.authService.uid();
    if (!uid) throw new Error('PartyStore method called while signed out');
    return uid;
  }
}

import { Service, effect, signal } from '@angular/core';
import { Party, Player } from '../models/party.model';

// Bumped from 'roll4.parties.v2' — Party/PlayerCharacter's shape changed
// (PlayerCharacter renamed to Player and lost its single partyId in favor
// of many-to-many membership via Party.playerIds) and this app has no
// migration path yet (see docs/ARCHITECTURE.md), so old-shaped data is
// simply left behind.
const STORAGE_KEY = 'roll4.parties.v3';

interface PartyStorageShape {
  parties: Party[];
  players: Player[];
}

// @Service(): Angular's newer, simpler alternative to
// @Injectable({ providedIn: 'root' }) — it registers this class with
// dependency injection as an app-wide singleton. Any component or service
// that asks for a PartyStore in its constructor gets the same shared
// instance, which is what we want for state that many screens read/write.
@Service()
export class PartyStore {
  // signal(): a reactive container for a value. Components that read it
  // (e.g. by calling `partyStore.parties()` in a template) automatically
  // re-render whenever it changes — no manual subscription/unsubscription.
  private readonly partiesSignal = signal<Party[]>([]);
  private readonly playersSignal = signal<Player[]>([]);

  // asReadonly() gives components a signal they can read but not `.set()`.
  // All mutation happens through the methods below, so state changes stay
  // in one place instead of being scattered across every component.
  readonly parties = this.partiesSignal.asReadonly();
  readonly players = this.playersSignal.asReadonly();

  constructor() {
    this.load();

    // effect(): a function that re-runs automatically whenever any signal it
    // reads (here, partiesSignal/playersSignal) changes. This is how we keep
    // localStorage in sync without every mutation method remembering to save
    // — per docs/ARCHITECTURE.md, this is the one place persistence lives.
    effect(() => {
      const snapshot: PartyStorageShape = {
        parties: this.partiesSignal(),
        players: this.playersSignal(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    });
  }

  private load(): void {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as PartyStorageShape;
      this.partiesSignal.set(parsed.parties ?? []);
      this.playersSignal.set(parsed.players ?? []);
    } catch {
      // Corrupt/unreadable data — start fresh rather than crash the app.
    }
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

  createParty(name: string): Party {
    const party: Party = { id: crypto.randomUUID(), name, playerIds: [] };
    this.partiesSignal.update((parties) => [...parties, party]);
    return party;
  }

  renameParty(id: string, name: string): void {
    this.partiesSignal.update((parties) =>
      parties.map((p) => (p.id === id ? { ...p, name } : p)),
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
    this.partiesSignal.update((parties) => parties.filter((p) => p.id !== id));
  }

  addPlayerToParty(partyId: string, playerId: string): void {
    this.partiesSignal.update((parties) =>
      parties.map((p) =>
        p.id === partyId && !p.playerIds.includes(playerId)
          ? { ...p, playerIds: [...p.playerIds, playerId] }
          : p,
      ),
    );
  }

  removePlayerFromParty(partyId: string, playerId: string): void {
    this.partiesSignal.update((parties) =>
      parties.map((p) =>
        p.id === partyId ? { ...p, playerIds: p.playerIds.filter((id) => id !== playerId) } : p,
      ),
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
    const player: Player = { id: crypto.randomUUID(), ...fields };
    this.playersSignal.update((players) => [...players, player]);
    return player;
  }

  updatePlayer(
    id: string,
    changes: Partial<Pick<Player, 'name' | 'initiativeModifier' | 'ac' | 'maxHp' | 'notes'>>,
  ): void {
    this.playersSignal.update((players) =>
      players.map((p) => (p.id === id ? { ...p, ...changes } : p)),
    );
  }

  /**
   * Reverse-cascades across *every* Party's playerIds, not just one —
   * unlike Phase 1's removePc (a PC only ever had one owning Party), a
   * Player can now belong to several Parties at once, so deleting one
   * from the roster has to clean up every membership list that names it.
   */
  deletePlayer(id: string): void {
    this.playersSignal.update((players) => players.filter((p) => p.id !== id));
    this.partiesSignal.update((parties) =>
      parties.map((p) =>
        p.playerIds.includes(id) ? { ...p, playerIds: p.playerIds.filter((pid) => pid !== id) } : p,
      ),
    );
  }
}

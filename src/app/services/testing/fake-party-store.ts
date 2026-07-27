import { signal } from '@angular/core';
import { InitiativeAdvantageState } from '../../models/initiative-advantage.model';
import { Party, Player } from '../../models/party.model';
import {
  addPlayerIdToParty,
  removePlayerIdFromAllParties,
  removePlayerIdFromParty,
} from '../party-store';

/**
 * A synchronous, in-memory stand-in for PartyStore, for tests only.
 * PartyStore itself is Firestore-backed and requires a signed-in GM (see
 * party-store.ts) — neither exists in a unit test, and standing up a real
 * or emulated Firestore connection is more infrastructure than this
 * project has taken on (see docs/ARCHITECTURE.md's Persistence section).
 * Provide this in place of the real PartyStore
 * (`{ provide: PartyStore, useValue: new FakePartyStore() }`) in any spec
 * that needs a Party/Player fixture to actually exist synchronously. It
 * reuses PartyStore's own exported pure membership functions rather than
 * re-deriving that logic.
 */
export class FakePartyStore {
  private readonly partiesSignal = signal<Party[]>([]);
  private readonly playersSignal = signal<Player[]>([]);
  readonly parties = this.partiesSignal.asReadonly();
  readonly players = this.playersSignal.asReadonly();

  getParty(id: string) {
    return this.partiesSignal().find((p) => p.id === id);
  }
  getPlayer(id: string) {
    return this.playersSignal().find((p) => p.id === id);
  }
  playersForParty(partyId: string) {
    const party = this.getParty(partyId);
    if (!party) return [];
    return this.playersSignal().filter((p) => party.playerIds.includes(p.id));
  }
  partiesForPlayer(playerId: string) {
    return this.partiesSignal().filter((p) => p.playerIds.includes(playerId));
  }
  createParty(name: string): Party {
    const party: Party = { id: crypto.randomUUID(), ownerId: 'test-gm', name, playerIds: [] };
    this.partiesSignal.update((parties) => [...parties, party]);
    return party;
  }
  renameParty(id: string, name: string): void {
    this.partiesSignal.update((parties) => parties.map((p) => (p.id === id ? { ...p, name } : p)));
  }
  deleteParty(id: string): void {
    this.partiesSignal.update((parties) => parties.filter((p) => p.id !== id));
  }
  addPlayerToParty(partyId: string, playerId: string): void {
    this.partiesSignal.update((parties) => addPlayerIdToParty(parties, partyId, playerId));
  }
  removePlayerFromParty(partyId: string, playerId: string): void {
    this.partiesSignal.update((parties) => removePlayerIdFromParty(parties, partyId, playerId));
  }
  createPlayer(fields: {
    name: string;
    initiativeModifier: number;
    ac: number | null;
    maxHp: number | null;
    notes: string;
    initiativeAdvantage?: InitiativeAdvantageState;
  }): Player {
    const player: Player = {
      id: crypto.randomUUID(),
      ownerId: 'test-gm',
      ...fields,
      initiativeAdvantage: fields.initiativeAdvantage ?? 'none',
    };
    this.playersSignal.update((players) => [...players, player]);
    return player;
  }
  updatePlayer(
    id: string,
    changes: Partial<
      Pick<
        Player,
        'name' | 'initiativeModifier' | 'ac' | 'maxHp' | 'notes' | 'initiativeAdvantage'
      >
    >,
  ): void {
    this.playersSignal.update((players) => players.map((p) => (p.id === id ? { ...p, ...changes } : p)));
  }
  deletePlayer(id: string): void {
    this.playersSignal.update((players) => players.filter((p) => p.id !== id));
    this.partiesSignal.update((parties) => removePlayerIdFromAllParties(parties, id));
  }
}

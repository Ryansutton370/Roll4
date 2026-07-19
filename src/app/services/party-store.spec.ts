import { TestBed } from '@angular/core/testing';

import { PartyStore } from './party-store';

const playerFields = { initiativeModifier: 3, ac: null, maxHp: null, notes: '' };

describe('PartyStore', () => {
  let service: PartyStore;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(PartyStore);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('creates a party with no players', () => {
    const party = service.createParty('The Thursday Night Group');

    expect(party.name).toBe('The Thursday Night Group');
    expect(party.playerIds).toEqual([]);
    expect(service.parties()).toEqual([party]);
  });

  it('creates a player unattached to any party', () => {
    const player = service.createPlayer({ name: 'Aria Windmere', ...playerFields });

    expect(service.players()).toEqual([player]);
    expect(service.partiesForPlayer(player.id)).toEqual([]);
  });

  it('stores the optional AC/Max HP/Notes fields', () => {
    const player = service.createPlayer({
      name: 'Aria Windmere',
      initiativeModifier: 3,
      ac: 16,
      maxHp: 30,
      notes: 'Wields a longsword',
    });

    expect(player).toMatchObject({ ac: 16, maxHp: 30, notes: 'Wields a longsword' });
  });

  it('adds and removes a player from a party', () => {
    const party = service.createParty('Party A');
    const player = service.createPlayer({ name: 'Aria', ...playerFields });

    service.addPlayerToParty(party.id, player.id);
    expect(service.getParty(party.id)?.playerIds).toEqual([player.id]);
    expect(service.playersForParty(party.id)).toEqual([player]);
    expect(service.partiesForPlayer(player.id)).toEqual([{ ...party, playerIds: [player.id] }]);

    service.removePlayerFromParty(party.id, player.id);
    expect(service.getParty(party.id)?.playerIds).toEqual([]);
    expect(service.playersForParty(party.id)).toEqual([]);
  });

  it('adding the same player to a party twice does not duplicate the membership', () => {
    const party = service.createParty('Party A');
    const player = service.createPlayer({ name: 'Aria', ...playerFields });

    service.addPlayerToParty(party.id, player.id);
    service.addPlayerToParty(party.id, player.id);

    expect(service.getParty(party.id)?.playerIds).toEqual([player.id]);
  });

  it('a player can belong to multiple parties at once', () => {
    const partyA = service.createParty('Party A');
    const partyB = service.createParty('Party B');
    const player = service.createPlayer({ name: 'Aria', ...playerFields });

    service.addPlayerToParty(partyA.id, player.id);
    service.addPlayerToParty(partyB.id, player.id);

    expect(service.partiesForPlayer(player.id).map((p) => p.name)).toEqual(['Party A', 'Party B']);
    expect(service.playersForParty(partyA.id)).toEqual([player]);
    expect(service.playersForParty(partyB.id)).toEqual([player]);
  });

  it('updates a player in place', () => {
    const player = service.createPlayer({ name: 'Aria', ...playerFields });

    service.updatePlayer(player.id, { name: 'Aria Windmere', initiativeModifier: 4, ac: 16, maxHp: 30 });

    expect(service.players()).toEqual([
      { ...player, name: 'Aria Windmere', initiativeModifier: 4, ac: 16, maxHp: 30 },
    ]);
  });

  it('deleting a party does NOT delete its players — they stay in the roster', () => {
    const party = service.createParty('Party A');
    const player = service.createPlayer({ name: 'Aria', ...playerFields });
    service.addPlayerToParty(party.id, player.id);

    service.deleteParty(party.id);

    expect(service.parties()).toEqual([]);
    expect(service.players()).toEqual([player]);
  });

  it('deleting a player removes them from every party they belonged to', () => {
    const partyA = service.createParty('Party A');
    const partyB = service.createParty('Party B');
    const player = service.createPlayer({ name: 'Aria', ...playerFields });
    service.addPlayerToParty(partyA.id, player.id);
    service.addPlayerToParty(partyB.id, player.id);

    service.deletePlayer(player.id);

    expect(service.players()).toEqual([]);
    expect(service.getParty(partyA.id)?.playerIds).toEqual([]);
    expect(service.getParty(partyB.id)?.playerIds).toEqual([]);
  });

  it('persists across service instances via localStorage', () => {
    const party = service.createParty('Party A');
    const player = service.createPlayer({ name: 'Aria', ...playerFields });
    service.addPlayerToParty(party.id, player.id);

    // effect() persists asynchronously; flush it before simulating reload.
    TestBed.tick();

    // Simulate a page reload: a fresh injector means a fresh PartyStore,
    // which should load whatever the previous instance last saved.
    TestBed.resetTestingModule();
    const reloaded = TestBed.inject(PartyStore);

    expect(reloaded.parties()).toEqual([{ ...party, playerIds: [player.id] }]);
    expect(reloaded.playersForParty(party.id).map((p) => p.name)).toEqual(['Aria']);
  });
});

import { Party } from '../models/party.model';
import {
  addPlayerIdToParty,
  removePlayerIdFromAllParties,
  removePlayerIdFromParty,
} from './party-store';

// PartyStore itself is thin Firestore glue now (see the file's own
// comments) and isn't unit-tested here — the genuinely pure membership
// logic it delegates to is what's covered, same split EncounterStore
// already uses for its own pure functions. See docs/ARCHITECTURE.md's
// Persistence section for why: no emulator/CI infrastructure exists yet
// to exercise the Firestore calls themselves, so that's covered by manual
// verification instead.

function party(overrides: Partial<Party> = {}): Party {
  return { id: 'party-a', ownerId: 'gm-1', name: 'Party A', playerIds: [], ...overrides };
}

describe('addPlayerIdToParty', () => {
  it('adds a player to the named party', () => {
    const result = addPlayerIdToParty([party()], 'party-a', 'player-1');
    expect(result).toEqual([party({ playerIds: ['player-1'] })]);
  });

  it('does not duplicate an already-present membership', () => {
    const result = addPlayerIdToParty(
      [party({ playerIds: ['player-1'] })],
      'party-a',
      'player-1',
    );
    expect(result).toEqual([party({ playerIds: ['player-1'] })]);
  });

  it('leaves other parties untouched', () => {
    const other = party({ id: 'party-b', name: 'Party B' });
    const result = addPlayerIdToParty([party(), other], 'party-a', 'player-1');
    expect(result).toEqual([party({ playerIds: ['player-1'] }), other]);
  });
});

describe('removePlayerIdFromParty', () => {
  it('removes a player from the named party only', () => {
    const target = party({ playerIds: ['player-1', 'player-2'] });
    const other = party({ id: 'party-b', name: 'Party B', playerIds: ['player-1'] });
    const result = removePlayerIdFromParty([target, other], 'party-a', 'player-1');
    expect(result).toEqual([party({ playerIds: ['player-2'] }), other]);
  });

  it('is a no-op if the player was never a member', () => {
    const result = removePlayerIdFromParty([party()], 'party-a', 'player-1');
    expect(result).toEqual([party()]);
  });
});

describe('removePlayerIdFromAllParties', () => {
  it('removes the player from every party that lists them', () => {
    const partyA = party({ playerIds: ['player-1'] });
    const partyB = party({ id: 'party-b', name: 'Party B', playerIds: ['player-1', 'player-2'] });
    const result = removePlayerIdFromAllParties([partyA, partyB], 'player-1');
    expect(result).toEqual([
      party({ playerIds: [] }),
      party({ id: 'party-b', name: 'Party B', playerIds: ['player-2'] }),
    ]);
  });

  it('leaves parties the player was never in unchanged', () => {
    const result = removePlayerIdFromAllParties([party()], 'player-1');
    expect(result).toEqual([party()]);
  });
});

import { TestBed } from '@angular/core/testing';

import { PartyStore } from './party-store';

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

  it('creates a party with no PCs', () => {
    const party = service.createParty('The Thursday Night Group');

    expect(party.name).toBe('The Thursday Night Group');
    expect(party.pcIds).toEqual([]);
    expect(service.parties()).toEqual([party]);
  });

  it('adds a PC to a party and links it both ways', () => {
    const party = service.createParty('Party A');

    const pc = service.addPc(party.id, 'Aria Windmere', 3);

    expect(pc.partyId).toBe(party.id);
    expect(service.getParty(party.id)?.pcIds).toEqual([pc.id]);
    expect(service.pcsForParty(party.id)).toEqual([pc]);
  });

  it('updates a PC in place', () => {
    const party = service.createParty('Party A');
    const pc = service.addPc(party.id, 'Aria', 3);

    service.updatePc(pc.id, { name: 'Aria Windmere', initiativeModifier: 4 });

    expect(service.pcsForParty(party.id)).toEqual([
      { ...pc, name: 'Aria Windmere', initiativeModifier: 4 },
    ]);
  });

  it('removes a PC and its reference from the party', () => {
    const party = service.createParty('Party A');
    const pc = service.addPc(party.id, 'Aria', 3);

    service.removePc(pc.id);

    expect(service.pcsForParty(party.id)).toEqual([]);
    expect(service.getParty(party.id)?.pcIds).toEqual([]);
  });

  it('deleting a party cascades to its PCs', () => {
    const party = service.createParty('Party A');
    service.addPc(party.id, 'Aria', 3);
    service.addPc(party.id, 'Bram', 1);

    service.deleteParty(party.id);

    expect(service.parties()).toEqual([]);
    expect(service.pcs()).toEqual([]);
  });

  it('persists across service instances via localStorage', () => {
    const party = service.createParty('Party A');
    service.addPc(party.id, 'Aria', 3);

    // effect() persists asynchronously; flush it before simulating reload.
    TestBed.tick();

    // Simulate a page reload: a fresh injector means a fresh PartyStore,
    // which should load whatever the previous instance last saved.
    TestBed.resetTestingModule();
    const reloaded = TestBed.inject(PartyStore);

    // `party` is a snapshot from before addPc ran — state updates are
    // immutable, so its pcIds is stale by design. Compare against the
    // reloaded store's own view instead.
    expect(reloaded.parties()).toEqual([{ ...party, pcIds: [expect.any(String)] }]);
    expect(reloaded.pcsForParty(party.id).map((pc) => pc.name)).toEqual(['Aria']);
  });
});

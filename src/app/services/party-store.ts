import { Service, effect, signal } from '@angular/core';
import { Party, PlayerCharacter } from '../models/party.model';

const STORAGE_KEY = 'roll4.parties';

interface PartyStorageShape {
  parties: Party[];
  pcs: PlayerCharacter[];
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
  private readonly pcsSignal = signal<PlayerCharacter[]>([]);

  // asReadonly() gives components a signal they can read but not `.set()`.
  // All mutation happens through the methods below, so state changes stay
  // in one place instead of being scattered across every component.
  readonly parties = this.partiesSignal.asReadonly();
  readonly pcs = this.pcsSignal.asReadonly();

  constructor() {
    this.load();

    // effect(): a function that re-runs automatically whenever any signal it
    // reads (here, partiesSignal/pcsSignal) changes. This is how we keep
    // localStorage in sync without every mutation method remembering to save
    // — per docs/ARCHITECTURE.md, this is the one place persistence lives.
    effect(() => {
      const snapshot: PartyStorageShape = {
        parties: this.partiesSignal(),
        pcs: this.pcsSignal(),
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
      this.pcsSignal.set(parsed.pcs ?? []);
    } catch {
      // Corrupt/unreadable data — start fresh rather than crash the app.
    }
  }

  getParty(id: string): Party | undefined {
    return this.partiesSignal().find((p) => p.id === id);
  }

  /** All PCs belonging to a given Party, in the order they were added. */
  pcsForParty(partyId: string): PlayerCharacter[] {
    return this.pcsSignal().filter((pc) => pc.partyId === partyId);
  }

  createParty(name: string): Party {
    const party: Party = { id: crypto.randomUUID(), name, pcIds: [] };
    this.partiesSignal.update((parties) => [...parties, party]);
    return party;
  }

  renameParty(id: string, name: string): void {
    this.partiesSignal.update((parties) =>
      parties.map((p) => (p.id === id ? { ...p, name } : p)),
    );
  }

  deleteParty(id: string): void {
    this.partiesSignal.update((parties) => parties.filter((p) => p.id !== id));
    this.pcsSignal.update((pcs) => pcs.filter((pc) => pc.partyId !== id));
  }

  addPc(partyId: string, name: string, initiativeModifier: number): PlayerCharacter {
    const pc: PlayerCharacter = { id: crypto.randomUUID(), partyId, name, initiativeModifier };
    this.pcsSignal.update((pcs) => [...pcs, pc]);
    this.partiesSignal.update((parties) =>
      parties.map((p) => (p.id === partyId ? { ...p, pcIds: [...p.pcIds, pc.id] } : p)),
    );
    return pc;
  }

  updatePc(
    id: string,
    changes: Partial<Pick<PlayerCharacter, 'name' | 'initiativeModifier'>>,
  ): void {
    this.pcsSignal.update((pcs) => pcs.map((pc) => (pc.id === id ? { ...pc, ...changes } : pc)));
  }

  removePc(id: string): void {
    const pc = this.pcsSignal().find((p) => p.id === id);
    if (!pc) return;
    this.pcsSignal.update((pcs) => pcs.filter((p) => p.id !== id));
    this.partiesSignal.update((parties) =>
      parties.map((p) =>
        p.id === pc.partyId ? { ...p, pcIds: p.pcIds.filter((pcId) => pcId !== id) } : p,
      ),
    );
  }
}

/**
 * A synchronous, in-memory stand-in for the 'firebase/firestore' module,
 * used only in tests (see encounter-store.spec.ts's header comment for
 * why EncounterStore specifically needs this rather than a plain
 * Fake*Store like PartyStore/NpcStore get). Every write applies
 * immediately and synchronously notifies any onSnapshot listener
 * subscribed to that collection — real Firestore is asynchronous, but a
 * synchronous double is what lets EncounterStore's existing "call a
 * mutation method, assert immediately" tests keep working unchanged.
 *
 * Module-level state (not inside createFakeFirestoreModule) so that both
 * the vi.mock('firebase/firestore', ...) factory (which calls
 * createFakeFirestoreModule() to build the mocked module) and this
 * module's own __resetFakeFirestore export (imported directly by the
 * spec file, bypassing the mock) operate on the exact same data — ES
 * modules are singletons, so every import of this file resolves to one
 * shared instance regardless of which of the two ways it's reached.
 */

type DocRef = { collection: string; id: string };
type Listener = (docs: unknown[]) => void;

const collections = new Map<string, Map<string, unknown>>();
const listeners = new Map<string, Set<Listener>>();

function getCollection(name: string): Map<string, unknown> {
  let c = collections.get(name);
  if (!c) {
    c = new Map();
    collections.set(name, c);
  }
  return c;
}

function notify(name: string): void {
  const docs = [...getCollection(name).values()];
  (listeners.get(name) ?? new Set()).forEach((cb) => cb(docs));
}

export function __resetFakeFirestore(): void {
  collections.clear();
  listeners.clear();
}

export function createFakeFirestoreModule() {
  return {
    // firebase.ts calls getFirestore(firebaseApp) at module load time
    // (see its own comment) — the returned value is never inspected by
    // anything in this mock (every function below ignores its `_db`
    // first argument), it just needs to exist so that call doesn't throw.
    getFirestore: (): object => ({}),
    collection: (_db: unknown, name: string): { collection: string } => ({ collection: name }),
    doc: (_db: unknown, name: string, id: string): DocRef => ({ collection: name, id }),
    // query()/where() do no real filtering — every doc created in these
    // tests already belongs to the one FakeAuthService uid, so there's
    // nothing to filter out; ownerId-scoping itself is covered by the
    // live manual verification (see the Phase 3.3/3.4/3.5 checklists),
    // not by these unit tests.
    query: (collRef: unknown) => collRef,
    where: (): unknown => ({}),
    onSnapshot: (
      collRef: { collection: string },
      callback: (snap: { docs: { data: () => unknown }[] }) => void,
    ): (() => void) => {
      const name = collRef.collection;
      const wrapped: Listener = (docs) => callback({ docs: docs.map((d) => ({ data: () => d })) });
      wrapped([...getCollection(name).values()]);
      let set = listeners.get(name);
      if (!set) {
        set = new Set();
        listeners.set(name, set);
      }
      set.add(wrapped);
      return () => set!.delete(wrapped);
    },
    setDoc: (ref: DocRef, data: unknown): Promise<void> => {
      getCollection(ref.collection).set(ref.id, data);
      notify(ref.collection);
      return Promise.resolve();
    },
    updateDoc: (ref: DocRef, changes: object): Promise<void> => {
      const c = getCollection(ref.collection);
      c.set(ref.id, { ...(c.get(ref.id) as object), ...changes });
      notify(ref.collection);
      return Promise.resolve();
    },
    deleteDoc: (ref: DocRef): Promise<void> => {
      getCollection(ref.collection).delete(ref.id);
      notify(ref.collection);
      return Promise.resolve();
    },
    writeBatch: () => {
      const ops: (() => void)[] = [];
      const touched = new Set<string>();
      return {
        set: (ref: DocRef, data: unknown): void => {
          touched.add(ref.collection);
          ops.push(() => getCollection(ref.collection).set(ref.id, data));
        },
        update: (ref: DocRef, changes: object): void => {
          touched.add(ref.collection);
          ops.push(() => {
            const c = getCollection(ref.collection);
            c.set(ref.id, { ...(c.get(ref.id) as object), ...changes });
          });
        },
        delete: (ref: DocRef): void => {
          touched.add(ref.collection);
          ops.push(() => getCollection(ref.collection).delete(ref.id));
        },
        commit: (): Promise<void> => {
          ops.forEach((op) => op());
          touched.forEach((name) => notify(name));
          return Promise.resolve();
        },
      };
    },
    arrayUnion: (...items: unknown[]): { __arrayUnion: unknown[] } => ({ __arrayUnion: items }),
    arrayRemove: (...items: unknown[]): { __arrayRemove: unknown[] } => ({ __arrayRemove: items }),
  };
}

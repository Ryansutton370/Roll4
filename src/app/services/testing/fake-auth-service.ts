/**
 * A stand-in AuthService for tests — always "signed in" as a fixed test
 * uid, never touches real Firebase Auth. Pairs with the in-memory
 * 'firebase/firestore' mock (see encounter-store.spec.ts) so a
 * Firestore-backed store's actual business logic can be exercised in a
 * unit test without a real or emulated backend.
 */
export class FakeAuthService {
  uid(): string {
    return 'test-gm';
  }
  ready(): Promise<void> {
    return Promise.resolve();
  }
}

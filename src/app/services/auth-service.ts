import { Service, computed, signal } from '@angular/core';
import {
  GoogleAuthProvider,
  User as FirebaseUser,
  UserCredential,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { auth } from '../firebase';

/**
 * Wraps Firebase Auth the same way every other *Store wraps its own
 * persistence — components never touch `firebase/auth` directly, they
 * inject this and read a signal / call a method.
 */
@Service()
export class AuthService {
  // undefined = auth state not yet resolved (cold page load, before
  // Firebase has checked whether a session is already persisted); null =
  // signed out; a FirebaseUser = signed in. Route guards always await
  // ready() before reading this, so components only ever see null/User.
  private readonly userSignal = signal<FirebaseUser | null | undefined>(undefined);
  readonly user = this.userSignal.asReadonly();

  // computed(): a signal derived from another signal — recalculates only
  // when userSignal() actually changes, and any component reading uid()
  // re-renders automatically when it does, same as reading a plain
  // signal.
  readonly uid = computed(() => this.userSignal()?.uid ?? null);

  constructor() {
    // onAuthStateChanged is Firebase's own subscription API (not an
    // Angular one) — it fires once immediately with the current state,
    // then again on every sign-in/sign-out. Bridging its callback into a
    // signal here is what lets the rest of the app treat "am I signed
    // in" as a normal reactive signal instead of a raw Firebase callback.
    onAuthStateChanged(auth, (user) => this.userSignal.set(user));
  }

  /** Resolves once Firebase Auth has checked for a persisted session — see the auth guards, which await this before redirecting. */
  ready(): Promise<void> {
    return auth.authStateReady();
  }

  signUpWithEmail(email: string, password: string): Promise<UserCredential> {
    return createUserWithEmailAndPassword(auth, email, password);
  }

  signInWithEmail(email: string, password: string): Promise<UserCredential> {
    return signInWithEmailAndPassword(auth, email, password);
  }

  signInWithGoogle(): Promise<UserCredential> {
    return signInWithPopup(auth, new GoogleAuthProvider());
  }

  signOutUser(): Promise<void> {
    return signOut(auth);
  }
}

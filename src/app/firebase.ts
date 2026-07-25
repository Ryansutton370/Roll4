import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { environment } from '../environments/environment';

// Module-level singletons, initialized once on first import — same
// lifecycle as any other module-level constant in this codebase (e.g.
// crypto.randomUUID() used directly, with no DI wrapper). Every
// Firestore/Auth-backed service imports firestore/auth from here rather
// than each calling initializeApp itself.
export const firebaseApp = initializeApp(environment.firebaseConfig);
export const firestore = getFirestore(firebaseApp);
export const auth = getAuth(firebaseApp);

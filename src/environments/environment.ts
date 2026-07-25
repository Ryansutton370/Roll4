// Firebase's web config object is a public client identifier, not a
// secret — it's safe to commit. Firestore Security Rules (see
// firestore.rules) are what actually enforce access control, server-side;
// nothing about hiding this object would add real protection. See
// docs/ARCHITECTURE.md's "Persistence" section for the full reasoning.
//
// Replace the placeholder values below with your real Firebase project's
// config (Firebase console → Project settings → your Web app → SDK setup
// and configuration → Config). Both this file and environment.prod.ts
// currently point at the same project — see docs/ARCHITECTURE.md for why
// a single project is enough for now.
export const environment = {
  production: false,
  firebaseConfig: {
    apiKey: 'AIzaSyC-SoucXtONNoTy5SOuZ3NlmwcHBc4kGXM',
    authDomain: 'roll4-bddd2.firebaseapp.com',
    projectId: 'roll4-bddd2',
    storageBucket: 'roll4-bddd2.firebasestorage.app',
    messagingSenderId: '571421190801',
    appId: '1:571421190801:web:43f4ccda43cad789e82d30',
  },
};

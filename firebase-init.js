// Shared Firebase bootstrap. Requires firebase-config.js and the compat SDK
// scripts to be loaded first (see index.html / admin.html <head>).
firebase.initializeApp(FIREBASE_CONFIG);
const db = firebase.firestore();
const auth = firebase.auth();

// Everyone (students and the teacher's admin panel) signs in anonymously so
// Firestore security rules can require request.auth != null. This app does
// NOT use Firebase's email/password auth — login is a custom class/roll-no/
// password check against Firestore (see README for the security trade-off).
function ensureAnonAuth() {
  return new Promise((resolve, reject) => {
    if (auth.currentUser) return resolve(auth.currentUser);
    auth.signInAnonymously().catch(reject);
    auth.onAuthStateChanged(user => { if (user) resolve(user); });
  });
}

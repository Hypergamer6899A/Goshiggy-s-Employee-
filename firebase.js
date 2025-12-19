import admin from "firebase-admin";

export function initFirebase(env) {
  const {
    FIREBASE_PROJECT_ID,
    FIREBASE_CLIENT_EMAIL,
    FIREBASE_PRIVATE_KEY,
  } = env;

  if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
    throw new Error("❌ Missing Firebase credentials");
  }

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: FIREBASE_PROJECT_ID,
        clientEmail: FIREBASE_CLIENT_EMAIL,
        privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      }),
    });
  }

  const db = admin.firestore();

  console.log("🔥 Firebase initialized");

  return { db };
}

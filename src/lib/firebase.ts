import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let _app: FirebaseApp | undefined;
let _auth: Auth | undefined;
let _db: Firestore | undefined;

function getApp(): FirebaseApp {
  if (_app) return _app;
  _app =
    getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  return _app;
}

export function getClientAuth(): Auth {
  if (_auth) return _auth;
  _auth = getAuth(getApp());
  return _auth;
}

export function getClientDb(): Firestore {
  if (_db) {
    // #region agent log
    if (typeof fetch !== "undefined") {
      fetch("http://127.0.0.1:7242/ingest/90433ca3-f8b2-48ed-ba4c-cb0cc7fb2fa2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location: "firebase.ts:getClientDb-cached",
          message: "getClientDb returned cached",
          data: { constructorName: _db?.constructor?.name, hypothesisId: "H2" },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
    }
    // #endregion
    return _db;
  }
  try {
    _db = initializeFirestore(getApp(), {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    });
  } catch {
    _db = getFirestore(getApp());
  }
  // #region agent log
  if (typeof fetch !== "undefined") {
    fetch("http://127.0.0.1:7242/ingest/90433ca3-f8b2-48ed-ba4c-cb0cc7fb2fa2", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "firebase.ts:getClientDb-init",
        message: "getClientDb initialized",
        data: { constructorName: _db?.constructor?.name, hypothesisId: "H2" },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
  }
  // #endregion
  return _db;
}

// Convenience aliases for existing imports
export const auth = new Proxy({} as Auth, {
  get(_, prop) {
    return (getClientAuth() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export const db = new Proxy({} as Firestore, {
  get(_, prop) {
    return (getClientDb() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

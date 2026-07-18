import type { GameState } from "../engine/types.ts";
import { LocalStorageProvider } from "./localSave.ts";
import { metaOf, type SaveMeta, type SaveProvider } from "./saveProvider.ts";

// Firebase-backed saves: anonymous auth + one Firestore document per slot at
// users/{uid}/saves/{slot} with the whole GameState as a JSON blob (single-doc
// strategy per §7.3 — revisit if late-game states approach the 1 MB limit).
//
// Activation: define these in .env.local (all from your Firebase web app config):
//   VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID,
//   VITE_FIREBASE_APP_ID
// Without them, firebaseAvailable() is false and the app uses browser storage.

export function firebaseConfig() {
  const env = import.meta.env;
  const apiKey = env.VITE_FIREBASE_API_KEY;
  const projectId = env.VITE_FIREBASE_PROJECT_ID;
  if (!apiKey || !projectId) return null;
  return {
    apiKey,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN ?? `${projectId}.firebaseapp.com`,
    projectId,
    appId: env.VITE_FIREBASE_APP_ID,
  };
}

export function firebaseAvailable(): boolean {
  return firebaseConfig() !== null;
}

export class FirebaseProvider implements SaveProvider {
  readonly name = "Firebase cloud save";
  private ready: Promise<{ db: import("firebase/firestore").Firestore; uid: string }> | null = null;

  private init() {
    if (!this.ready) {
      this.ready = (async () => {
        const cfg = firebaseConfig();
        if (!cfg) throw new Error("Firebase config missing");
        const { initializeApp } = await import("firebase/app");
        const { getAuth, signInAnonymously } = await import("firebase/auth");
        const { getFirestore } = await import("firebase/firestore");
        const app = initializeApp(cfg);
        const auth = getAuth(app);
        const cred = await signInAnonymously(auth);
        return { db: getFirestore(app), uid: cred.user.uid };
      })();
    }
    return this.ready;
  }

  async list(): Promise<SaveMeta[]> {
    const { db, uid } = await this.init();
    const { collection, getDocs } = await import("firebase/firestore");
    const snap = await getDocs(collection(db, "users", uid, "saves"));
    return snap.docs.map((d) => d.data().meta as SaveMeta);
  }

  async save(slot: string, state: GameState): Promise<void> {
    const { db, uid } = await this.init();
    const { doc, setDoc } = await import("firebase/firestore");
    await setDoc(doc(db, "users", uid, "saves", slot), {
      meta: metaOf(slot, state),
      blob: JSON.stringify(state),
    });
  }

  async load(slot: string): Promise<GameState | null> {
    const { db, uid } = await this.init();
    const { doc, getDoc } = await import("firebase/firestore");
    const snap = await getDoc(doc(db, "users", uid, "saves", slot));
    if (!snap.exists()) return null;
    return JSON.parse(snap.data().blob as string) as GameState;
  }

  async remove(slot: string): Promise<void> {
    const { db, uid } = await this.init();
    const { doc, deleteDoc } = await import("firebase/firestore");
    await deleteDoc(doc(db, "users", uid, "saves", slot));
  }
}

export function makeSaveProvider(): SaveProvider {
  if (firebaseAvailable()) return new FirebaseProvider();
  return new LocalStorageProvider();
}

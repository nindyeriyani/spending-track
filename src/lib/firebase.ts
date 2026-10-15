import { initializeApp, getApps, getApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager, type Firestore } from "firebase/firestore";

// Diisi dari .env.local (Firebase Console -> Project Settings -> General -> Your apps)
const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// Initialize Firebase
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
// getAuth di browser sudah memakai persistence lokal (sesi bertahan setelah tab ditutup)
const auth = getAuth(app);
const db = createFirestore();

// NEXT_PUBLIC_FIREBASE_EMULATORS=true memakai emulator lokal (`npm run emulators`), bukan project asli
if (process.env.NEXT_PUBLIC_FIREBASE_EMULATORS === "true" && typeof window !== "undefined" && !auth.emulatorConfig) {
    connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
    connectFirestoreEmulator(db, "127.0.0.1", 8080);
}

// Di browser, data dan tulisan yang belum tersinkron disimpan di IndexedDB,
// jadi transaksi yang dicatat saat offline tidak hilang walau tab ditutup.
function createFirestore(): Firestore {
    if (typeof window === "undefined") return getFirestore(app);
    try {
        return initializeFirestore(app, {
            localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
        });
    } catch {
        // Sudah diinisialisasi sebelumnya (mis. saat hot reload)
        return getFirestore(app);
    }
}

export { auth, db };

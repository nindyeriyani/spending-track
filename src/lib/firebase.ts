import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager, type Firestore } from "firebase/firestore";

// TODO: Replace with your Firebase project configuration
// You can find this in Firebase Console -> Project Settings -> General -> Your apps
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

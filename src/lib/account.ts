import { collection, getDocs, writeBatch, terminate, clearIndexedDbPersistence } from "firebase/firestore";
import {
    deleteUser, reauthenticateWithCredential, reauthenticateWithPopup,
    EmailAuthProvider, GoogleAuthProvider, type User,
} from "firebase/auth";
import { db } from "./firebase";

// Semua data user ada di subkoleksi users/{uid}/... (dokumen users/{uid} sendiri tidak pernah ditulis)
const USER_COLLECTIONS = ["transactions", "goals", "budgets", "categories"] as const;

export function signsInWithPassword(user: User): boolean {
    return user.providerData.some((p) => p.providerId === EmailAuthProvider.PROVIDER_ID);
}

// Firebase hanya mengizinkan hapus akun kalau login-nya baru, jadi user diminta login ulang lebih dulu.
// Dilakukan sebelum data dihapus supaya tidak ada akun yang tersisa tanpa data karena login ulang gagal.
export async function reauthenticate(user: User, password?: string): Promise<void> {
    if (signsInWithPassword(user)) {
        if (!user.email || !password) throw new Error("Password diperlukan.");
        await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
    } else {
        await reauthenticateWithPopup(user, new GoogleAuthProvider());
    }
}

// Hapus semua data lalu akunnya. Harus online: getDocs perlu membaca server supaya tidak ada dokumen
// yang terlewat karena belum ada di cache perangkat.
export async function deleteAccount(user: User): Promise<void> {
    for (const name of USER_COLLECTIONS) {
        const snapshot = await getDocs(collection(db, "users", user.uid, name));
        // Satu batch Firestore maksimal 500 operasi
        for (let i = 0; i < snapshot.docs.length; i += 500) {
            const batch = writeBatch(db);
            snapshot.docs.slice(i, i + 500).forEach((d) => batch.delete(d.ref));
            await batch.commit();
        }
    }
    await deleteUser(user);

    // Bersihkan salinan data di perangkat ini (cache offline Firestore dan penanda migrasi)
    try {
        localStorage.removeItem(`categoryId-migrated:${user.uid}`);
    } catch {
        // Storage tidak tersedia; tidak ada yang perlu dihapus
    }
    try {
        await terminate(db);
        await clearIndexedDbPersistence(db);
    } catch (err) {
        console.error("Gagal membersihkan cache perangkat:", err);
    }
}

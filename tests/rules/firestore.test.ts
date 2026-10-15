import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";

let env: RulesTestEnvironment;

beforeAll(async () => {
    // Host dan port emulator dibaca dari FIRESTORE_EMULATOR_HOST yang diisi `firebase emulators:exec`
    env = await initializeTestEnvironment({
        projectId: "demo-spending-track",
        firestore: { rules: readFileSync("firestore.rules", "utf8") },
    });
});

beforeEach(() => env.clearFirestore());
afterAll(() => env.cleanup());

const alice = () => env.authenticatedContext("alice").firestore();
const bob = () => env.authenticatedContext("bob").firestore();
const guest = () => env.unauthenticatedContext().firestore();

// Transaksi versi lama (sebelum ada categoryId) dan versi sekarang
const legacyTransaction = { type: "expense", amount: 25_000, category: "Makan", date: "2026-10-15", note: "" };
const validTransaction = { ...legacyTransaction, categoryId: "c1" };
const validCategory = { name: "Makan", icon: "utensils", type: "expense", savings: false };

// Isi data langsung tanpa melewati rules
async function seed(path: string, data: Record<string, unknown>) {
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), path), data));
}

describe("akses antar akun", () => {
    it("pemilik bisa membaca datanya sendiri", async () => {
        await seed("users/alice/transactions/t1", validTransaction);
        await assertSucceeds(getDoc(doc(alice(), "users/alice/transactions/t1")));
    });

    it("akun lain dan tamu tidak bisa membaca atau menghapus", async () => {
        await seed("users/alice/transactions/t1", validTransaction);
        await assertFails(getDoc(doc(bob(), "users/alice/transactions/t1")));
        await assertFails(getDoc(doc(guest(), "users/alice/transactions/t1")));
        await assertFails(deleteDoc(doc(bob(), "users/alice/transactions/t1")));
    });

    it("akun lain tidak bisa menulis ke data pemilik", async () => {
        await assertFails(setDoc(doc(bob(), "users/alice/transactions/t1"), validTransaction));
    });

    it("pemilik bisa menghapus datanya (dipakai saat hapus akun)", async () => {
        for (const path of ["transactions/t1", "categories/c1", "budgets/c1", "goals/g1"]) {
            await seed(`users/alice/${path}`, { x: 1 });
            await assertSucceeds(deleteDoc(doc(alice(), `users/alice/${path}`)));
        }
    });

    it("path di luar users/{uid}/... ditolak", async () => {
        await assertFails(setDoc(doc(alice(), "users/alice"), { name: "Alice" }));
        await assertFails(setDoc(doc(alice(), "users/alice/lainnya/x"), { a: 1 }));
        await assertFails(getDoc(doc(alice(), "config/app")));
    });
});

describe("transaksi", () => {
    const tx = (data: Record<string, unknown>) => setDoc(doc(alice(), "users/alice/transactions/t1"), data);

    it("menerima transaksi valid, dengan atau tanpa categoryId dan createdAt", async () => {
        await assertSucceeds(tx({ ...validTransaction, createdAt: serverTimestamp() }));
        await assertSucceeds(tx(legacyTransaction));
    });

    it("menolak jumlah nol/negatif, tanggal salah format, dan field tambahan", async () => {
        await assertFails(tx({ ...validTransaction, amount: 0 }));
        await assertFails(tx({ ...validTransaction, amount: -1 }));
        await assertFails(tx({ ...validTransaction, amount: "25000" }));
        await assertFails(tx({ ...validTransaction, date: "15/10/2026" }));
        await assertFails(tx({ ...validTransaction, type: "transfer" }));
        await assertFails(tx({ ...validTransaction, admin: true }));
    });

    it("menolak categoryId dengan format tidak wajar", async () => {
        await assertFails(tx({ ...validTransaction, categoryId: "" }));
        await assertFails(tx({ ...validTransaction, categoryId: "../c1" }));
        await assertFails(tx({ ...validTransaction, categoryId: 123 }));
    });

    it("melengkapi categoryId pada transaksi lama diizinkan", async () => {
        await seed("users/alice/transactions/t1", legacyTransaction);
        await assertSucceeds(updateDoc(doc(alice(), "users/alice/transactions/t1"), { categoryId: "c1" }));
    });
});

describe("kategori", () => {
    const category = (data: Record<string, unknown>) => setDoc(doc(alice(), "users/alice/categories/c1"), data);

    it("menerima kategori valid", async () => {
        await assertSucceeds(category({ ...validCategory, createdAt: serverTimestamp() }));
    });

    it("kategori pemasukan tidak boleh ditandai tabungan", async () => {
        await assertSucceeds(category({ ...validCategory, type: "income" }));
        await assertFails(category({ ...validCategory, type: "income", savings: true }));
    });

    it("menolak nama kosong atau terlalu panjang dan ikon yang bukan nama ikon", async () => {
        await assertFails(category({ ...validCategory, name: "" }));
        await assertFails(category({ ...validCategory, name: "x".repeat(51) }));
        await assertFails(category({ ...validCategory, icon: "<script>" }));
    });
});

describe("budget", () => {
    const budget = (data: Record<string, unknown>) => setDoc(doc(alice(), "users/alice/budgets/c1"), data);

    it("menerima budget valid dengan atau tanpa categoryId", async () => {
        await assertSucceeds(budget({ category: "Makan", categoryId: "c1", limit: 500_000 }));
        await assertSucceeds(budget({ category: "Makan", limit: 500_000 }));
    });

    it("menolak batas nol dan field tambahan", async () => {
        await assertFails(budget({ category: "Makan", limit: 0 }));
        await assertFails(budget({ category: "Makan", limit: 500_000, spent: 0 }));
    });
});

describe("target", () => {
    const goal = (data: Record<string, unknown>) => setDoc(doc(alice(), "users/alice/goals/g1"), data);

    it("menerima target biasa dan target yang terhubung ke kategori", async () => {
        await assertSucceeds(goal({ name: "Liburan", targetAmount: 5_000_000, currentAmount: 0 }));
        await assertSucceeds(goal({ name: "Dana darurat", targetAmount: 5_000_000, currentAmount: 100_000, category: "Tabungan", categoryId: "c2" }));
    });

    it("menolak target nol dan terkumpul negatif", async () => {
        await assertFails(goal({ name: "Liburan", targetAmount: 0, currentAmount: 0 }));
        await assertFails(goal({ name: "Liburan", targetAmount: 5_000_000, currentAmount: -1 }));
    });
});

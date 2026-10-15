import { FirebaseError } from "firebase/app";
import type { Timestamp } from "firebase/firestore";

export type TransactionType = "income" | "expense";

// Bentuk dokumen di users/{uid}/transactions
export interface TransactionInput {
    type: TransactionType;
    amount: number;
    category: string; // nama kategori saat ditulis; cadangan kalau kategorinya sudah dihapus
    categoryId?: string; // dokumen lama belum punya field ini sampai dimigrasi (lihat src/lib/categories.ts)
    date: string; // "YYYY-MM-DD", tanggal lokal
    note: string;
    createdAt?: Timestamp; // waktu input; transaksi lama tidak punya field ini
}

export interface Transaction extends TransactionInput {
    id: string;
}

// Bentuk dokumen di users/{uid}/categories. Nama unik per user (tidak peka huruf besar/kecil).
// `savings` hanya bermakna untuk kategori pengeluaran.
export interface CategoryInput {
    name: string;
    icon: string; // nama ikon Font Awesome, mis. "utensils"
    type: TransactionType;
    savings: boolean;
    createdAt?: Timestamp;
}

export interface Category extends CategoryInput {
    id: string;
}

// Bentuk dokumen di users/{uid}/goals.
// Kalau `category` diisi, target terhubung ke kategori pengeluaran itu: `currentAmount` menjadi saldo awal
// dan total semua transaksi di kategori tersebut ditambahkan otomatis (lihat src/lib/goals.ts).
export interface GoalInput {
    name: string;
    targetAmount: number;
    currentAmount: number;
    category?: string;
    categoryId?: string;
}

export interface Goal extends GoalInput {
    id: string;
}

// Bentuk dokumen di users/{uid}/budgets/{categoryId}.
// ID dokumen = ID kategori, jadi satu kategori hanya punya satu budget yang berlaku tiap bulan.
export interface BudgetInput {
    category: string;
    categoryId?: string;
    limit: number;
}

export interface Budget extends BudgetInput {
    id: string;
}

export function errorMessage(err: unknown, fallback: string): string {
    return err instanceof Error && err.message ? err.message : fallback;
}

export function errorCode(err: unknown): string | undefined {
    return err instanceof FirebaseError ? err.code : undefined;
}

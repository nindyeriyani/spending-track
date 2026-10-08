import { FirebaseError } from "firebase/app";

export type TransactionType = "income" | "expense";

// Bentuk dokumen di users/{uid}/transactions
export interface TransactionInput {
    type: TransactionType;
    amount: number;
    category: string;
    date: string; // "YYYY-MM-DD", tanggal lokal
    note: string;
}

export interface Transaction extends TransactionInput {
    id: string;
}

// Bentuk dokumen di users/{uid}/goals
export interface GoalInput {
    name: string;
    targetAmount: number;
    currentAmount: number;
}

export interface Goal extends GoalInput {
    id: string;
}

export function errorMessage(err: unknown, fallback: string): string {
    return err instanceof Error && err.message ? err.message : fallback;
}

export function errorCode(err: unknown): string | undefined {
    return err instanceof FirebaseError ? err.code : undefined;
}

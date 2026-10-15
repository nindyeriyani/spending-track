import type { Budget, Goal, Transaction } from "@/lib/types";

export type Tab = "overview" | "budget" | "goals";

// Angka di form edit disimpan sebagai string supaya field bisa dikosongkan saat mengetik
export type EditableTransaction = Omit<Transaction, "amount"> & { amount: string };
// `category` "" berarti target tidak dihubungkan ke kategori
export type EditableGoal = Omit<Goal, "targetAmount" | "currentAmount" | "category"> & { targetAmount: string; currentAmount: string; category: string };
export type EditableBudget = Omit<Budget, "limit"> & { limit: string };

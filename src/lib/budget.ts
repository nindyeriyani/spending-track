import type { Transaction } from "./types";

// Mulai dari persentase ini budget dianggap hampir habis
export const BUDGET_WARNING_RATIO = 0.8;

export type BudgetStatus = "safe" | "warning" | "over";

export function budgetStatus(spent: number, limit: number): BudgetStatus {
    if (spent > limit) return "over";
    if (spent >= limit * BUDGET_WARNING_RATIO) return "warning";
    return "safe";
}

// Total pengeluaran per kategori dari daftar transaksi (pemasukan diabaikan)
export function spentByCategory(transactions: Transaction[]): Map<string, number> {
    const spent = new Map<string, number>();
    for (const tx of transactions) {
        if (tx.type !== "expense") continue;
        spent.set(tx.category, (spent.get(tx.category) ?? 0) + tx.amount);
    }
    return spent;
}

// Jumlah hari tersisa di bulan berjalan, termasuk hari ini
export function daysLeftInMonth(today: Date): number {
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    return lastDay - today.getDate() + 1;
}

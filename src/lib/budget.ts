import type { Transaction } from "./types";

// Mulai dari persentase ini budget dianggap hampir habis
export const BUDGET_WARNING_RATIO = 0.8;

// Budget pengeluaran: aman / hampir habis / terlampaui.
// Budget tabungan dibaca terbalik: mencapai batas itu baik, jadi statusnya menabung / tercapai.
export type BudgetStatus = "safe" | "warning" | "over" | "saving" | "saved";

export function budgetStatus(spent: number, limit: number, isSavings = false): BudgetStatus {
    if (isSavings) return spent >= limit ? "saved" : "saving";
    if (spent > limit) return "over";
    if (spent >= limit * BUDGET_WARNING_RATIO) return "warning";
    return "safe";
}

export function needsAttention(status: BudgetStatus): boolean {
    return status === "warning" || status === "over";
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

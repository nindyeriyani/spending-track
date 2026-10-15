import type { GoalInput } from "./types";

// Jumlah terkumpul sebuah target. Target yang terhubung ke kategori = saldo awal + total semua
// transaksi pengeluaran di kategori itu (sepanjang waktu); target biasa memakai angka manual.
export function goalSaved(goal: GoalInput, spentAllTime: ReadonlyMap<string, number>): number {
    return goal.currentAmount + (goal.category ? spentAllTime.get(goal.category) ?? 0 : 0);
}

export function isGoalReached(saved: number, targetAmount: number): boolean {
    return saved >= targetAmount;
}

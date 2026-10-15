import { describe, expect, it } from "vitest";
import { budgetNoteForExpense, buildBudgetRows, buildGoalRows, monthTotals, summarizeBudgets, unbudgetedSpending } from "./summary";
import type { Budget, Category, Transaction } from "./types";

const tx = (category: string, amount: number, type: Transaction["type"] = "expense"): Transaction =>
    ({ id: `${category}-${amount}`, type, amount, category, date: "2026-10-01", note: "" });
const isSavings = (name: string) => name === "Tabungan";

describe("monthTotals", () => {
    it("memisahkan tabungan dari pengeluaran dan mengurangkan keduanya dari saldo", () => {
        const totals = monthTotals([tx("Gaji", 5_000_000, "income"), tx("Makan", 1_000_000), tx("Tabungan", 1_500_000)], isSavings);
        expect(totals).toEqual({ income: 5_000_000, expense: 1_000_000, savings: 1_500_000, balance: 2_500_000 });
    });

    it("bulan tanpa transaksi bernilai nol", () => {
        expect(monthTotals([], isSavings)).toEqual({ income: 0, expense: 0, savings: 0, balance: 0 });
    });
});

const categories: Category[] = [
    { id: "c1", name: "Makan", icon: "utensils", type: "expense", savings: false },
    { id: "c2", name: "Transport", icon: "car", type: "expense", savings: false },
    { id: "c3", name: "Tabungan", icon: "piggy-bank", type: "expense", savings: true },
];
const budgets: Budget[] = [
    { id: "b-old", category: "Kategori Lama", limit: 100_000 },
    { id: "c2", category: "Transport", limit: 500_000 },
    { id: "c3", category: "Tabungan", limit: 1_000_000 },
    { id: "c1", category: "Makan", limit: 1_000_000 },
];
const spent = new Map([["Makan", 900_000], ["Transport", 600_000], ["Tabungan", 1_000_000], ["Hiburan", 200_000], ["Jajan", 50_000]]);

describe("buildBudgetRows", () => {
    const rows = buildBudgetRows(budgets, spent, categories, isSavings);

    it("diurutkan sesuai daftar kategori, kategori yang sudah dihapus paling bawah", () => {
        expect(rows.map((r) => r.category)).toEqual(["Makan", "Transport", "Tabungan", "Kategori Lama"]);
    });

    it("menghitung pemakaian dan status tiap budget", () => {
        expect(rows.map((r) => [r.spent, r.status])).toEqual([[900_000, "warning"], [600_000, "over"], [1_000_000, "saved"], [0, "safe"]]);
    });
});

describe("summarizeBudgets", () => {
    const rows = buildBudgetRows(budgets, spent, categories, isSavings);

    it("tabungan tidak ikut dihitung sebagai sisa budget belanja", () => {
        const summary = summarizeBudgets(rows, 10);
        expect(summary).toMatchObject({ totalLimit: 1_600_000, totalSpent: 1_500_000, remaining: 100_000, alertCount: 2, savingsPlanned: 1_000_000, savingsDone: 1_000_000 });
    });

    it("saran harian = sisa dibagi hari tersisa, dibulatkan ke bawah", () => {
        expect(summarizeBudgets(rows, 3).dailyAllowance).toBe(33_333);
    });

    it("tidak ada saran harian kalau budget sudah habis atau bukan bulan berjalan", () => {
        const over = buildBudgetRows([{ id: "c2", category: "Transport", limit: 500_000 }], spent, categories, isSavings);
        expect(summarizeBudgets(over, 10).dailyAllowance).toBe(0);
        expect(summarizeBudgets(rows, 0).dailyAllowance).toBe(0);
    });
});

describe("unbudgetedSpending", () => {
    it("hanya kategori tanpa budget, dari yang terbesar", () => {
        expect(unbudgetedSpending(budgets, spent)).toEqual([["Hiburan", 200_000], ["Jajan", 50_000]]);
    });
});

describe("buildGoalRows", () => {
    it("menghitung progres dan membatasinya di 0-100%", () => {
        const rows = buildGoalRows([
            { id: "g1", name: "Liburan", targetAmount: 1_000_000, currentAmount: 250_000 },
            { id: "g2", name: "Darurat", targetAmount: 1_000_000, currentAmount: 500_000, category: "Tabungan" },
        ], new Map([["Tabungan", 1_000_000]]));
        expect(rows.map((g) => [g.saved, g.progress, g.reached])).toEqual([[250_000, 25, false], [1_500_000, 100, true]]);
    });
});

describe("budgetNoteForExpense", () => {
    const base = { category: "Makan", limit: 1_000_000, isSavings: false, when: "bulan ini" };

    it("memperingatkan saat pemakaian pertama kali melewati 80%", () => {
        expect(budgetNoteForExpense({ ...base, spentBefore: 700_000, amount: 150_000 }))
            .toEqual({ message: "Budget Makan bulan ini sudah terpakai 85%. Sisa Rp 150.000.", isError: false });
    });

    it("tidak mengulang peringatan 80% kalau sebelumnya sudah lewat 80%", () => {
        expect(budgetNoteForExpense({ ...base, spentBefore: 850_000, amount: 50_000 })).toBeNull();
    });

    it("menandai error saat budget terlampaui", () => {
        expect(budgetNoteForExpense({ ...base, spentBefore: 950_000, amount: 100_000 }))
            .toEqual({ message: "Budget Makan bulan ini terlampaui Rp 50.000.", isError: true });
    });

    it("untuk tabungan, memberi kabar baik saat rencana tercapai", () => {
        const savings = { ...base, category: "Tabungan", isSavings: true };
        expect(budgetNoteForExpense({ ...savings, spentBefore: 900_000, amount: 100_000 }))
            .toEqual({ message: "Tabungan Tabungan bulan ini sudah sesuai rencana.", isError: false });
        expect(budgetNoteForExpense({ ...savings, spentBefore: 1_000_000, amount: 100_000 })).toBeNull();
    });
});

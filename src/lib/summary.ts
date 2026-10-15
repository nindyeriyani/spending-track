import { BUDGET_WARNING_RATIO, budgetStatus, needsAttention, type BudgetStatus } from "./budget";
import { formatRupiah } from "./format";
import { goalSaved, isGoalReached } from "./goals";
import type { Budget, Category, Goal, Transaction } from "./types";

// Perhitungan untuk tampilan dashboard. Semua nama kategori di sini sudah nama terkini
// (lihat withCurrentCategoryNames), jadi pengelompokan per nama aman.

type IsSavings = (category: string) => boolean;

// Tabungan dicatat sebagai pengeluaran tapi dipisah supaya terlihat berapa yang benar-benar dibelanjakan
export function monthTotals(transactions: readonly Transaction[], isSavings: IsSavings) {
    let income = 0;
    let expense = 0;
    let savings = 0;
    for (const tx of transactions) {
        if (tx.type === "income") income += tx.amount;
        else if (isSavings(tx.category)) savings += tx.amount;
        else expense += tx.amount;
    }
    return { income, expense, savings, balance: income - expense - savings };
}

export interface BudgetRowData extends Budget {
    spent: number;
    isSavings: boolean;
    status: BudgetStatus;
}

// Limit berlaku tiap bulan, pemakaian dihitung dari transaksi bulan itu. Urut sesuai daftar kategori;
// budget yang kategorinya sudah dihapus ditaruh paling bawah.
export function buildBudgetRows(
    budgets: readonly Budget[], spent: ReadonlyMap<string, number>, expenseCategories: readonly Category[], isSavings: IsSavings,
): BudgetRowData[] {
    const order = (category: string) => {
        const i = expenseCategories.findIndex((c) => c.name === category);
        return i === -1 ? Infinity : i;
    };
    return budgets
        .map((b) => {
            const used = spent.get(b.category) ?? 0;
            const savings = isSavings(b.category);
            return { ...b, spent: used, isSavings: savings, status: budgetStatus(used, b.limit, savings) };
        })
        .sort((a, b) => order(a.category) - order(b.category));
}

// Sisa budget dan saran harian hanya dari budget pengeluaran; tabungan tidak dibelanjakan harian.
// `daysLeft` 0 untuk bulan selain bulan berjalan, karena saran harian hanya bermakna untuk bulan ini.
export function summarizeBudgets(rows: readonly BudgetRowData[], daysLeft: number) {
    const spending = rows.filter((b) => !b.isSavings);
    const savings = rows.filter((b) => b.isSavings);
    const sum = (list: readonly BudgetRowData[], pick: (b: BudgetRowData) => number) => list.reduce((total, b) => total + pick(b), 0);
    const totalLimit = sum(spending, (b) => b.limit);
    const totalSpent = sum(spending, (b) => b.spent);
    const remaining = totalLimit - totalSpent;
    return {
        totalLimit,
        totalSpent,
        remaining,
        daysLeft,
        dailyAllowance: daysLeft > 0 && remaining > 0 ? Math.floor(remaining / daysLeft) : 0,
        alertCount: spending.filter((b) => needsAttention(b.status)).length,
        savingsPlanned: sum(savings, (b) => b.limit),
        savingsDone: sum(savings, (b) => b.spent),
    };
}

// Kategori yang ada pengeluarannya tapi belum diberi budget, dari yang terbesar
export function unbudgetedSpending(budgets: readonly Budget[], spent: ReadonlyMap<string, number>): [string, number][] {
    const budgeted = new Set(budgets.map((b) => b.category));
    return [...spent.entries()]
        .filter(([category]) => !budgeted.has(category))
        .sort((a, b) => b[1] - a[1]);
}

export interface GoalRowData extends Goal {
    saved: number;
    progress: number; // 0-100
    reached: boolean;
}

export function buildGoalRows(goals: readonly Goal[], spentAllTime: ReadonlyMap<string, number>): GoalRowData[] {
    return goals.map((g) => {
        const saved = goalSaved(g, spentAllTime);
        const progress = g.targetAmount > 0 ? Math.min(Math.max((saved / g.targetAmount) * 100, 0), 100) : 0;
        return { ...g, saved, progress, reached: isGoalReached(saved, g.targetAmount) };
    });
}

// Pesan setelah mencatat pengeluaran kalau budget kategorinya hampir habis, terlampaui, atau (untuk tabungan)
// sudah sesuai rencana. `spentBefore` = pemakaian bulan itu sebelum transaksi ini; `when` mis. "bulan ini".
export function budgetNoteForExpense({ category, amount, limit, spentBefore, isSavings, when }: {
    category: string; amount: number; limit: number; spentBefore: number; isSavings: boolean; when: string;
}): { message: string; isError: boolean } | null {
    const after = spentBefore + amount;
    if (isSavings) {
        // Untuk tabungan, mencapai budget justru kabar baik
        return spentBefore < limit && after >= limit
            ? { message: `Tabungan ${category} ${when} sudah sesuai rencana.`, isError: false }
            : null;
    }
    if (after > limit) {
        return { message: `Budget ${category} ${when} terlampaui ${formatRupiah(after - limit)}.`, isError: true };
    }
    if (spentBefore < limit * BUDGET_WARNING_RATIO && after >= limit * BUDGET_WARNING_RATIO) {
        return {
            message: `Budget ${category} ${when} sudah terpakai ${Math.round((after / limit) * 100)}%. Sisa ${formatRupiah(limit - after)}.`,
            isError: false,
        };
    }
    return null;
}

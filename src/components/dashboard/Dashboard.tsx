"use client";

import { useCallback, useMemo, useState } from "react";
import { signOut, type User } from "firebase/auth";
import { addDoc, collection, deleteDoc, doc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import ManageCategories from "@/components/ManageCategories";
import AccountMenu from "@/components/AccountMenu";
import { useAlert } from "@/hooks/useAlert";
import { useToday } from "@/hooks/useToday";
import { useUserData } from "@/hooks/useUserData";
import { auth, db } from "@/lib/firebase";
import { monthKey, parseLocalDate } from "@/lib/date";
import { addDefaultCategories, categoriesFor, categoryIdFor, categoryIcon } from "@/lib/categories";
import { goalSaved, isGoalReached } from "@/lib/goals";
import { daysLeftInMonth, spentByCategory } from "@/lib/budget";
import { exportMonthToExcel } from "@/lib/exportExcel";
import { formatRupiah } from "@/lib/format";
import { budgetNoteForExpense, buildBudgetRows, buildGoalRows, monthTotals, summarizeBudgets, unbudgetedSpending } from "@/lib/summary";
import type { BudgetInput, Category, CategoryInput, GoalInput, TransactionInput } from "@/lib/types";
import AlertDialog from "./AlertDialog";
import BottomNav from "./BottomNav";
import BudgetTab from "./BudgetTab";
import EditBudgetModal from "./EditBudgetModal";
import EditGoalModal from "./EditGoalModal";
import EditTransactionModal from "./EditTransactionModal";
import GoalsTab from "./GoalsTab";
import Header from "./Header";
import OverviewTab from "./OverviewTab";
import type { EditableBudget, EditableGoal, EditableTransaction, Tab } from "./types";

const TAB_TITLES: Record<Tab, string> = { overview: "Ringkasan Keuangan", budget: "Budget Bulanan", goals: "Target" };

const monthLabel = (date: Date) => date.toLocaleDateString("id-ID", { month: "long", year: "numeric" });

// Dirender dengan `key={user.uid}`, jadi semua state di sini otomatis kosong lagi saat ganti akun
export default function Dashboard({ user }: { user: User }) {
    const uid = user.uid;
    const [activeTab, setActiveTab] = useState<Tab>("overview");
    const [managingCategories, setManagingCategories] = useState(false);
    const [accountOpen, setAccountOpen] = useState(false);
    const [editingGoal, setEditingGoal] = useState<EditableGoal | null>(null);
    const [editingBudget, setEditingBudget] = useState<EditableBudget | null>(null);
    const [editingTransaction, setEditingTransaction] = useState<EditableTransaction | null>(null);
    const [exporting, setExporting] = useState(false);
    const [isAdding, setIsAdding] = useState(false);
    const [expandedActivityId, setExpandedActivityId] = useState<string | null>(null);
    const [showAllActivity, setShowAllActivity] = useState(false);
    const { alert, showAlert, showConfirm, closeAlert } = useAlert();

    // `selectedMonth` null berarti ikut bulan berjalan; terisi kalau user sedang melihat bulan lain
    const today = useToday();
    const [selectedMonth, setSelectedMonth] = useState<Date | null>(null);
    const currentMonth = selectedMonth ?? today;
    const isCurrentMonth = selectedMonth === null;
    const viewedMonthKey = monthKey(currentMonth);
    const todayMonthKey = monthKey(today);
    const formattedMonth = monthLabel(currentMonth);

    const showMonth = (month: Date | null) => {
        setSelectedMonth(month && monthKey(month) !== todayMonthKey ? month : null);
        setExpandedActivityId(null);
        setShowAllActivity(false);
    };

    // Transaksi dimuat untuk bulan yang dilihat dan bulan berjalan (untuk peringatan budget saat mencatat hari ini)
    const months = useMemo(() => [...new Set([viewedMonthKey, todayMonthKey])], [viewedMonthKey, todayMonthKey]);
    const { categories, transactions, goals, budgets, spentAllTime, isMonthLoaded, goalsLoading, budgetsLoading } =
        useUserData(uid, { months, extraGoalCategory: editingGoal?.category || undefined, onError: showAlert });

    // Firestore langsung menerapkan tulisan di cache lokal (dan mengantrekannya saat offline),
    // tapi promise-nya baru selesai setelah server mengonfirmasi. Promise itu sengaja tidak ditunggu
    // supaya UI tidak menggantung saat offline; kegagalan (mis. ditolak rules) dilaporkan belakangan.
    const commit = useCallback((write: Promise<unknown>, failMessage: string) => {
        write.catch((err) => {
            console.error(failMessage, err);
            showAlert(failMessage, "error");
        });
    }, [showAlert]);

    const userDoc = (path: string, id: string) => doc(db, "users", uid, path, id);
    const userCollection = (path: string) => collection(db, "users", uid, path);

    const expenseCategories = useMemo(() => categoriesFor(categories, "expense"), [categories]);
    const savingsCategories = useMemo(
        () => new Set(expenseCategories.filter((c) => c.savings).map((c) => c.name)),
        [expenseCategories],
    );
    const isSavingsCategory = useCallback((name: string) => savingsCategories.has(name), [savingsCategories]);
    const iconFor = (name: string) => categoryIcon(categories, name);

    const monthTransactions = useMemo(
        () => transactions.filter((tx) => typeof tx.date === "string" && tx.date.startsWith(viewedMonthKey)),
        [transactions, viewedMonthKey],
    );
    const totals = useMemo(() => monthTotals(monthTransactions, isSavingsCategory), [monthTransactions, isSavingsCategory]);
    const spentThisMonth = useMemo(() => spentByCategory(monthTransactions), [monthTransactions]);
    const budgetRows = useMemo(
        () => buildBudgetRows(budgets, spentThisMonth, expenseCategories, isSavingsCategory),
        [budgets, spentThisMonth, expenseCategories, isSavingsCategory],
    );
    const budgetSummary = useMemo(
        () => summarizeBudgets(budgetRows, isCurrentMonth ? daysLeftInMonth(today) : 0),
        [budgetRows, isCurrentMonth, today],
    );
    const unbudgeted = useMemo(() => unbudgetedSpending(budgets, spentThisMonth), [budgets, spentThisMonth]);
    const goalRows = useMemo(() => buildGoalRows(goals, spentAllTime), [goals, spentAllTime]);

    // Satu kategori hanya boleh terhubung ke satu target supaya uangnya tidak terhitung dua kali
    const goalCategoriesFor = (exceptGoalId?: string) =>
        expenseCategories.filter((c) => !goals.some((g) => g.id !== exceptGoalId && g.category === c.name));
    const availableBudgetCategories = useMemo(
        () => expenseCategories.filter((c) => !budgets.some((b) => b.category === c.name)),
        [expenseCategories, budgets],
    );

    const handleLogout = () => {
        setAccountOpen(false);
        showConfirm("Yakin ingin keluar dari akun?", async () => {
            closeAlert();
            try {
                await signOut(auth);
            } catch (e) {
                console.error("Sign out failed:", e);
                showAlert("Gagal keluar.", "error");
            }
        }, "Keluar");
    };

    const handleExportExcel = async () => {
        if (exporting) return;
        setExporting(true);
        try {
            await exportMonthToExcel({ monthLabel: formattedMonth, transactions: monthTransactions, budgets: budgetRows, savingsCategories });
        } catch (err) {
            console.error("Failed to export Excel:", err);
            showAlert("Gagal membuat file Excel.", "error");
        } finally {
            setExporting(false);
        }
    };

    const handleAddExpense = (expense: TransactionInput) => {
        const categoryId = categoryIdFor(categories, expense.category, expense.type);
        commit(addDoc(userCollection("transactions"), { ...expense, ...(categoryId && { categoryId }), createdAt: serverTimestamp() }), "Gagal menyimpan transaksi.");

        const notes: string[] = [];
        let isError = false;
        const expenseMonth = expense.date.slice(0, 7);
        const expenseMonthLabel = monthLabel(parseLocalDate(expense.date));
        // Daftar hanya menampilkan bulan yang sedang dilihat, jadi beri tahu kalau transaksinya tidak akan terlihat
        if (expenseMonth !== viewedMonthKey) {
            notes.push(`Transaksi tersimpan di ${expenseMonthLabel}, jadi tidak tampil di daftar ${formattedMonth}.`);
        }
        // Peringatkan kalau pengeluaran ini membuat budget kategorinya hampir habis atau terlampaui.
        // Hanya bulan yang sedang dimuat yang bisa dihitung (bulan yang dilihat dan bulan berjalan).
        const budget = budgets.find((b) => b.category === expense.category);
        if (expense.type === "expense" && budget && months.includes(expenseMonth)) {
            const note = budgetNoteForExpense({
                category: expense.category,
                amount: expense.amount,
                limit: budget.limit,
                spentBefore: transactions
                    .filter((tx) => tx.type === "expense" && tx.category === expense.category && tx.date.startsWith(expenseMonth))
                    .reduce((sum, tx) => sum + tx.amount, 0),
                isSavings: isSavingsCategory(expense.category),
                when: expenseMonth === todayMonthKey ? "bulan ini" : `di ${expenseMonthLabel}`,
            });
            if (note) {
                notes.push(note.message);
                isError = note.isError;
            }
        }
        // Rayakan kalau transaksi ini membuat target yang terhubung tercapai
        const linkedGoal = expense.type === "expense" ? goals.find((g) => g.category === expense.category) : undefined;
        if (linkedGoal) {
            const before = goalSaved(linkedGoal, spentAllTime);
            if (!isGoalReached(before, linkedGoal.targetAmount) && isGoalReached(before + expense.amount, linkedGoal.targetAmount)) {
                notes.unshift(`Selamat! Target "${linkedGoal.name}" tercapai (${formatRupiah(linkedGoal.targetAmount)}).`);
            }
        }
        if (!navigator.onLine) notes.push("Sedang offline: tersimpan di perangkat dan akan disinkronkan saat online.");
        if (notes.length > 0) showAlert(notes.join(" "), isError ? "error" : "success");
    };

    const handleAddBudget = (budget: BudgetInput) => {
        // ID dokumen = ID kategori, jadi satu kategori tidak bisa punya dua budget
        const category = expenseCategories.find((c) => c.name === budget.category);
        if (!category) throw new Error("Kategori tidak ditemukan.");
        commit(setDoc(userDoc("budgets", category.id), { ...budget, categoryId: category.id }), "Gagal menyimpan budget.");
    };

    const handleAddCategory = (category: CategoryInput) => {
        commit(addDoc(userCollection("categories"), { ...category, createdAt: serverTimestamp() }), "Gagal menyimpan kategori.");
    };

    // Data lain merujuk kategori lewat `categoryId`, jadi cukup dokumen kategorinya yang diubah
    const handleUpdateCategory = (category: Category, changes: Pick<CategoryInput, "name" | "icon" | "savings">) => {
        commit(updateDoc(userDoc("categories", category.id), changes), "Gagal memperbarui kategori.");
        showAlert(`Kategori "${changes.name}" berhasil diperbarui.`);
    };

    const handleDeleteCategory = (category: Category) => {
        showConfirm(`Hapus kategori "${category.name}"? Transaksi, budget, dan target yang memakainya tetap tersimpan.`, () => {
            commit(deleteDoc(userDoc("categories", category.id)), "Gagal menghapus kategori.");
            closeAlert();
        });
    };

    const handleSaveBudget = (e: React.SubmitEvent) => {
        e.preventDefault();
        if (!editingBudget) return;
        const limit = Number(editingBudget.limit);
        if (!Number.isFinite(limit) || limit <= 0) {
            showAlert("Batas budget harus lebih dari 0.", "error");
            return;
        }
        commit(updateDoc(userDoc("budgets", editingBudget.id), { limit }), "Gagal memperbarui budget.");
        setEditingBudget(null);
        showAlert("Budget berhasil diperbarui.");
    };

    const handleAddGoal = (goal: GoalInput) => {
        const categoryId = categoryIdFor(categories, goal.category, "expense");
        commit(addDoc(userCollection("goals"), { ...goal, ...(categoryId && { categoryId }) }), "Gagal menyimpan target.");
    };

    const handleSaveTransaction = (e: React.SubmitEvent) => {
        e.preventDefault();
        if (!editingTransaction) return;
        const amount = Number(editingTransaction.amount);
        if (!Number.isFinite(amount) || amount <= 0) {
            showAlert("Jumlah harus lebih dari 0.", "error");
            return;
        }
        if (!editingTransaction.category) {
            showAlert("Pilih kategori.", "error");
            return;
        }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(editingTransaction.date)) {
            showAlert("Tanggal tidak valid.", "error");
            return;
        }
        // Kategori yang sudah dihapus tidak punya ID baru; `categoryId` lama dibiarkan
        const categoryId = categoryIdFor(categories, editingTransaction.category, editingTransaction.type);
        commit(updateDoc(userDoc("transactions", editingTransaction.id), {
            type: editingTransaction.type,
            category: editingTransaction.category,
            ...(categoryId && { categoryId }),
            date: editingTransaction.date,
            note: editingTransaction.note,
            amount,
        }), "Gagal memperbarui transaksi.");
        setEditingTransaction(null);
        setExpandedActivityId(null);
        // Transaksi yang dipindah ke bulan lain akan hilang dari daftar, jadi beri tahu ke mana pindahnya
        if (!editingTransaction.date.startsWith(viewedMonthKey)) {
            showAlert(`Transaksi berhasil diperbarui dan dipindah ke ${monthLabel(parseLocalDate(editingTransaction.date))}.`);
        } else {
            showAlert("Transaksi berhasil diperbarui.");
        }
    };

    const handleSaveGoal = (e: React.SubmitEvent) => {
        e.preventDefault();
        if (!editingGoal) return;
        const name = editingGoal.name.trim();
        // Field "terkumpul" yang dikosongkan dianggap 0, sama seperti di form tambah target
        const currentAmount = editingGoal.currentAmount.trim() === "" ? 0 : Number(editingGoal.currentAmount);
        const targetAmount = Number(editingGoal.targetAmount);
        if (!name) {
            showAlert("Nama target tidak boleh kosong.", "error");
            return;
        }
        if (!Number.isFinite(targetAmount) || targetAmount <= 0) {
            showAlert("Target harus lebih dari 0.", "error");
            return;
        }
        if (!Number.isFinite(currentAmount) || currentAmount < 0) {
            showAlert("Jumlah terkumpul tidak boleh negatif.", "error");
            return;
        }
        // setDoc (bukan updateDoc) supaya `category` ikut terhapus saat hubungan kategori dilepas
        const updated: GoalInput = {
            name,
            currentAmount,
            targetAmount,
            ...(editingGoal.category ? { category: editingGoal.category } : {}),
        };
        const categoryId = categoryIdFor(categories, editingGoal.category, "expense");
        if (categoryId) updated.categoryId = categoryId;
        commit(setDoc(userDoc("goals", editingGoal.id), updated), "Gagal memperbarui target.");
        const previous = goalRows.find((g) => g.id === editingGoal.id);
        const savedNow = goalSaved(updated, spentAllTime);
        setEditingGoal(null);
        if (previous && !previous.reached && isGoalReached(savedNow, targetAmount)) {
            showAlert(`Selamat! Target "${name}" tercapai (${formatRupiah(targetAmount)}).`);
        } else {
            showAlert("Target berhasil diperbarui.");
        }
    };

    const editingAnything = isAdding || managingCategories || !!editingGoal || !!editingTransaction || !!editingBudget;

    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col items-center">
            <main className="w-full max-w-md min-h-screen flex flex-col p-6 pb-32 gap-8 animate-[fade-in_0.4s_ease-out]">
                <Header
                    title={TAB_TITLES[activeTab]}
                    monthLabel={formattedMonth}
                    isCurrentMonth={isCurrentMonth}
                    onShiftMonth={(delta) => showMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + delta, 1))}
                    onCurrentMonth={() => showMonth(null)}
                    onManageCategories={() => setManagingCategories(true)}
                    onOpenAccount={() => setAccountOpen(true)}
                    user={user}
                />

                {activeTab === "overview" && (
                    <OverviewTab
                        totals={totals}
                        budgetAlertCount={budgetSummary.alertCount}
                        onShowBudget={() => setActiveTab("budget")}
                        categories={categories}
                        goalCategories={goalCategoriesFor()}
                        onAddExpense={handleAddExpense}
                        onAddGoal={handleAddGoal}
                        onManageCategories={() => setManagingCategories(true)}
                        onAddingChange={setIsAdding}
                        transactions={monthTransactions}
                        loading={!isMonthLoaded(viewedMonthKey)}
                        iconFor={iconFor}
                        expandedId={expandedActivityId}
                        onExpandedChange={setExpandedActivityId}
                        showAll={showAllActivity}
                        onShowAllChange={setShowAllActivity}
                        onEdit={(tx) => setEditingTransaction({ ...tx, note: tx.note ?? "", amount: String(tx.amount) })}
                        onDelete={(tx) => showConfirm("Hapus transaksi ini?", () => {
                            commit(deleteDoc(userDoc("transactions", tx.id)), "Gagal menghapus transaksi.");
                            setExpandedActivityId(null);
                            showAlert("Transaksi berhasil dihapus.");
                        })}
                        exporting={exporting}
                        onExport={handleExportExcel}
                    />
                )}

                {activeTab === "budget" && (
                    <BudgetTab
                        summary={budgetSummary}
                        isCurrentMonth={isCurrentMonth}
                        rows={budgetRows}
                        unbudgeted={unbudgeted}
                        loading={budgetsLoading}
                        iconFor={iconFor}
                        availableCategories={availableBudgetCategories}
                        onAddBudget={handleAddBudget}
                        onManageCategories={() => setManagingCategories(true)}
                        onAddingChange={setIsAdding}
                        onEdit={(b) => setEditingBudget({ id: b.id, category: b.category, limit: String(b.limit) })}
                        onDelete={(b) => showConfirm(`Hapus budget "${b.category}"?`, () => {
                            commit(deleteDoc(userDoc("budgets", b.id)), "Gagal menghapus budget.");
                            showAlert("Budget berhasil dihapus.");
                        })}
                    />
                )}

                {activeTab === "goals" && (
                    <GoalsTab
                        goals={goalRows}
                        loading={goalsLoading}
                        iconFor={iconFor}
                        linkableCategories={goalCategoriesFor()}
                        onAddGoal={handleAddGoal}
                        onAddingChange={setIsAdding}
                        onEdit={(goal) => setEditingGoal({ id: goal.id, name: goal.name, targetAmount: String(goal.targetAmount), currentAmount: String(goal.currentAmount), category: goal.category ?? "" })}
                        onDelete={(goal) => showConfirm(`Hapus target "${goal.name}"?`, () => {
                            commit(deleteDoc(userDoc("goals", goal.id)), "Gagal menghapus target.");
                            showAlert("Target berhasil dihapus.");
                        })}
                    />
                )}

                {!editingAnything && (
                    <BottomNav activeTab={activeTab} onChange={setActiveTab} budgetAlert={budgetSummary.alertCount > 0} />
                )}

                {managingCategories && (
                    <ManageCategories
                        categories={categories}
                        onAdd={handleAddCategory}
                        onUpdate={handleUpdateCategory}
                        onAddDefaults={() => commit(addDefaultCategories(uid), "Gagal menambahkan kategori bawaan.")}
                        onDelete={handleDeleteCategory}
                        onClose={() => setManagingCategories(false)}
                    />
                )}

                {accountOpen && (
                    <AccountMenu user={user} onLogout={handleLogout} onClose={() => setAccountOpen(false)} />
                )}

                {alert && <AlertDialog alert={alert} onClose={closeAlert} />}

                {editingTransaction && (
                    <EditTransactionModal
                        value={editingTransaction}
                        onChange={setEditingTransaction}
                        categories={categories}
                        onSubmit={handleSaveTransaction}
                        onClose={() => setEditingTransaction(null)}
                    />
                )}

                {editingGoal && (
                    <EditGoalModal
                        value={editingGoal}
                        onChange={setEditingGoal}
                        linkableCategories={goalCategoriesFor(editingGoal.id)}
                        expenseCategories={expenseCategories}
                        spentAllTime={spentAllTime}
                        onSubmit={handleSaveGoal}
                        onClose={() => setEditingGoal(null)}
                    />
                )}

                {editingBudget && (
                    <EditBudgetModal
                        value={editingBudget}
                        onChange={setEditingBudget}
                        icon={iconFor(editingBudget.category)}
                        onSubmit={handleSaveBudget}
                        onClose={() => setEditingBudget(null)}
                    />
                )}
            </main>
        </div>
    );
}

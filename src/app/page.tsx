
"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import AddExpenseForm from "@/components/AddExpenseForm";
import AddGoalForm from "@/components/AddGoalForm";
import AddBudgetForm from "@/components/AddBudgetForm";
import ManageCategories from "@/components/ManageCategories";
import AmountInput from "@/components/AmountInput";
import Auth from "@/components/Auth";
import { auth, db } from "@/lib/firebase";
import { monthKey, parseLocalDate } from "@/lib/date";
import { categoriesFor, categoryIcon as iconFor } from "@/lib/categories";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowRight, faBuildingColumns, faBullseye, faCheck, faCircleQuestion, faTriangleExclamation, faXmark } from "@fortawesome/free-solid-svg-icons";
import { goalSaved, isGoalReached } from "@/lib/goals";
import { BUDGET_WARNING_RATIO, budgetStatus, daysLeftInMonth, needsAttention, spentByCategory, type BudgetStatus } from "@/lib/budget";
import { exportMonthToExcel } from "@/lib/exportExcel";
import { formatNumber, formatRupiah } from "@/lib/format";
import type { Budget, BudgetInput, Category, CategoryInput, Goal, GoalInput, Transaction, TransactionInput } from "@/lib/types";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import {
  collection,
  query,
  onSnapshot,
  addDoc,
  updateDoc,
  serverTimestamp,
  deleteDoc,
  setDoc,
  doc,
  orderBy
} from "firebase/firestore";

type Tab = "overview" | "budget" | "goals";

// Jumlah transaksi yang tampil di Home sebelum tombol "Lihat semua"
const ACTIVITY_PREVIEW_COUNT = 10;

const TAB_TITLES: Record<Tab, string> = { overview: "Ringkasan Keuangan", budget: "Budget Bulanan", goals: "Target" };

const STATUS_STYLES: Record<BudgetStatus, { bar: string; badge: string; label: string }> = {
  safe: { bar: "bg-success", badge: "bg-success/10 text-success", label: "Aman" },
  warning: { bar: "bg-warning", badge: "bg-warning/15 text-warning", label: "Hampir habis" },
  over: { bar: "bg-destructive", badge: "bg-destructive/10 text-destructive", label: "Terlampaui" },
  saving: { bar: "bg-primary", badge: "bg-primary/10 text-primary", label: "Menabung" },
  saved: { bar: "bg-success", badge: "bg-success/10 text-success", label: "Tercapai" },
};

// Angka di form edit disimpan sebagai string supaya field bisa dikosongkan saat mengetik
type EditableTransaction = Omit<Transaction, "amount"> & { amount: string };
// `category` "" berarti target tidak dihubungkan ke kategori
type EditableGoal = Omit<Goal, "targetAmount" | "currentAmount" | "category"> & { targetAmount: string; currentAmount: string; category: string };
type EditableBudget = Omit<Budget, "limit"> & { limit: string };

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(true);
  const [goalsLoading, setGoalsLoading] = useState(true);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [budgetsLoading, setBudgetsLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [managingCategories, setManagingCategories] = useState(false);
  // URL foto profil yang gagal dimuat; avatar lalu memakai huruf pertama email
  const [brokenPhotoURL, setBrokenPhotoURL] = useState<string | null>(null);

  const [editingGoal, setEditingGoal] = useState<EditableGoal | null>(null);
  const [editingBudget, setEditingBudget] = useState<EditableBudget | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<EditableTransaction | null>(null);
  const [exporting, setExporting] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [expandedActivityId, setExpandedActivityId] = useState<string | null>(null);
  const [showAllActivity, setShowAllActivity] = useState(false);

  // `today` diperbarui saat app dibuka lagi, supaya app yang dibiarkan terbuka lewat tengah malam tetap benar.
  // `selectedMonth` null berarti ikut bulan berjalan; terisi kalau user sedang melihat bulan lain.
  const [today, setToday] = useState(() => new Date());
  const [selectedMonth, setSelectedMonth] = useState<Date | null>(null);
  const currentMonth = selectedMonth ?? today;
  const isCurrentMonth = selectedMonth === null;

  useEffect(() => {
    const refreshToday = () =>
      setToday((prev) => (prev.toDateString() === new Date().toDateString() ? prev : new Date()));
    document.addEventListener("visibilitychange", refreshToday);
    window.addEventListener("focus", refreshToday);
    return () => {
      document.removeEventListener("visibilitychange", refreshToday);
      window.removeEventListener("focus", refreshToday);
    };
  }, []);

  const showMonth = (month: Date | null) => {
    setSelectedMonth(month && monthKey(month) !== monthKey(today) ? month : null);
    setExpandedActivityId(null);
    setShowAllActivity(false);
  };

  const shiftMonth = (delta: number) =>
    showMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + delta, 1));

  // Custom Alert State
  const [alert, setAlert] = useState<{ message: string, type: "success" | "error" | "confirm", confirmText?: string, onConfirm?: () => void } | null>(null);

  const alertTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearAlertTimer = () => {
    if (alertTimer.current) clearTimeout(alertTimer.current);
    alertTimer.current = null;
  };

  // Timer lama selalu dibatalkan supaya tidak menutup alert/konfirmasi yang muncul sesudahnya
  const showAlert = useCallback((message: string, type: "success" | "error" = "success") => {
    clearAlertTimer();
    setAlert({ message, type });
    alertTimer.current = setTimeout(() => setAlert(null), 3000);
  }, []);

  const showConfirm = (message: string, onConfirm: () => void, confirmText?: string) => {
    clearAlertTimer();
    setAlert({ message, type: "confirm", confirmText, onConfirm });
  };

  const closeAlert = () => {
    clearAlertTimer();
    setAlert(null);
  };

  useEffect(() => clearAlertTimer, []);

  // Firestore langsung menerapkan tulisan di cache lokal (dan mengantrekannya saat offline),
  // tapi promise-nya baru selesai setelah server mengonfirmasi. Promise itu sengaja tidak ditunggu
  // supaya UI tidak menggantung saat offline; kegagalan (mis. ditolak rules) dilaporkan belakangan.
  const commit = useCallback((write: Promise<unknown>, failMessage: string) => {
    write.catch((err) => {
      console.error(failMessage, err);
      showAlert(failMessage, "error");
    });
  }, [showAlert]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      // Bersihkan data akun sebelumnya agar tidak terlihat oleh akun berikutnya
      setRecentTransactions([]);
      setGoals([]);
      setBudgets([]);
      setCategories([]);
      setManagingCategories(false);
      setDataLoading(true);
      setGoalsLoading(true);
      setBudgetsLoading(true);
      setEditingGoal(null);
      setEditingBudget(null);
      setEditingTransaction(null);
      setExpandedActivityId(null);
      setShowAllActivity(false);
      setSelectedMonth(null);
      setActiveTab("overview");
      setUser(user);
      setAuthLoading(false);
      setMounted(true);
    });
    return () => unsubscribe();
  }, []);

  // Sync Transactions
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "users", user.uid, "transactions"),
      orderBy("date", "desc")
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      // Urutkan dari yang paling terakhir diinput; transaksi lama tanpa `createdAt` ditaruh di bawah, urut tanggal
      const txs = snapshot.docs
        .map(doc => ({ id: doc.id, ...(doc.data({ serverTimestamps: "estimate" }) as TransactionInput) }))
        .sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0) || b.date.localeCompare(a.date));
      setRecentTransactions(txs);
      setDataLoading(false);
    }, (err) => {
      console.error("Failed to load transactions:", err);
      setDataLoading(false);
      showAlert("Gagal memuat transaksi.", "error");
    });
    return () => unsubscribe();
  }, [user, showAlert]);

  // Sync Goals
  useEffect(() => {
    if (!user) return;
    const q = collection(db, "users", user.uid, "goals");
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const gs = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as GoalInput) }));
      setGoals(gs);
      setGoalsLoading(false);
    }, (err) => {
      console.error("Failed to load goals:", err);
      setGoalsLoading(false);
      showAlert("Gagal memuat target.", "error");
    });
    return () => unsubscribe();
  }, [user, showAlert]);

  // Sync Budgets
  useEffect(() => {
    if (!user) return;
    const q = collection(db, "users", user.uid, "budgets");
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setBudgets(snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as BudgetInput) })));
      setBudgetsLoading(false);
    }, (err) => {
      console.error("Failed to load budgets:", err);
      setBudgetsLoading(false);
      showAlert("Gagal memuat budget.", "error");
    });
    return () => unsubscribe();
  }, [user, showAlert]);

  // Sync Categories (urut sesuai waktu dibuat)
  useEffect(() => {
    if (!user) return;
    const q = collection(db, "users", user.uid, "categories");
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setCategories(snapshot.docs
        .map(doc => ({ id: doc.id, ...(doc.data({ serverTimestamps: "estimate" }) as CategoryInput) }))
        .sort((a, b) => (a.createdAt?.toMillis() ?? 0) - (b.createdAt?.toMillis() ?? 0)));
    }, (err) => {
      console.error("Failed to load categories:", err);
      showAlert("Gagal memuat kategori.", "error");
    });
    return () => unsubscribe();
  }, [user, showAlert]);

  const expenseCategories = useMemo(() => categoriesFor(categories, "expense"), [categories]);
  const savingsCategories = useMemo(
    () => new Set(expenseCategories.filter((c) => c.savings).map((c) => c.name)),
    [expenseCategories]
  );
  const isSavingsCategory = useCallback((name: string) => savingsCategories.has(name), [savingsCategories]);
  const categoryIcon = (name: string) => <FontAwesomeIcon icon={iconFor(categories, name)} />;

  // Totals Calculation
  const filteredTransactions = useMemo(() => {
    const key = monthKey(currentMonth);
    return recentTransactions.filter((tx) => typeof tx.date === "string" && tx.date.startsWith(key));
  }, [recentTransactions, currentMonth]);

  // Tabungan dicatat sebagai pengeluaran tapi dipisah supaya terlihat berapa yang benar-benar dibelanjakan
  const { totalIncome, totalExpense, totalSavings, balance } = useMemo(() => {
    let income = 0;
    let expense = 0;
    let savings = 0;
    filteredTransactions.forEach((tx) => {
      if (tx.type === "income") income += tx.amount;
      else if (isSavingsCategory(tx.category)) savings += tx.amount;
      else expense += tx.amount;
    });
    return { totalIncome: income, totalExpense: expense, totalSavings: savings, balance: income - expense - savings };
  }, [filteredTransactions, isSavingsCategory]);

  // Budget bulan berjalan: limit berlaku tiap bulan, pemakaian dihitung dari transaksi bulan ini
  const spentThisMonth = useMemo(() => spentByCategory(filteredTransactions), [filteredTransactions]);

  const budgetRows = useMemo(() => {
    // Urut sesuai daftar kategori; budget yang kategorinya sudah dihapus ditaruh paling bawah
    const order = (category: string) => {
      const i = expenseCategories.findIndex((c) => c.name === category);
      return i === -1 ? Infinity : i;
    };
    return budgets
      .map((b) => {
        const spent = spentThisMonth.get(b.category) ?? 0;
        const isSavings = isSavingsCategory(b.category);
        return { ...b, spent, isSavings, status: budgetStatus(spent, b.limit, isSavings) };
      })
      .sort((a, b) => order(a.category) - order(b.category));
  }, [budgets, spentThisMonth, expenseCategories, isSavingsCategory]);

  const spendingBudgetRows = useMemo(() => budgetRows.filter((b) => !b.isSavings), [budgetRows]);
  const savingsBudgetRows = useMemo(() => budgetRows.filter((b) => b.isSavings), [budgetRows]);

  // Sisa budget dan saran harian hanya dari budget pengeluaran; tabungan tidak dibelanjakan harian
  const budgetSummary = useMemo(() => {
    const totalLimit = spendingBudgetRows.reduce((sum, b) => sum + b.limit, 0);
    const totalSpent = spendingBudgetRows.reduce((sum, b) => sum + b.spent, 0);
    const remaining = totalLimit - totalSpent;
    // Saran harian hanya bermakna untuk bulan berjalan
    const daysLeft = isCurrentMonth ? daysLeftInMonth(today) : 0;
    return {
      totalLimit,
      totalSpent,
      remaining,
      daysLeft,
      dailyAllowance: daysLeft > 0 && remaining > 0 ? Math.floor(remaining / daysLeft) : 0,
      alertCount: spendingBudgetRows.filter((b) => needsAttention(b.status)).length,
      savingsPlanned: savingsBudgetRows.reduce((sum, b) => sum + b.limit, 0),
      savingsDone: savingsBudgetRows.reduce((sum, b) => sum + b.spent, 0),
    };
  }, [spendingBudgetRows, savingsBudgetRows, isCurrentMonth, today]);

  // Kategori yang ada pengeluarannya bulan ini tapi belum diberi budget
  const unbudgetedSpending = useMemo(() => {
    const budgeted = new Set(budgets.map((b) => b.category));
    return [...spentThisMonth.entries()]
      .filter(([category]) => !budgeted.has(category))
      .sort((a, b) => b[1] - a[1]);
  }, [budgets, spentThisMonth]);

  // Progres target yang terhubung ke kategori dihitung dari semua transaksi, bukan hanya bulan yang dilihat
  const spentAllTime = useMemo(() => spentByCategory(recentTransactions), [recentTransactions]);

  const goalRows = useMemo(
    () => goals.map((g) => {
      const saved = goalSaved(g, spentAllTime);
      const progress = g.targetAmount > 0 ? Math.min(Math.max((saved / g.targetAmount) * 100, 0), 100) : 0;
      return { ...g, saved, progress, reached: isGoalReached(saved, g.targetAmount) };
    }),
    [goals, spentAllTime]
  );

  // Satu kategori hanya boleh terhubung ke satu target supaya uangnya tidak terhitung dua kali
  const goalCategoriesFor = (exceptGoalId?: string) =>
    expenseCategories.filter((c) => !goals.some((g) => g.id !== exceptGoalId && g.category === c.name));

  const availableBudgetCategories = useMemo(
    () => expenseCategories.filter((c) => !budgets.some((b) => b.category === c.name)),
    [expenseCategories, budgets]
  );

  const handleLogout = async () => {
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

  const formattedMonth = currentMonth.toLocaleDateString("id-ID", { month: "long", year: "numeric" });

  const handleExportExcel = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      await exportMonthToExcel({ monthLabel: formattedMonth, transactions: filteredTransactions, budgets: budgetRows, savingsCategories });
    } catch (err) {
      console.error("Failed to export Excel:", err);
      showAlert("Gagal membuat file Excel.", "error");
    } finally {
      setExporting(false);
    }
  };

  const handleAddExpense = (expense: TransactionInput) => {
    if (!user) return;
    commit(addDoc(collection(db, "users", user.uid, "transactions"), { ...expense, createdAt: serverTimestamp() }), "Gagal menyimpan transaksi.");

    const notes: string[] = [];
    let isError = false;
    const expenseMonth = expense.date.slice(0, 7);
    const expenseMonthLabel = parseLocalDate(expense.date).toLocaleDateString("id-ID", { month: "long", year: "numeric" });
    // Daftar hanya menampilkan bulan yang sedang dilihat, jadi beri tahu kalau transaksinya tidak akan terlihat
    if (expenseMonth !== monthKey(currentMonth)) {
      notes.push(`Transaksi tersimpan di ${expenseMonthLabel}, jadi tidak tampil di daftar ${formattedMonth}.`);
    }
    // Peringatkan kalau pengeluaran ini membuat budget kategorinya hampir habis atau terlampaui
    const budget = budgets.find((b) => b.category === expense.category);
    if (expense.type === "expense" && budget) {
      const before = recentTransactions
        .filter((tx) => tx.type === "expense" && tx.category === expense.category && tx.date.startsWith(expenseMonth))
        .reduce((sum, tx) => sum + tx.amount, 0);
      const after = before + expense.amount;
      const when = expenseMonth === monthKey(today) ? "bulan ini" : `di ${expenseMonthLabel}`;
      if (isSavingsCategory(expense.category)) {
        // Untuk tabungan, mencapai budget justru kabar baik
        if (before < budget.limit && after >= budget.limit) {
          notes.push(`Tabungan ${expense.category} ${when} sudah sesuai rencana.`);
        }
      } else if (after > budget.limit) {
        notes.push(`Budget ${expense.category} ${when} terlampaui ${formatRupiah(after - budget.limit)}.`);
        isError = true;
      } else if (before < budget.limit * BUDGET_WARNING_RATIO && after >= budget.limit * BUDGET_WARNING_RATIO) {
        notes.push(`Budget ${expense.category} ${when} sudah terpakai ${Math.round((after / budget.limit) * 100)}%. Sisa ${formatRupiah(budget.limit - after)}.`);
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
    if (!user) return;
    // ID dokumen = ID kategori, jadi satu kategori tidak bisa punya dua budget
    const category = expenseCategories.find((c) => c.name === budget.category);
    if (!category) throw new Error("Kategori tidak ditemukan.");
    commit(setDoc(doc(db, "users", user.uid, "budgets", category.id), budget), "Gagal menyimpan budget.");
  };

  const handleAddCategory = (category: CategoryInput) => {
    if (!user) return;
    commit(addDoc(collection(db, "users", user.uid, "categories"), { ...category, createdAt: serverTimestamp() }), "Gagal menyimpan kategori.");
  };

  const handleDeleteCategory = (category: Category) => {
    if (!user) return;
    showConfirm(`Hapus kategori "${category.name}"? Transaksi, budget, dan target yang memakainya tetap tersimpan.`, () => {
      commit(deleteDoc(doc(db, "users", user.uid, "categories", category.id)), "Gagal menghapus kategori.");
      closeAlert();
    });
  };

  const handleSaveBudget = (e: React.SubmitEvent) => {
    e.preventDefault();
    if (!user || !editingBudget) return;
    const limit = Number(editingBudget.limit);
    if (!Number.isFinite(limit) || limit <= 0) {
      showAlert("Batas budget harus lebih dari 0.", "error");
      return;
    }
    commit(updateDoc(doc(db, "users", user.uid, "budgets", editingBudget.id), { limit }), "Gagal memperbarui budget.");
    setEditingBudget(null);
    showAlert("Budget berhasil diperbarui.");
  };

  const handleAddGoal = (goal: GoalInput) => {
    if (!user) return;
    commit(addDoc(collection(db, "users", user.uid, "goals"), goal), "Gagal menyimpan target.");
  };

  const handleSaveTransaction = (e: React.SubmitEvent) => {
    e.preventDefault();
    if (!user || !editingTransaction) return;
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
    commit(updateDoc(doc(db, "users", user.uid, "transactions", editingTransaction.id), {
      type: editingTransaction.type,
      category: editingTransaction.category,
      date: editingTransaction.date,
      note: editingTransaction.note,
      amount
    }), "Gagal memperbarui transaksi.");
    setEditingTransaction(null);
    setExpandedActivityId(null);
    // Transaksi yang dipindah ke bulan lain akan hilang dari daftar, jadi beri tahu ke mana pindahnya
    if (!editingTransaction.date.startsWith(monthKey(currentMonth))) {
      const month = parseLocalDate(editingTransaction.date).toLocaleDateString("id-ID", { month: "long", year: "numeric" });
      showAlert(`Transaksi berhasil diperbarui dan dipindah ke ${month}.`);
    } else {
      showAlert("Transaksi berhasil diperbarui.");
    }
  };

  const handleSaveGoal = (e: React.SubmitEvent) => {
    e.preventDefault();
    if (!user || !editingGoal) return;
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
    commit(setDoc(doc(db, "users", user.uid, "goals", editingGoal.id), updated), "Gagal memperbarui target.");
    const previous = goalRows.find((g) => g.id === editingGoal.id);
    const savedNow = goalSaved(updated, spentAllTime);
    setEditingGoal(null);
    if (previous && !previous.reached && isGoalReached(savedNow, targetAmount)) {
      showAlert(`Selamat! Target "${name}" tercapai (${formatRupiah(targetAmount)}).`);
    } else {
      showAlert("Target berhasil diperbarui.");
    }
  };

  if (!mounted || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f0f4f8]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground font-medium animate-pulse">Memuat...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Auth />;

  const renderBudgetCard = (b: (typeof budgetRows)[number]) => {
    const style = STATUS_STYLES[b.status];
    const usage = (b.spent / b.limit) * 100;
    const remaining = b.limit - b.spent;
    return (
      <div
        key={b.id}
        onClick={() => setEditingBudget({ id: b.id, category: b.category, limit: String(b.limit) })}
        className="premium-card p-6 flex flex-col gap-4 group relative cursor-pointer hover:border-primary/30 transition-all active:scale-[0.98]"
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            showConfirm(`Hapus budget "${b.category}"?`, () => {
              commit(deleteDoc(doc(db, "users", user.uid, "budgets", b.id)), "Gagal menghapus budget.");
              showAlert("Budget berhasil dihapus.");
            });
          }}
          aria-label={`Hapus budget ${b.category}`}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 focus-visible:opacity-100 z-10"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
        <div className="flex items-center gap-3 pr-10">
          <div className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center text-lg shrink-0">{categoryIcon(b.category)}</div>
          <div className="flex-1 flex flex-col min-w-0">
            <h4 className="font-bold truncate">{b.category}</h4>
            <span className="text-[10px] font-bold opacity-50 uppercase">
              {formatRupiah(b.spent)} / {formatRupiah(b.limit)}
            </span>
          </div>
          <span className={`text-xs font-black px-2 py-1 rounded-full shrink-0 ${style.badge}`}>{Math.round(usage)}%</span>
        </div>
        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
          <div className={`h-full transition-all duration-700 ${style.bar}`} style={{ width: `${Math.min(usage, 100)}%` }} />
        </div>
        <div className="flex justify-between text-[10px] font-bold uppercase">
          <span className="opacity-50">{style.label}</span>
          {b.isSavings ? (
            <span className={remaining <= 0 ? "text-success" : "opacity-50"}>
              {remaining > 0 ? `Kurang ${formatRupiah(remaining)}` : remaining === 0 ? "Sesuai rencana" : `Lebih ${formatRupiah(-remaining)}`}
            </span>
          ) : (
            <span className={remaining < 0 ? "text-destructive" : "opacity-50"}>
              {remaining >= 0 ? `Sisa ${formatRupiah(remaining)}` : `Lewat ${formatRupiah(-remaining)}`}
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center">
      <main className="w-full max-w-md min-h-screen flex flex-col p-6 pb-32 gap-8 animate-[fade-in_0.4s_ease-out]">

        {/* Top Header */}
        <header className="flex justify-between items-center">
          <div className="flex flex-col">
            <h1 className="text-2xl font-bold tracking-tight">
              {TAB_TITLES[activeTab]}
            </h1>
            <div className="flex items-center gap-1 -ml-1.5">
              <button
                onClick={() => shiftMonth(-1)}
                aria-label="Bulan sebelumnya"
                className="w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
              </button>
              <p className="text-muted-foreground text-sm font-medium min-w-30 text-center">{formattedMonth}</p>
              <button
                onClick={() => shiftMonth(1)}
                disabled={isCurrentMonth}
                aria-label="Bulan berikutnya"
                className="w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-30 disabled:pointer-events-none"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
              </button>
              {!isCurrentMonth && (
                <button
                  onClick={() => showMonth(null)}
                  className="ml-1 text-[10px] font-bold text-primary bg-primary/5 px-2 py-1 rounded-full border border-primary/10"
                >
                  Bulan ini
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setManagingCategories(true)}
              aria-label="Kelola kategori"
              title="Kategori"
              className="w-10 h-10 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" /></svg>
            </button>
            <button
              type="button"
              onClick={handleLogout}
              aria-label={`Keluar dari akun ${user.email ?? ""}`}
              title="Keluar"
              className="relative w-10 h-10 rounded-full border-2 border-primary/20 p-0.5 ring-2 ring-primary/5 hover:ring-primary/40 transition-all active:scale-95"
            >
              {user.photoURL && user.photoURL !== brokenPhotoURL ? (
                // Foto profil Google dari domain eksternal; next/image butuh remotePatterns dan tidak sepadan untuk avatar 40px.
                // Google sering menolak (403/429) permintaan yang membawa referrer, jadi referrer tidak dikirim.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.photoURL}
                  referrerPolicy="no-referrer"
                  onError={() => setBrokenPhotoURL(user.photoURL)}
                  className="w-full h-full object-cover rounded-full"
                  alt=""
                />
              ) : (
                <span className="w-full h-full rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs uppercase">
                  {(user.email || user.displayName || "?")[0]}
                </span>
              )}
            </button>
          </div>
        </header>

        {activeTab === "overview" && (
          <div className="flex flex-col gap-8 animate-slide-up">
            {/* Total Balance Card */}
            <div className="gradient-card p-8 flex flex-col gap-8 relative overflow-hidden">
              <div className="absolute top-[-20%] right-[-10%] w-40 h-40 bg-white/10 rounded-full blur-3xl" />
              <div className="flex flex-col gap-1">
                <p className="text-white/70 text-sm font-medium uppercase tracking-wider">Saldo</p>
                <h2 className="text-4xl font-bold tracking-tight">
                  {formatRupiah(balance)}
                </h2>
              </div>

              <div className="grid grid-cols-3 gap-4 border-t border-white/10 pt-6">
                <div className="flex flex-col gap-1 min-w-0">
                  <p className="text-white/50 text-[10px] font-bold uppercase">Pemasukan</p>
                  <p className="text-sm font-bold truncate">{formatNumber(totalIncome)}</p>
                </div>
                <div className="flex flex-col gap-1 min-w-0">
                  <p className="text-white/50 text-[10px] font-bold uppercase">Pengeluaran</p>
                  <p className="text-sm font-bold truncate">{formatNumber(totalExpense)}</p>
                </div>
                <div className="flex flex-col gap-1 min-w-0">
                  <p className="text-white/50 text-[10px] font-bold uppercase">Tabungan</p>
                  <p className="text-sm font-bold truncate">{formatNumber(totalSavings)}</p>
                </div>
              </div>
            </div>

            {/* Budget Warning */}
            {budgetSummary.alertCount > 0 && (
              <button
                onClick={() => setActiveTab("budget")}
                className="premium-card p-4 flex items-center gap-3 text-left border-warning/40 hover:border-warning transition-colors"
              >
                <FontAwesomeIcon icon={faTriangleExclamation} className="text-xl text-warning" />
                <span className="flex-1 text-sm font-bold">
                  {budgetSummary.alertCount} kategori hampir habis atau melewati budget
                </span>
                <span className="text-xs font-bold text-primary flex items-center gap-1">Lihat <FontAwesomeIcon icon={faArrowRight} /></span>
              </button>
            )}

            {/* Core Actions */}
            <div className="grid grid-cols-2 gap-4">
              <AddExpenseForm
                onAdd={handleAddExpense}
                categories={categories}
                onManageCategories={() => setManagingCategories(true)}
                onOpenChange={setIsAdding}
                trigger={
                  <div className="action-tile p-6 flex flex-col items-center justify-center gap-3 cursor-pointer group">
                    <div className="w-12 h-12 rounded-full bg-primary/5 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                    </div>
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Tambah Transaksi</span>
                  </div>
                }
              />
              <AddGoalForm
                onAdd={handleAddGoal}
                categories={goalCategoriesFor()}
                onOpenChange={setIsAdding}
                trigger={
                  <div className="action-tile p-6 flex flex-col items-center justify-center gap-3 cursor-pointer group">
                    <div className="w-12 h-12 rounded-full bg-primary/5 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg>
                    </div>
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Target Baru</span>
                  </div>
                }
              />
            </div>

            {/* Recent Activity Section */}
            <div className="flex flex-col gap-4">
              <div className="flex justify-between items-center px-1">
                <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest">
                  Aktivitas <span className="opacity-60">({filteredTransactions.length})</span>
                </h3>
                <button onClick={handleExportExcel} disabled={exporting} className="text-xs font-bold text-primary hover:underline italic flex items-center gap-1.5 px-3 py-1 bg-primary/5 rounded-lg border border-primary/10 transition-colors">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                  {exporting ? "Mengunduh..." : "Unduh Excel"}
                </button>
              </div>

              <div className="flex flex-col gap-4 relative min-h-25">
                {dataLoading && <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-10"><div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" /></div>}
                {filteredTransactions.length === 0 ? (
                  <div className="text-center py-12 opacity-40 font-medium italic premium-card">Belum ada transaksi di bulan ini</div>
                ) : (
                  (showAllActivity ? filteredTransactions : filteredTransactions.slice(0, ACTIVITY_PREVIEW_COUNT)).map((tx) => {
                    const isExpanded = expandedActivityId === tx.id;
                    return (
                      <div
                        key={tx.id}
                        onClick={() => setExpandedActivityId(isExpanded ? null : tx.id)}
                        className={`premium-card p-5 flex flex-col gap-4 hover:border-primary/20 transition-all cursor-pointer relative group ${isExpanded ? "border-primary/30 ring-2 ring-primary/5" : ""}`}
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shrink-0 ${tx.type === "income" ? "bg-success/10 text-success" : "bg-primary/5 text-primary"}`}>
                            {categoryIcon(tx.category)}
                          </div>
                          <div className="flex-1 flex flex-col min-w-0">
                            <span className="font-bold text-sm tracking-tight truncate">{tx.category}</span>
                            <span className="text-[10px] font-bold opacity-40 uppercase truncate">{tx.note || "Tanpa catatan"}</span>
                          </div>
                          <div className="flex flex-col items-end shrink-0">
                            <span className={`font-black text-sm tracking-tighter ${tx.type === "income" ? "text-success" : "text-destructive"}`}>
                              {tx.type === "income" ? "+" : "-"}{formatNumber(tx.amount)}
                            </span>
                            <span className="text-[10px] font-bold opacity-30">{parseLocalDate(tx.date).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}</span>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="flex gap-2 pt-2 border-t border-muted border-dashed animate-[fade-in_0.2s_ease-out]">
                            <button
                              onClick={(e) => { e.stopPropagation(); setEditingTransaction({ ...tx, note: tx.note ?? "", amount: String(tx.amount) }); }}
                              className="flex-1 py-2.5 rounded-xl bg-primary/5 text-primary font-bold text-xs hover:bg-primary/10 transition-colors flex items-center justify-center gap-2"
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                              Edit
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                showConfirm("Hapus transaksi ini?", () => {
                                  commit(deleteDoc(doc(db, "users", user.uid, "transactions", tx.id)), "Gagal menghapus transaksi.");
                                  setExpandedActivityId(null);
                                  showAlert("Transaksi berhasil dihapus.");
                                });
                              }}
                              className="flex-1 py-2.5 rounded-xl bg-destructive/5 text-destructive font-bold text-xs hover:bg-destructive/10 transition-colors flex items-center justify-center gap-2"
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                              Hapus
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
              {filteredTransactions.length > ACTIVITY_PREVIEW_COUNT && (
                <button
                  onClick={() => setShowAllActivity(!showAllActivity)}
                  className="self-center text-xs font-bold text-primary bg-primary/5 px-4 py-2 rounded-full border border-primary/10 hover:bg-primary/10 transition-colors"
                >
                  {showAllActivity ? "Tampilkan lebih sedikit" : `Lihat semua (${filteredTransactions.length})`}
                </button>
              )}
            </div>
          </div>
        )}

        {activeTab === "budget" && (
          <div className="flex flex-col gap-8 animate-slide-up">
            {/* Budget Summary Card */}
            <div className="gradient-card p-8 flex flex-col gap-6 relative overflow-hidden">
              <div className="absolute top-[-20%] right-[-10%] w-40 h-40 bg-white/10 rounded-full blur-3xl" />
              <div className="flex flex-col gap-1">
                <p className="text-white/70 text-sm font-medium uppercase tracking-wider">
                  {budgetSummary.remaining >= 0 ? "Sisa Budget" : "Melewati Budget"}
                </p>
                <h2 className="text-4xl font-bold tracking-tight">{formatRupiah(Math.abs(budgetSummary.remaining))}</h2>
              </div>
              <div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white transition-all duration-700"
                  style={{ width: `${budgetSummary.totalLimit > 0 ? Math.min((budgetSummary.totalSpent / budgetSummary.totalLimit) * 100, 100) : 0}%` }}
                />
              </div>
              <div className="grid grid-cols-3 gap-4 border-t border-white/10 pt-6">
                <div className="flex flex-col gap-1">
                  <p className="text-white/50 text-[10px] font-bold uppercase">Budget</p>
                  <p className="text-sm font-bold truncate">{formatNumber(budgetSummary.totalLimit)}</p>
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-white/50 text-[10px] font-bold uppercase">Terpakai</p>
                  <p className="text-sm font-bold truncate">{formatNumber(budgetSummary.totalSpent)}</p>
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-white/50 text-[10px] font-bold uppercase">Per Hari</p>
                  <p className="text-sm font-bold truncate">{isCurrentMonth ? formatNumber(budgetSummary.dailyAllowance) : "–"}</p>
                </div>
              </div>
              {isCurrentMonth && (
                <p className="text-white/60 text-[11px] font-medium -mt-2">
                  {budgetSummary.daysLeft} hari tersisa bulan ini
                </p>
              )}
              {budgetSummary.savingsPlanned > 0 && (
                <p className="text-white/80 text-xs font-bold bg-white/10 rounded-2xl px-4 py-3 -mt-2">
                  <FontAwesomeIcon icon={faBuildingColumns} className="mr-2" />Tabungan: {formatRupiah(budgetSummary.savingsDone)} dari rencana {formatRupiah(budgetSummary.savingsPlanned)}
                </p>
              )}
            </div>

            {/* Budget per Category */}
            <div className="flex flex-col gap-4">
              <div className="flex justify-between items-center px-1">
                <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Per Kategori</h3>
                {availableBudgetCategories.length === 0 ? (
                  <button
                    onClick={() => setManagingCategories(true)}
                    className="text-xs font-bold text-primary hover:text-primary/80 transition-colors flex items-center gap-1.5 bg-primary/5 px-3 py-1.5 rounded-full border border-primary/10"
                  >
                    <span className="text-sm">+</span> Buat Kategori
                  </button>
                ) : (
                  <AddBudgetForm
                    onAdd={handleAddBudget}
                    categories={availableBudgetCategories}
                    onOpenChange={setIsAdding}
                    trigger={
                      <button className="text-xs font-bold text-primary hover:text-primary/80 transition-colors flex items-center gap-1.5 bg-primary/5 px-3 py-1.5 rounded-full border border-primary/10">
                        <span className="text-sm">+</span> Tambah Budget
                      </button>
                    }
                  />
                )}
              </div>

              <div className="flex flex-col gap-4 relative min-h-25">
                {budgetsLoading && <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-10"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>}
                {budgetRows.length === 0 ? (
                  <div className="text-center py-12 opacity-40 font-medium italic premium-card">Belum ada budget. Tambahkan budget per kategori.</div>
                ) : (
                  <>
                    {spendingBudgetRows.map(renderBudgetCard)}
                    {savingsBudgetRows.length > 0 && (
                      <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest px-1 mt-2 flex items-center gap-2"><FontAwesomeIcon icon={faBuildingColumns} /> Tabungan</h4>
                    )}
                    {savingsBudgetRows.map(renderBudgetCard)}
                  </>
                )}
              </div>
            </div>

            {/* Spending without budget */}
            {unbudgetedSpending.length > 0 && (
              <div className="flex flex-col gap-4">
                <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest px-1">Tanpa Budget</h3>
                <div className="premium-card p-2 flex flex-col">
                  {unbudgetedSpending.map(([category, spent]) => (
                    <div key={category} className="flex items-center gap-3 p-3">
                      <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center shrink-0">{categoryIcon(category)}</div>
                      <span className="flex-1 font-bold text-sm truncate">{category}</span>
                      <span className="font-black text-sm tracking-tighter text-destructive">-{formatNumber(spent)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "goals" && (
          <div className="flex flex-col gap-8 animate-slide-up">
            {/* Goals Section */}
            <div className="flex flex-col gap-4">
              <div className="flex justify-between items-center px-1">
                <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Progres Tabungan</h3>
                <AddGoalForm
                  onAdd={handleAddGoal}
                  categories={goalCategoriesFor()}
                  onOpenChange={setIsAdding}
                  trigger={
                    <button className="text-xs font-bold text-primary hover:text-primary/80 transition-colors flex items-center gap-1.5 bg-primary/5 px-3 py-1.5 rounded-full border border-primary/10">
                      <span className="text-sm">+</span> Tambah Target
                    </button>
                  }
                />
              </div>

              <div className="flex flex-col gap-4 relative min-h-25">
                {goalsLoading && <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-10"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>}
                {goalRows.length === 0 ? (
                  <div className="text-center py-12 opacity-40 font-medium italic premium-card">Belum ada target</div>
                ) : (
                  goalRows.map(goal => {
                    const { progress } = goal;
                    return (
                      <div
                        key={goal.id}
                        onClick={() => setEditingGoal({ id: goal.id, name: goal.name, targetAmount: String(goal.targetAmount), currentAmount: String(goal.currentAmount), category: goal.category ?? "" })}
                        className="premium-card p-6 flex flex-col gap-4 group relative cursor-pointer hover:border-primary/30 transition-all active:scale-[0.98]"
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            showConfirm(`Hapus target "${goal.name}"?`, () => {
                              commit(deleteDoc(doc(db, "users", user.uid, "goals", goal.id)), "Gagal menghapus target.");
                              showAlert("Target berhasil dihapus.");
                            });
                          }}
                          aria-label={`Hapus target ${goal.name}`}
                          // Di layar sentuh tidak ada hover, jadi tombol selalu terlihat; di desktop muncul saat hover
                          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 focus-visible:opacity-100 z-10"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center text-lg shrink-0">
                              <FontAwesomeIcon icon={goal.category ? iconFor(categories, goal.category) : faBullseye} />
                            </div>
                            <div className="flex flex-col min-w-0">
                              <h4 className="font-bold truncate max-w-37.5">{goal.name}</h4>
                              {goal.category && (
                                <span className="text-[10px] font-bold text-muted-foreground truncate max-w-42.5">Otomatis dari kategori {goal.category}</span>
                              )}
                            </div>
                          </div>
                          {goal.reached ? (
                            <span className="text-xs font-black text-success bg-success/10 px-2 py-1 rounded-full shrink-0 mr-8 pointer-fine:mr-0 flex items-center gap-1"><FontAwesomeIcon icon={faCheck} /> Tercapai</span>
                          ) : (
                            <span className="text-xs font-black text-primary bg-primary/10 px-2 py-1 rounded-full shrink-0 mr-8 pointer-fine:mr-0">{Math.round(progress)}%</span>
                          )}
                        </div>
                        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className={`h-full transition-all duration-700 ${goal.reached ? "bg-success" : "bg-primary"}`} style={{ width: `${progress}%` }} />
                        </div>
                        <div className="flex justify-between text-[10px] font-bold opacity-50 uppercase">
                          <span>Terkumpul: {formatRupiah(goal.saved)}</span>
                          <span>Target: {formatRupiah(goal.targetAmount)}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* Floating Bottom Nav */}
        {!isAdding && !managingCategories && !editingGoal && !editingTransaction && !editingBudget && (
          <nav className="fixed bottom-8 left-1/2 -translate-x-1/2 w-[75%] max-w-sm glass rounded-[2.5rem] p-2 flex justify-center items-center shadow-2xl shadow-primary/20 z-50 border border-white/40 gap-2 animate-[slide-up_0.3s_ease-out]">
            <button onClick={() => setActiveTab("overview")} aria-label="Beranda" className={`flex items-center justify-center gap-2 flex-1 py-4 px-2 rounded-full transition-all duration-300 ${activeTab === "overview" ? "bg-primary text-white shadow-xl shadow-primary/30" : "text-muted-foreground hover:bg-muted"}`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>
            </button>
            <button onClick={() => setActiveTab("budget")} aria-label="Budget" className={`relative flex items-center justify-center gap-2 flex-1 py-4 px-2 rounded-full transition-all duration-300 ${activeTab === "budget" ? "bg-primary text-white shadow-xl shadow-primary/30" : "text-muted-foreground hover:bg-muted"}`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></svg>
              {activeTab !== "budget" && budgetSummary.alertCount > 0 && <span className="absolute top-3 right-[30%] w-2 h-2 rounded-full bg-destructive" />}
            </button>
            <button onClick={() => setActiveTab("goals")} aria-label="Target" className={`flex items-center justify-center gap-2 flex-1 py-4 px-2 rounded-full transition-all duration-300 ${activeTab === "goals" ? "bg-primary text-white shadow-xl shadow-primary/30" : "text-muted-foreground hover:bg-muted"}`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
            </button>
          </nav>
        )}

        {managingCategories && (
          <ManageCategories
            categories={categories}
            onAdd={handleAddCategory}
            onDelete={handleDeleteCategory}
            onClose={() => setManagingCategories(false)}
          />
        )}

        {/* Custom Premium Alert */}
        {alert && (
          <div className="fixed inset-0 z-100 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm animate-[fade-in_0.2s_ease-out]">
            <div className="w-full max-w-xs premium-card p-8 flex flex-col items-center text-center gap-6 animate-[scale-up_0.3s_ease-out]">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center text-3xl ${alert.type === "success" ? "bg-success/20 text-success" : alert.type === "error" ? "bg-destructive/20 text-destructive" : "bg-primary/20 text-primary"}`}>
                <FontAwesomeIcon icon={alert.type === "success" ? faCheck : alert.type === "error" ? faXmark : faCircleQuestion} />
              </div>
              <p className="font-bold text-lg leading-snug">{alert.message}</p>
              <div className="flex gap-3 w-full">
                {alert.type === "confirm" ? (
                  <>
                    <button onClick={closeAlert} className="flex-1 py-3.5 px-4 rounded-2xl bg-muted font-bold text-xs uppercase tracking-widest hover:bg-muted/80 transition-colors">Batal</button>
                    <button onClick={alert.onConfirm} className="flex-1 py-3.5 px-4 rounded-2xl bg-destructive text-white font-bold text-xs uppercase tracking-widest hover:opacity-90 transition-opacity shadow-lg shadow-destructive/20">{alert.confirmText || "Hapus"}</button>
                  </>
                ) : (
                  <button onClick={closeAlert} className="flex-1 py-4 px-4 rounded-2xl bg-primary text-white font-bold text-sm hover:opacity-90 transition-opacity shadow-lg shadow-primary/20">Oke</button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Edit Transaction Modal */}
        {editingTransaction && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm animate-[fade-in_0.2s_ease-out]">
            <form onSubmit={handleSaveTransaction} className="w-full max-w-sm premium-card p-8 flex flex-col gap-6 animate-[slide-up_0.3s_ease-out]">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold">Edit Transaksi</h3>
                <button type="button" aria-label="Tutup" onClick={() => setEditingTransaction(null)} className="text-muted-foreground hover:text-foreground w-10 h-10 flex items-center justify-center rounded-full hover:bg-muted transition-colors">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </div>
              <div className="flex flex-col gap-4">
                <div className="flex p-1 bg-muted rounded-2xl">
                  {(["expense", "income"] as const).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setEditingTransaction({
                        ...editingTransaction,
                        type: t,
                        // Kategori ikut berganti kalau tidak cocok dengan tipe yang baru
                        category: categoriesFor(categories, t).some(c => c.name === editingTransaction.category) ? editingTransaction.category : categoriesFor(categories, t)[0]?.name ?? "",
                      })}
                      className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${editingTransaction.type === t ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"}`}
                    >
                      {t === "expense" ? "Pengeluaran" : "Pemasukan"}
                    </button>
                  ))}
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase ml-1">Kategori</label>
                  <select
                    value={editingTransaction.category}
                    onChange={(e) => setEditingTransaction({ ...editingTransaction, category: e.target.value })}
                    className="w-full bg-muted border-none p-4 rounded-2xl font-bold appearance-none outline-none focus:ring-2 ring-primary transition-all"
                  >
                    {categoriesFor(categories, editingTransaction.type).map(c => (
                      <option key={c.id} value={c.name}>{c.name} {c.icon}</option>
                    ))}
                    {/* Kategori yang sudah dihapus tetap bisa dipertahankan */}
                    {!categoriesFor(categories, editingTransaction.type).some(c => c.name === editingTransaction.category) && (
                      <option value={editingTransaction.category}>{editingTransaction.category || "Pilih kategori"}</option>
                    )}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase ml-1">Tanggal</label>
                  <input
                    type="date"
                    required
                    value={editingTransaction.date}
                    onChange={(e) => setEditingTransaction({ ...editingTransaction, date: e.target.value })}
                    className="w-full bg-muted border-none p-4 rounded-2xl font-bold focus:ring-2 ring-primary outline-none transition-all"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase ml-1">Catatan</label>
                  <input
                    type="text"
                    value={editingTransaction.note}
                    onChange={(e) => setEditingTransaction({ ...editingTransaction, note: e.target.value })}
                    className="w-full bg-muted border-none p-4 rounded-2xl font-bold focus:ring-2 ring-primary outline-none transition-all"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase ml-1">Jumlah (Rp)</label>
                  <AmountInput
                    value={editingTransaction.amount}
                    onChange={(v) => setEditingTransaction({ ...editingTransaction, amount: v })}
                    className="w-full bg-muted border-none p-4 rounded-2xl font-bold focus:ring-2 ring-primary outline-none transition-all"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full py-4 bg-primary text-white font-bold rounded-2xl hover:opacity-90 transition-opacity active:scale-95 shadow-xl shadow-primary/20"
              >
                Simpan Perubahan
              </button>
            </form>
          </div>
        )}

        {/* Edit Goal Modal */}
        {editingGoal && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm animate-[fade-in_0.2s_ease-out]">
            <form onSubmit={handleSaveGoal} className="w-full max-w-sm premium-card p-8 flex flex-col gap-6 animate-[slide-up_0.3s_ease-out]">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold">Edit Target</h3>
                <button type="button" aria-label="Tutup" onClick={() => setEditingGoal(null)} className="text-muted-foreground hover:text-foreground w-10 h-10 flex items-center justify-center rounded-full hover:bg-muted transition-colors">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </div>
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase ml-1">Nama Target</label>
                  <input
                    type="text"
                    value={editingGoal.name}
                    onChange={(e) => setEditingGoal({ ...editingGoal, name: e.target.value })}
                    className="w-full bg-muted border-none p-4 rounded-2xl font-bold focus:ring-2 ring-primary transition-all outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase ml-1">Hubungkan ke Kategori</label>
                  <select
                    value={editingGoal.category}
                    onChange={(e) => setEditingGoal({ ...editingGoal, category: e.target.value })}
                    className="w-full bg-muted border-none p-4 rounded-2xl font-bold appearance-none outline-none focus:ring-2 ring-primary transition-all"
                  >
                    <option value="">Tidak dihubungkan (isi manual)</option>
                    {goalCategoriesFor(editingGoal.id).map(c => (
                      <option key={c.id} value={c.name}>{c.icon} {c.name}</option>
                    ))}
                    {/* Kategori yang sudah dihapus tetap bisa dipertahankan */}
                    {editingGoal.category && !expenseCategories.some(c => c.name === editingGoal.category) && (
                      <option value={editingGoal.category}>{editingGoal.category}</option>
                    )}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase ml-1">{editingGoal.category ? "Saldo Awal (Rp)" : "Terkumpul (Rp)"}</label>
                  <AmountInput
                    value={editingGoal.currentAmount}
                    onChange={(v) => setEditingGoal({ ...editingGoal, currentAmount: v })}
                    className="w-full bg-muted border-none p-4 rounded-2xl font-bold focus:ring-2 ring-primary transition-all outline-none"
                  />
                  {editingGoal.category && (
                    <p className="text-[11px] text-muted-foreground ml-1">
                      Ditambah {formatRupiah(spentAllTime.get(editingGoal.category) ?? 0)} dari transaksi {editingGoal.category}. Kurangi saldo awal kalau Anda menarik dana dari tabungan ini.
                    </p>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase ml-1">Target Total (Rp)</label>
                  <AmountInput
                    value={editingGoal.targetAmount}
                    onChange={(v) => setEditingGoal({ ...editingGoal, targetAmount: v })}
                    className="w-full bg-muted border-none p-4 rounded-2xl font-bold focus:ring-2 ring-primary transition-all outline-none"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full py-4 bg-primary text-white font-bold rounded-2xl hover:opacity-90 transition-opacity active:scale-95"
              >
                Simpan Perubahan
              </button>
            </form>
          </div>
        )}

        {/* Edit Budget Modal */}
        {editingBudget && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm animate-[fade-in_0.2s_ease-out]">
            <form onSubmit={handleSaveBudget} className="w-full max-w-sm premium-card p-8 flex flex-col gap-6 animate-[slide-up_0.3s_ease-out]">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold">Edit Budget</h3>
                <button type="button" aria-label="Tutup" onClick={() => setEditingBudget(null)} className="text-muted-foreground hover:text-foreground w-10 h-10 flex items-center justify-center rounded-full hover:bg-muted transition-colors">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </div>
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3 p-4 bg-muted rounded-2xl">
                  <span className="text-xl">{categoryIcon(editingBudget.category)}</span>
                  <span className="font-bold">{editingBudget.category}</span>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase ml-1">Batas per Bulan (Rp)</label>
                  <AmountInput
                    autoFocus
                    value={editingBudget.limit}
                    onChange={(v) => setEditingBudget({ ...editingBudget, limit: v })}
                    className="w-full bg-muted border-none p-4 rounded-2xl font-bold focus:ring-2 ring-primary transition-all outline-none"
                  />
                  <p className="text-[11px] text-muted-foreground ml-1">Perubahan berlaku untuk bulan ini dan bulan-bulan berikutnya.</p>
                </div>
              </div>
              <button
                type="submit"
                className="w-full py-4 bg-primary text-white font-bold rounded-2xl hover:opacity-90 transition-opacity active:scale-95"
              >
                Simpan Perubahan
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}

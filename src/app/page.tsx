"use client";

import { useState, useEffect, useMemo } from "react";
import AddExpenseForm from "@/components/AddExpenseForm";
import AddGoalForm from "@/components/AddGoalForm";
import Auth from "@/components/Auth";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import {
  collection,
  query,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  orderBy
} from "firebase/firestore";

type Tab = "overview" | "budget";

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [balance, setBalance] = useState(0);
  const [totalIncome, setTotalIncome] = useState(0);
  const [totalExpense, setTotalExpense] = useState(0);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [goals, setGoals] = useState<any[]>([]);
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(true);

  const [editingGoal, setEditingGoal] = useState<any | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<any | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [expandedActivityId, setExpandedActivityId] = useState<string | null>(null);
  const [currentMonth] = useState(new Date());

  // Custom Alert State
  const [alert, setAlert] = useState<{ message: string, type: "success" | "error" | "confirm", confirmText?: string, onConfirm?: () => void } | null>(null);

  const showAlert = (message: string, type: "success" | "error" = "success") => {
    setAlert({ message, type });
    setTimeout(() => setAlert(null), 3000);
  };
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
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
    setDataLoading(true);
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const txs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      setRecentTransactions(txs);
      setDataLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  // Sync Goals
  useEffect(() => {
    if (!user) return;
    const q = collection(db, "users", user.uid, "goals");
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const gs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      setGoals(gs);
    });
    return () => unsubscribe();
  }, [user]);

  // Totals Calculation
  const filteredTransactions = useMemo(() => {
    return recentTransactions.filter((tx) => {
      const txDate = new Date(tx.date);
      return txDate.getMonth() === currentMonth.getMonth() && txDate.getFullYear() === currentMonth.getFullYear();
    });
  }, [recentTransactions, currentMonth]);

  useEffect(() => {
    let income = 0;
    let expense = 0;
    filteredTransactions.forEach((tx) => {
      if (tx.type === "income") income += tx.amount;
      else expense += tx.amount;
    });
    setTotalIncome(income);
    setTotalExpense(expense);
    setBalance(income - expense);
  }, [filteredTransactions]);

  const handleLogout = async () => {
    setAlert({
      message: "Are you sure you want to sign out?",
      type: "confirm",
      confirmText: "Sign Out",
      onConfirm: async () => {
        try { await signOut(auth); } catch (e) { showAlert("Gagal keluar.", "error"); }
        setAlert(null);
      }
    });
  };

  const formattedMonth = currentMonth.toLocaleDateString("id-ID", { month: "long", year: "numeric" });

  const handleExportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text("Laporan Spending Track", 14, 22);
    doc.setFontSize(12);
    doc.text(`Bulan: ${formattedMonth}`, 14, 30);
    doc.text(`Total Pemasukan: Rp ${totalIncome.toLocaleString()}`, 14, 38);
    doc.text(`Total Pengeluaran: Rp ${totalExpense.toLocaleString()}`, 14, 46);

    const tableRows = filteredTransactions.map(tx => [
      new Date(tx.date).toLocaleDateString("id-ID"),
      tx.category,
      tx.note || "-",
      tx.type === "income" ? "Pemasukan" : "Pengeluaran",
      `Rp ${tx.amount.toLocaleString()}`
    ]);

    autoTable(doc, {
      head: [["Tanggal", "Kategori", "Catatan", "Tipe", "Jumlah"]],
      body: tableRows,
      startY: 55,
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229] },
    });

    doc.save(`spending_track_${formattedMonth.replace(/ /g, '_')}.pdf`);
  };

  const handleAddExpense = async (expense: any) => {
    if (!user) return;
    await addDoc(collection(db, "users", user.uid, "transactions"), expense);
  };

  const handleAddGoal = async (goal: any) => {
    if (!user) return;
    await addDoc(collection(db, "users", user.uid, "goals"), goal);
  };

  if (!mounted || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f0f4f8]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground font-medium animate-pulse">Initializing...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Auth />;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center">
      <main className="w-full max-w-md min-h-screen flex flex-col p-6 pb-32 gap-8 animate-[fade-in_0.4s_ease-out]">

        {/* Top Header */}
        <header className="flex justify-between items-center">
          <div className="flex flex-col">
            <h1 className="text-2xl font-bold tracking-tight">
              {activeTab === "overview" ? "Finance Overview" : "Goals"}
            </h1>
            <p className="text-muted-foreground text-sm font-medium">{formattedMonth}</p>
          </div>
          <div className="flex items-center gap-3">
            <div
              onClick={handleLogout}
              className="w-10 h-10 rounded-full border-2 border-primary/20 p-0.5 overflow-hidden ring-2 ring-primary/5 cursor-pointer hover:ring-primary/40 transition-all active:scale-95"
            >
              {user.photoURL ? (
                <img src={user.photoURL} className="w-full h-full object-cover rounded-full" alt="Profile" />
              ) : (
                <div className="w-full h-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs uppercase">
                  {user.email?.[0]}
                </div>
              )}
            </div>
          </div>
        </header>

        {activeTab === "overview" && (
          <div className="flex flex-col gap-8 animate-[slide-up_0.4s_ease-out]">
            {/* Total Balance Card */}
            <div className="gradient-card p-8 flex flex-col gap-8 relative overflow-hidden">
              <div className="absolute top-[-20%] right-[-10%] w-40 h-40 bg-white/10 rounded-full blur-3xl" />
              <div className="flex flex-col gap-1">
                <p className="text-white/70 text-sm font-medium uppercase tracking-wider">Total Balance</p>
                <h2 className="text-4xl font-bold tracking-tight">
                  {new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR" }).format(balance)}
                </h2>
              </div>

              <div className="grid grid-cols-2 gap-4 border-t border-white/10 pt-6">
                <div className="flex flex-col gap-1">
                  <p className="text-white/50 text-[10px] font-bold uppercase">Income</p>
                  <p className="text-sm font-bold truncate">Rp {totalIncome.toLocaleString()}</p>
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-white/50 text-[10px] font-bold uppercase">Spending</p>
                  <p className="text-sm font-bold truncate">Rp {totalExpense.toLocaleString()}</p>
                </div>
              </div>
            </div>

            {/* Core Actions */}
            <div className="grid grid-cols-2 gap-4">
              <AddExpenseForm
                onAdd={handleAddExpense}
                onOpenChange={setIsAdding}
                trigger={
                  <div className="action-tile p-6 flex flex-col items-center justify-center gap-3 cursor-pointer group">
                    <div className="w-12 h-12 rounded-full bg-primary/5 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                    </div>
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Add Expense</span>
                  </div>
                }
              />
              <AddGoalForm
                onAdd={handleAddGoal}
                onOpenChange={setIsAdding}
                trigger={
                  <div className="action-tile p-6 flex flex-col items-center justify-center gap-3 cursor-pointer group">
                    <div className="w-12 h-12 rounded-full bg-primary/5 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg>
                    </div>
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">New Goal</span>
                  </div>
                }
              />
            </div>

            {/* Recent Activity Section */}
            <div className="flex flex-col gap-4">
              <div className="flex justify-between items-center px-1">
                <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Recent Activity</h3>
                <button onClick={handleExportPDF} className="text-xs font-bold text-primary hover:underline italic flex items-center gap-1.5 px-3 py-1 bg-primary/5 rounded-lg border border-primary/10 transition-colors">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                  Export PDF
                </button>
              </div>

              <div className="flex flex-col gap-4 relative min-h-[100px]">
                {dataLoading && <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-10"><div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" /></div>}
                {filteredTransactions.length === 0 ? (
                  <div className="text-center py-12 opacity-40 font-medium italic premium-card">No activity this month</div>
                ) : (
                  filteredTransactions.slice(0, 10).map((tx: any) => {
                    const isExpanded = expandedActivityId === tx.id;
                    return (
                      <div
                        key={tx.id}
                        onClick={() => setExpandedActivityId(isExpanded ? null : tx.id)}
                        className={`premium-card p-5 flex flex-col gap-4 hover:border-primary/20 transition-all cursor-pointer relative group ${isExpanded ? "border-primary/30 ring-2 ring-primary/5" : ""}`}
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shrink-0 ${tx.type === "income" ? "bg-success/10 text-success" : "bg-primary/5 text-primary"}`}>
                            {tx.category === "Food" ? "🍔" : tx.category === "Transport" ? "🚕" : tx.category === "Entertainment" ? "🎬" : tx.category === "Shopping" ? "🛍️" : tx.category === "Bills" ? "📱" : "💰"}
                          </div>
                          <div className="flex-1 flex flex-col min-w-0">
                            <span className="font-bold text-sm tracking-tight truncate">{tx.category}</span>
                            <span className="text-[10px] font-bold opacity-40 uppercase truncate">{tx.note || "General"}</span>
                          </div>
                          <div className="flex flex-col items-end shrink-0">
                            <span className={`font-black text-sm tracking-tighter ${tx.type === "income" ? "text-success" : "text-destructive"}`}>
                              {tx.type === "income" ? "+" : "-"}{tx.amount.toLocaleString()}
                            </span>
                            <span className="text-[10px] font-bold opacity-30">{new Date(tx.date).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}</span>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="flex gap-2 pt-2 border-t border-muted border-dashed animate-[fade-in_0.2s_ease-out]">
                            <button
                              onClick={(e) => { e.stopPropagation(); setEditingTransaction(tx); }}
                              className="flex-1 py-2.5 rounded-xl bg-primary/5 text-primary font-bold text-xs hover:bg-primary/10 transition-colors flex items-center justify-center gap-2"
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                              Edit
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setAlert({
                                  message: "Hapus transaksi ini?",
                                  type: "confirm",
                                  onConfirm: async () => {
                                    await deleteDoc(doc(db, "users", user.uid!, "transactions", tx.id));
                                    showAlert("Transaksi berhasil dihapus.");
                                    setAlert(null);
                                    setExpandedActivityId(null);
                                  }
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
            </div>
          </div>
        )}

        {activeTab === "budget" && (
          <div className="flex flex-col gap-8 animate-[slide-up_0.4s_ease-out]">
            {/* Goals Section */}
            <div className="flex flex-col gap-4">
              <div className="flex justify-between items-center px-1">
                <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Savings Progress</h3>
                <AddGoalForm
                  onAdd={handleAddGoal}
                  onOpenChange={setIsAdding}
                  trigger={
                    <button className="text-xs font-bold text-primary hover:text-primary/80 transition-colors flex items-center gap-1.5 bg-primary/5 px-3 py-1.5 rounded-full border border-primary/10">
                      <span className="text-sm">+</span> Add Goal
                    </button>
                  }
                />
              </div>

              <div className="flex flex-col gap-4 relative min-h-[100px]">
                {dataLoading && <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-10"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>}
                {goals.length === 0 ? (
                  <div className="text-center py-12 opacity-40 font-medium italic premium-card">No goals set yet</div>
                ) : (
                  goals.map(goal => {
                    const progress = Math.min((goal.currentAmount / goal.targetAmount) * 100, 100);
                    return (
                      <div
                        key={goal.id}
                        onClick={() => setEditingGoal(goal)}
                        className="premium-card p-6 flex flex-col gap-4 group relative cursor-pointer hover:border-primary/30 transition-all active:scale-[0.98]"
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setAlert({
                              message: `Hapus target "${goal.name}"?`,
                              type: "confirm",
                              onConfirm: async () => {
                                await deleteDoc(doc(db, "users", user.uid!, "goals", goal.id));
                                showAlert("Target berhasil dihapus.");
                                setAlert(null);
                              }
                            });
                          }}
                          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all opacity-0 group-hover:opacity-100 z-10"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center text-lg">🎯</div>
                            <h4 className="font-bold truncate max-w-[150px]">{goal.name}</h4>
                          </div>
                          <span className="text-xs font-black text-primary bg-primary/10 px-2 py-1 rounded-full">{Math.round(progress)}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary transition-all duration-700" style={{ width: `${progress}%` }} />
                        </div>
                        <div className="flex justify-between text-[10px] font-bold opacity-50 uppercase">
                          <span>Saved: Rp {goal.currentAmount.toLocaleString()}</span>
                          <span>Target: Rp {goal.targetAmount.toLocaleString()}</span>
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
        {!isAdding && !editingGoal && !editingTransaction && (
          <nav className="fixed bottom-8 left-1/2 -translate-x-1/2 w-[60%] max-w-xs glass rounded-[2.5rem] p-2 flex justify-center items-center shadow-2xl shadow-primary/20 z-50 border border-white/40 gap-2 animate-[slide-up_0.3s_ease-out]">
            <button onClick={() => setActiveTab("overview")} className={`flex items-center justify-center gap-2 flex-1 py-4 px-2 rounded-full transition-all duration-300 ${activeTab === "overview" ? "bg-primary text-white shadow-xl shadow-primary/30" : "text-muted-foreground hover:bg-muted"}`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>
              {activeTab === "overview" && <span className="text-xs font-black uppercase tracking-widest ml-1">Home</span>}
            </button>
            <button onClick={() => setActiveTab("budget")} className={`flex items-center justify-center gap-2 flex-1 py-4 px-2 rounded-full transition-all duration-300 ${activeTab === "budget" ? "bg-primary text-white shadow-xl shadow-primary/30" : "text-muted-foreground hover:bg-muted"}`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
              {activeTab === "budget" && <span className="text-xs font-black uppercase tracking-widest ml-1">Goals</span>}
            </button>
          </nav>
        )}

        {/* Custom Premium Alert */}
        {alert && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm animate-[fade-in_0.2s_ease-out]">
            <div className="w-full max-w-xs premium-card p-8 flex flex-col items-center text-center gap-6 animate-[scale-up_0.3s_ease-out]">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center text-3xl ${alert.type === "success" ? "bg-success/20 text-success" : alert.type === "error" ? "bg-destructive/20 text-destructive" : "bg-primary/20 text-primary"}`}>
                {alert.type === "success" ? "✓" : alert.type === "error" ? "✕" : "💬"}
              </div>
              <p className="font-bold text-lg leading-snug">{alert.message}</p>
              <div className="flex gap-3 w-full">
                {alert.type === "confirm" ? (
                  <>
                    <button onClick={() => setAlert(null)} className="flex-1 py-3.5 px-4 rounded-2xl bg-muted font-bold text-xs uppercase tracking-widest hover:bg-muted/80 transition-colors">Batal</button>
                    <button onClick={alert.onConfirm} className="flex-1 py-3.5 px-4 rounded-2xl bg-destructive text-white font-bold text-xs uppercase tracking-widest hover:opacity-90 transition-opacity shadow-lg shadow-destructive/20">{alert.confirmText || "Hapus"}</button>
                  </>
                ) : (
                  <button onClick={() => setAlert(null)} className="flex-1 py-4 px-4 rounded-2xl bg-primary text-white font-bold text-sm hover:opacity-90 transition-opacity shadow-lg shadow-primary/20">Oke</button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Edit Transaction Modal */}
        {editingTransaction && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm animate-[fade-in_0.2s_ease-out]">
            <div className="w-full max-w-sm premium-card p-8 flex flex-col gap-6 animate-[slide-up_0.3s_ease-out]">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold">Edit Transaksi</h3>
                <button onClick={() => setEditingTransaction(null)} className="text-muted-foreground hover:text-foreground w-10 h-10 flex items-center justify-center rounded-full hover:bg-muted transition-colors">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </div>
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase ml-1">Kategori</label>
                  <select
                    value={editingTransaction.category}
                    onChange={(e) => setEditingTransaction({ ...editingTransaction, category: e.target.value })}
                    className="w-full bg-muted border-none p-4 rounded-2xl font-bold appearance-none outline-none focus:ring-2 ring-primary transition-all"
                  >
                    {["Food", "Transport", "Entertainment", "Shopping", "Bills", "Social"].map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
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
                  <input
                    type="number"
                    value={editingTransaction.amount}
                    onChange={(e) => setEditingTransaction({ ...editingTransaction, amount: Number(e.target.value) })}
                    className="w-full bg-muted border-none p-4 rounded-2xl font-bold focus:ring-2 ring-primary outline-none transition-all"
                  />
                </div>
              </div>
              <button
                onClick={async () => {
                  await updateDoc(doc(db, "users", user.uid!, "transactions", editingTransaction.id), {
                    category: editingTransaction.category,
                    note: editingTransaction.note,
                    amount: editingTransaction.amount
                  });
                  showAlert("Transaksi berhasil diperbarui.");
                  setEditingTransaction(null);
                  setExpandedActivityId(null);
                }}
                className="w-full py-4 bg-primary text-white font-bold rounded-2xl hover:opacity-90 transition-opacity active:scale-95 shadow-xl shadow-primary/20"
              >
                Simpan Perubahan
              </button>
            </div>
          </div>
        )}

        {/* Edit Goal Modal */}
        {editingGoal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm animate-[fade-in_0.2s_ease-out]">
            <div className="w-full max-w-sm premium-card p-8 flex flex-col gap-6 animate-[slide-up_0.3s_ease-out]">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold">Edit Target</h3>
                <button onClick={() => setEditingGoal(null)} className="text-muted-foreground hover:text-foreground w-10 h-10 flex items-center justify-center rounded-full hover:bg-muted transition-colors">
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
                  <label className="text-[10px] font-bold text-muted-foreground uppercase ml-1">Terumpul (Rp)</label>
                  <input
                    type="number"
                    value={editingGoal.currentAmount}
                    onChange={(e) => setEditingGoal({ ...editingGoal, currentAmount: Number(e.target.value) })}
                    className="w-full bg-muted border-none p-4 rounded-2xl font-bold focus:ring-2 ring-primary transition-all outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase ml-1">Target Total (Rp)</label>
                  <input
                    type="number"
                    value={editingGoal.targetAmount}
                    onChange={(e) => setEditingGoal({ ...editingGoal, targetAmount: Number(e.target.value) })}
                    className="w-full bg-muted border-none p-4 rounded-2xl font-bold focus:ring-2 ring-primary transition-all outline-none"
                  />
                </div>
              </div>
              <button
                onClick={async () => {
                  await updateDoc(doc(db, "users", user.uid!, "goals", editingGoal.id), {
                    name: editingGoal.name,
                    currentAmount: editingGoal.currentAmount,
                    targetAmount: editingGoal.targetAmount
                  });
                  showAlert("Target berhasil diperbarui.");
                  setEditingGoal(null);
                }}
                className="w-full py-4 bg-primary text-white font-bold rounded-2xl hover:opacity-90 transition-opacity active:scale-95"
              >
                Simpan Perubahan
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

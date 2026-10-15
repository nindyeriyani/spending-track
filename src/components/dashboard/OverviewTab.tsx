import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { faArrowRight, faTriangleExclamation } from "@fortawesome/free-solid-svg-icons";
import AddExpenseForm from "@/components/AddExpenseForm";
import AddGoalForm from "@/components/AddGoalForm";
import { parseLocalDate } from "@/lib/date";
import { formatNumber, formatRupiah } from "@/lib/format";
import type { monthTotals } from "@/lib/summary";
import type { Category, GoalInput, Transaction, TransactionInput } from "@/lib/types";
import { LoadingOverlay } from "./ui";

// Jumlah transaksi yang tampil sebelum tombol "Lihat semua"
const ACTIVITY_PREVIEW_COUNT = 10;

export default function OverviewTab({
    totals, budgetAlertCount, onShowBudget,
    categories, goalCategories, onAddExpense, onAddGoal, onManageCategories, onAddingChange,
    transactions, loading, iconFor, expandedId, onExpandedChange, showAll, onShowAllChange, onEdit, onDelete,
    exporting, onExport,
}: {
    totals: ReturnType<typeof monthTotals>;
    budgetAlertCount: number;
    onShowBudget: () => void;
    categories: readonly Category[];
    goalCategories: readonly Category[];
    onAddExpense: (expense: TransactionInput) => void;
    onAddGoal: (goal: GoalInput) => void;
    onManageCategories: () => void;
    onAddingChange: (adding: boolean) => void;
    transactions: readonly Transaction[];
    loading: boolean;
    iconFor: (category: string) => IconDefinition;
    expandedId: string | null;
    onExpandedChange: (id: string | null) => void;
    showAll: boolean;
    onShowAllChange: (showAll: boolean) => void;
    onEdit: (tx: Transaction) => void;
    onDelete: (tx: Transaction) => void;
    exporting: boolean;
    onExport: () => void;
}) {
    return (
        <div className="flex flex-col gap-8 animate-slide-up">
            {/* Total Balance Card */}
            <div className="gradient-card p-8 flex flex-col gap-8 relative overflow-hidden">
                <div className="absolute top-[-20%] right-[-10%] w-40 h-40 bg-white/10 rounded-full blur-3xl" />
                <div className="flex flex-col gap-1">
                    <p className="text-white/70 text-sm font-medium uppercase tracking-wider">Saldo</p>
                    <h2 className="text-4xl font-bold tracking-tight">{formatRupiah(totals.balance)}</h2>
                </div>

                <div className="grid grid-cols-3 gap-4 border-t border-white/10 pt-6">
                    {([["Pemasukan", totals.income], ["Pengeluaran", totals.expense], ["Tabungan", totals.savings]] as const).map(([label, value]) => (
                        <div key={label} className="flex flex-col gap-1 min-w-0">
                            <p className="text-white/50 text-[10px] font-bold uppercase">{label}</p>
                            <p className="text-sm font-bold truncate">{formatNumber(value)}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Budget Warning */}
            {budgetAlertCount > 0 && (
                <button
                    onClick={onShowBudget}
                    className="premium-card p-4 flex items-center gap-3 text-left border-warning/40 hover:border-warning transition-colors"
                >
                    <FontAwesomeIcon icon={faTriangleExclamation} className="text-xl text-warning" />
                    <span className="flex-1 text-sm font-bold">
                        {budgetAlertCount} kategori hampir habis atau melewati budget
                    </span>
                    <span className="text-xs font-bold text-primary flex items-center gap-1">Lihat <FontAwesomeIcon icon={faArrowRight} /></span>
                </button>
            )}

            {/* Core Actions */}
            <div className="grid grid-cols-2 gap-4">
                <AddExpenseForm
                    onAdd={onAddExpense}
                    categories={categories}
                    onManageCategories={onManageCategories}
                    onOpenChange={onAddingChange}
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
                    onAdd={onAddGoal}
                    categories={goalCategories}
                    onOpenChange={onAddingChange}
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
                        Aktivitas <span className="opacity-60">({transactions.length})</span>
                    </h3>
                    <button onClick={onExport} disabled={exporting} className="text-xs font-bold text-primary hover:underline italic flex items-center gap-1.5 px-3 py-1 bg-primary/5 rounded-lg border border-primary/10 transition-colors">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                        {exporting ? "Mengunduh..." : "Unduh Excel"}
                    </button>
                </div>

                <div className="flex flex-col gap-4 relative min-h-25">
                    {loading && <LoadingOverlay size="large" />}
                    {transactions.length === 0 ? (
                        <div className="text-center py-12 opacity-40 font-medium italic premium-card">Belum ada transaksi di bulan ini</div>
                    ) : (
                        (showAll ? transactions : transactions.slice(0, ACTIVITY_PREVIEW_COUNT)).map((tx) => {
                            const isExpanded = expandedId === tx.id;
                            return (
                                <div
                                    key={tx.id}
                                    onClick={() => onExpandedChange(isExpanded ? null : tx.id)}
                                    className={`premium-card p-5 flex flex-col gap-4 hover:border-primary/20 transition-all cursor-pointer relative group ${isExpanded ? "border-primary/30 ring-2 ring-primary/5" : ""}`}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shrink-0 ${tx.type === "income" ? "bg-success/10 text-success" : "bg-primary/5 text-primary"}`}>
                                            <FontAwesomeIcon icon={iconFor(tx.category)} />
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
                                                onClick={(e) => { e.stopPropagation(); onEdit(tx); }}
                                                className="flex-1 py-2.5 rounded-xl bg-primary/5 text-primary font-bold text-xs hover:bg-primary/10 transition-colors flex items-center justify-center gap-2"
                                            >
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                                                Edit
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); onDelete(tx); }}
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
                {transactions.length > ACTIVITY_PREVIEW_COUNT && (
                    <button
                        onClick={() => onShowAllChange(!showAll)}
                        className="self-center text-xs font-bold text-primary bg-primary/5 px-4 py-2 rounded-full border border-primary/10 hover:bg-primary/10 transition-colors"
                    >
                        {showAll ? "Tampilkan lebih sedikit" : `Lihat semua (${transactions.length})`}
                    </button>
                )}
            </div>
        </div>
    );
}

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { faBuildingColumns } from "@fortawesome/free-solid-svg-icons";
import AddBudgetForm from "@/components/AddBudgetForm";
import type { BudgetStatus } from "@/lib/budget";
import { formatNumber, formatRupiah } from "@/lib/format";
import type { BudgetRowData, summarizeBudgets } from "@/lib/summary";
import type { BudgetInput, Category } from "@/lib/types";
import { CloseIcon, LoadingOverlay } from "./ui";

const STATUS_STYLES: Record<BudgetStatus, { bar: string; badge: string; label: string }> = {
    safe: { bar: "bg-success", badge: "bg-success/10 text-success-strong", label: "Aman" },
    warning: { bar: "bg-warning", badge: "bg-warning/15 text-warning-strong", label: "Hampir habis" },
    over: { bar: "bg-destructive", badge: "bg-destructive/10 text-destructive", label: "Terlampaui" },
    saving: { bar: "bg-primary", badge: "bg-primary/10 text-primary", label: "Menabung" },
    saved: { bar: "bg-success", badge: "bg-success/10 text-success-strong", label: "Tercapai" },
};

function BudgetCard({ budget: b, icon, onEdit, onDelete }: {
    budget: BudgetRowData;
    icon: IconDefinition;
    onEdit: () => void;
    onDelete: () => void;
}) {
    const style = STATUS_STYLES[b.status];
    const usage = (b.spent / b.limit) * 100;
    const remaining = b.limit - b.spent;
    return (
        <div className="premium-card group relative hover:border-primary/30 transition-all has-[button:active]:scale-[0.98]">
            <button
                type="button"
                onClick={onDelete}
                aria-label={`Hapus budget ${b.category}`}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 focus-visible:opacity-100 z-10"
            >
                <CloseIcon size={14} />
            </button>
            <button type="button" onClick={onEdit} className="w-full p-6 flex flex-col gap-4 text-left cursor-pointer rounded-[2.5rem]">
                <div className="flex items-center gap-3 pr-10 w-full">
                    <div className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center text-lg shrink-0"><FontAwesomeIcon icon={icon} /></div>
                    <div className="flex-1 flex flex-col min-w-0">
                        <span className="font-bold truncate">{b.category}</span>
                        <span className="text-[10px] font-bold text-muted-foreground uppercase">
                            {formatRupiah(b.spent)} / {formatRupiah(b.limit)}
                        </span>
                    </div>
                    <span className={`text-xs font-black px-2 py-1 rounded-full shrink-0 ${style.badge}`}>{Math.round(usage)}%</span>
                </div>
                <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden" aria-hidden="true">
                    <div className={`h-full transition-all duration-700 ${style.bar}`} style={{ width: `${Math.min(usage, 100)}%` }} />
                </div>
                <div className="flex justify-between text-[10px] font-bold uppercase w-full">
                    <span className="text-muted-foreground">{style.label}</span>
                    {b.isSavings ? (
                        <span className={remaining <= 0 ? "text-success-strong" : "text-muted-foreground"}>
                            {remaining > 0 ? `Kurang ${formatRupiah(remaining)}` : remaining === 0 ? "Sesuai rencana" : `Lebih ${formatRupiah(-remaining)}`}
                        </span>
                    ) : (
                        <span className={remaining < 0 ? "text-destructive" : "text-muted-foreground"}>
                            {remaining >= 0 ? `Sisa ${formatRupiah(remaining)}` : `Lewat ${formatRupiah(-remaining)}`}
                        </span>
                    )}
                </div>
            </button>
        </div>
    );
}

export default function BudgetTab({
    summary, isCurrentMonth, rows, unbudgeted, loading, iconFor,
    availableCategories, onAddBudget, onManageCategories, onAddingChange, onEdit, onDelete,
}: {
    summary: ReturnType<typeof summarizeBudgets>;
    isCurrentMonth: boolean;
    rows: readonly BudgetRowData[];
    unbudgeted: readonly [string, number][];
    loading: boolean;
    iconFor: (category: string) => IconDefinition;
    availableCategories: readonly Category[]; // kategori pengeluaran yang belum punya budget
    onAddBudget: (budget: BudgetInput) => void;
    onManageCategories: () => void;
    onAddingChange: (adding: boolean) => void;
    onEdit: (budget: BudgetRowData) => void;
    onDelete: (budget: BudgetRowData) => void;
}) {
    const spendingRows = rows.filter((b) => !b.isSavings);
    const savingsRows = rows.filter((b) => b.isSavings);
    const card = (b: BudgetRowData) => (
        <BudgetCard key={b.id} budget={b} icon={iconFor(b.category)} onEdit={() => onEdit(b)} onDelete={() => onDelete(b)} />
    );

    return (
        <div className="flex flex-col gap-8 animate-slide-up">
            {/* Budget Summary Card */}
            <div className="gradient-card p-8 flex flex-col gap-6 relative overflow-hidden">
                <div className="absolute top-[-20%] right-[-10%] w-40 h-40 bg-white/10 rounded-full blur-3xl" />
                <div className="flex flex-col gap-1">
                    <p className="text-white text-sm font-medium uppercase tracking-wider">
                        {summary.remaining >= 0 ? "Sisa Budget" : "Melewati Budget"}
                    </p>
                    <h2 className="text-4xl font-bold tracking-tight">{formatRupiah(Math.abs(summary.remaining))}</h2>
                </div>
                <div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-white transition-all duration-700"
                        style={{ width: `${summary.totalLimit > 0 ? Math.min((summary.totalSpent / summary.totalLimit) * 100, 100) : 0}%` }}
                    />
                </div>
                <div className="grid grid-cols-3 gap-4 border-t border-white/10 pt-6">
                    <div className="flex flex-col gap-1">
                        <p className="text-white text-[10px] font-bold uppercase">Budget</p>
                        <p className="text-sm font-bold truncate">{formatNumber(summary.totalLimit)}</p>
                    </div>
                    <div className="flex flex-col gap-1">
                        <p className="text-white text-[10px] font-bold uppercase">Terpakai</p>
                        <p className="text-sm font-bold truncate">{formatNumber(summary.totalSpent)}</p>
                    </div>
                    <div className="flex flex-col gap-1">
                        <p className="text-white text-[10px] font-bold uppercase">Per Hari</p>
                        <p className="text-sm font-bold truncate">{isCurrentMonth ? formatNumber(summary.dailyAllowance) : "–"}</p>
                    </div>
                </div>
                {isCurrentMonth && (
                    <p className="text-white text-[11px] font-medium -mt-2">
                        {summary.daysLeft} hari tersisa bulan ini
                    </p>
                )}
                {summary.savingsPlanned > 0 && (
                    <p className="text-white text-xs font-bold bg-white/10 rounded-2xl px-4 py-3 -mt-2">
                        <FontAwesomeIcon icon={faBuildingColumns} className="mr-2" />Tabungan: {formatRupiah(summary.savingsDone)} dari rencana {formatRupiah(summary.savingsPlanned)}
                    </p>
                )}
            </div>

            {/* Budget per Category */}
            <div className="flex flex-col gap-4">
                <div className="flex justify-between items-center px-1">
                    <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Per Kategori</h2>
                    {availableCategories.length === 0 ? (
                        <button
                            onClick={onManageCategories}
                            className="text-xs font-bold text-primary hover:text-primary/80 transition-colors flex items-center gap-1.5 bg-primary/5 px-3 py-1.5 rounded-full border border-primary/10"
                        >
                            <span className="text-sm">+</span> Buat Kategori
                        </button>
                    ) : (
                        <AddBudgetForm
                            onAdd={onAddBudget}
                            categories={availableCategories}
                            onOpenChange={onAddingChange}
                            trigger={
                                <button className="text-xs font-bold text-primary hover:text-primary/80 transition-colors flex items-center gap-1.5 bg-primary/5 px-3 py-1.5 rounded-full border border-primary/10">
                                    <span className="text-sm">+</span> Tambah Budget
                                </button>
                            }
                        />
                    )}
                </div>

                <div className="flex flex-col gap-4 relative min-h-25">
                    {loading && <LoadingOverlay />}
                    {rows.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground font-medium italic premium-card">Belum ada budget. Tambahkan budget per kategori.</div>
                    ) : (
                        <>
                            {spendingRows.map(card)}
                            {savingsRows.length > 0 && (
                                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest px-1 mt-2 flex items-center gap-2"><FontAwesomeIcon icon={faBuildingColumns} /> Tabungan</h3>
                            )}
                            {savingsRows.map(card)}
                        </>
                    )}
                </div>
            </div>

            {/* Spending without budget */}
            {unbudgeted.length > 0 && (
                <div className="flex flex-col gap-4">
                    <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest px-1">Tanpa Budget</h2>
                    <div className="premium-card p-2 flex flex-col">
                        {unbudgeted.map(([category, spent]) => (
                            <div key={category} className="flex items-center gap-3 p-3">
                                <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center shrink-0"><FontAwesomeIcon icon={iconFor(category)} /></div>
                                <span className="flex-1 font-bold text-sm truncate">{category}</span>
                                <span className="font-black text-sm tracking-tighter text-destructive">-{formatNumber(spent)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

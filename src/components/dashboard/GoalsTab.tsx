import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { faBullseye, faCheck } from "@fortawesome/free-solid-svg-icons";
import AddGoalForm from "@/components/AddGoalForm";
import { formatRupiah } from "@/lib/format";
import type { GoalRowData } from "@/lib/summary";
import type { Category, GoalInput } from "@/lib/types";
import { CloseIcon, LoadingOverlay } from "./ui";

export default function GoalsTab({ goals, loading, iconFor, linkableCategories, onAddGoal, onAddingChange, onEdit, onDelete }: {
    goals: readonly GoalRowData[];
    loading: boolean;
    iconFor: (category: string) => IconDefinition;
    linkableCategories: readonly Category[]; // kategori yang belum terhubung ke target lain
    onAddGoal: (goal: GoalInput) => void;
    onAddingChange: (adding: boolean) => void;
    onEdit: (goal: GoalRowData) => void;
    onDelete: (goal: GoalRowData) => void;
}) {
    return (
        <div className="flex flex-col gap-8 animate-slide-up">
            <div className="flex flex-col gap-4">
                <div className="flex justify-between items-center px-1">
                    <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Progres Tabungan</h2>
                    <AddGoalForm
                        onAdd={onAddGoal}
                        categories={linkableCategories}
                        onOpenChange={onAddingChange}
                        trigger={
                            <button className="text-xs font-bold text-primary hover:text-primary/80 transition-colors flex items-center gap-1.5 bg-primary/5 px-3 py-1.5 rounded-full border border-primary/10">
                                <span className="text-sm">+</span> Tambah Target
                            </button>
                        }
                    />
                </div>

                <div className="flex flex-col gap-4 relative min-h-25">
                    {loading && <LoadingOverlay />}
                    {goals.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground font-medium italic premium-card">Belum ada target</div>
                    ) : (
                        goals.map((goal) => (
                            <div key={goal.id} className="premium-card group relative hover:border-primary/30 transition-all has-[button:active]:scale-[0.98]">
                                <button
                                    type="button"
                                    onClick={() => onDelete(goal)}
                                    aria-label={`Hapus target ${goal.name}`}
                                    // Di layar sentuh tidak ada hover, jadi tombol selalu terlihat; di desktop muncul saat hover
                                    className="absolute top-4 right-4 w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 focus-visible:opacity-100 z-10"
                                >
                                    <CloseIcon size={14} />
                                </button>
                                <button type="button" onClick={() => onEdit(goal)} className="w-full p-6 flex flex-col gap-4 text-left cursor-pointer rounded-[2.5rem]">
                                    <div className="flex justify-between items-center w-full">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center text-lg shrink-0">
                                                <FontAwesomeIcon icon={goal.category ? iconFor(goal.category) : faBullseye} />
                                            </div>
                                            <div className="flex flex-col min-w-0">
                                                <span className="font-bold truncate max-w-37.5">{goal.name}</span>
                                                {goal.category && (
                                                    <span className="text-[10px] font-bold text-muted-foreground truncate max-w-42.5">Otomatis dari kategori {goal.category}</span>
                                                )}
                                            </div>
                                        </div>
                                        {goal.reached ? (
                                            <span className="text-xs font-black text-success-strong bg-success/10 px-2 py-1 rounded-full shrink-0 mr-8 pointer-fine:mr-0 flex items-center gap-1"><FontAwesomeIcon icon={faCheck} /> Tercapai</span>
                                        ) : (
                                            <span className="text-xs font-black text-primary bg-primary/10 px-2 py-1 rounded-full shrink-0 mr-8 pointer-fine:mr-0">{Math.round(goal.progress)}%</span>
                                        )}
                                    </div>
                                    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden" aria-hidden="true">
                                        <div className={`h-full transition-all duration-700 ${goal.reached ? "bg-success" : "bg-primary"}`} style={{ width: `${goal.progress}%` }} />
                                    </div>
                                    <div className="flex justify-between text-[10px] font-bold text-muted-foreground uppercase w-full">
                                        <span>Terkumpul: {formatRupiah(goal.saved)}</span>
                                        <span>Target: {formatRupiah(goal.targetAmount)}</span>
                                    </div>
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}

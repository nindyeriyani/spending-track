"use client";

import { useState } from "react";
import AmountInput from "@/components/AmountInput";
import { errorMessage, type GoalInput } from "@/lib/types";

type CategoryOption = { value: string; icon: string };

// `categories` hanya berisi kategori pengeluaran yang belum terhubung ke target lain
export default function AddGoalForm({ onAdd, categories, trigger, onOpenChange }: { onAdd?: (goal: GoalInput) => Promise<void> | void, categories: readonly CategoryOption[], trigger?: React.ReactNode, onOpenChange?: (open: boolean) => void }) {
    const [isOpen, setIsOpen] = useState(false);

    const toggleOpen = (open: boolean) => {
        setError(null);
        setIsOpen(open);
        if (onOpenChange) onOpenChange(open);
    };
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        name: "",
        targetAmount: "",
        currentAmount: "0",
        category: "",
    });

    const handleSubmit = async (e: React.SubmitEvent) => {
        e.preventDefault();
        const name = formData.name.trim();
        const targetAmount = Number(formData.targetAmount);
        const currentAmount = Number(formData.currentAmount) || 0;
        if (!name) return;
        if (!Number.isFinite(targetAmount) || targetAmount <= 0) {
            setError("Target harus lebih dari 0.");
            return;
        }
        if (currentAmount < 0) {
            setError("Jumlah terkumpul tidak boleh negatif.");
            return;
        }

        setError(null);
        setLoading(true);

        try {
            if (onAdd) {
                await onAdd({
                    name,
                    targetAmount,
                    currentAmount,
                    // Firestore menolak field bernilai undefined, jadi `category` hanya dikirim kalau dipilih
                    ...(formData.category ? { category: formData.category } : {}),
                });
            }
            setFormData({ name: "", targetAmount: "", currentAmount: "0", category: "" });
            toggleOpen(false);
        } catch (err) {
            console.error("Failed to add goal:", err);
            setError(errorMessage(err, "Gagal menyimpan target."));
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            {trigger ? (
                <div onClick={() => toggleOpen(true)} className="cursor-pointer contents">
                    {trigger}
                </div>
            ) : (
                <button
                    onClick={() => toggleOpen(true)}
                    className="bg-secondary hover:bg-secondary/80 text-secondary-foreground px-5 py-2.5 rounded-full font-medium transition-all active:scale-95 border border-border"
                >
                    + Target Baru
                </button>
            )}

            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-[fade-in_0.2s_ease-out]">
                    <div className="glass w-full max-w-md rounded-2xl p-6 shadow-2xl animate-[slide-up_0.3s_ease-out]">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-foreground">Tambah Target Keuangan</h2>
                            <button
                                onClick={() => toggleOpen(false)}
                                className="text-muted-foreground hover:text-foreground transition-colors w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted"
                            >
                                ✕
                            </button>
                        </div>

                        {error && (
                            <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-sm font-medium text-foreground">Nama Target</label>
                                <input
                                    type="text"
                                    autoFocus
                                    required
                                    disabled={loading}
                                    placeholder="mis. Liburan, Laptop Baru"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-4 py-3 rounded-xl bg-background border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all disabled:opacity-50"
                                />
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label className="text-sm font-medium text-foreground">Jumlah Target (Rp)</label>
                                <AmountInput
                                    required
                                    disabled={loading}
                                    placeholder="10.000.000"
                                    value={formData.targetAmount}
                                    onChange={(v) => setFormData({ ...formData, targetAmount: v })}
                                    className="w-full px-4 py-3 rounded-xl bg-background border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all disabled:opacity-50"
                                />
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label className="text-sm font-medium text-foreground">Hubungkan ke Kategori (opsional)</label>
                                <select
                                    disabled={loading}
                                    value={formData.category}
                                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                    className="w-full px-4 py-3 rounded-xl bg-background border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all disabled:opacity-50"
                                >
                                    <option value="">Tidak dihubungkan (isi manual)</option>
                                    {categories.map((c) => (
                                        <option key={c.value} value={c.value}>{c.icon} {c.value}</option>
                                    ))}
                                </select>
                                {formData.category && (
                                    <p className="text-xs text-muted-foreground">Setiap transaksi kategori {formData.category} otomatis menambah progres target ini.</p>
                                )}
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label className="text-sm font-medium text-foreground">{formData.category ? "Saldo Awal (Rp, opsional)" : "Sudah Terkumpul (Rp, opsional)"}</label>
                                <AmountInput
                                    disabled={loading}
                                    placeholder="0"
                                    value={formData.currentAmount}
                                    onChange={(v) => setFormData({ ...formData, currentAmount: v })}
                                    className="w-full px-4 py-3 rounded-xl bg-background border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all disabled:opacity-50"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className={`w-full mt-4 font-semibold py-3.5 rounded-xl transition-all active:scale-[0.98] bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-70 flex items-center justify-center gap-2`}
                            >
                                {loading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                                {loading ? "Menyimpan..." : "Simpan Target"}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}

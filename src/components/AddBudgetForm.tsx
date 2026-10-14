"use client";

import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark } from "@fortawesome/free-solid-svg-icons";
import AmountInput from "@/components/AmountInput";
import { errorMessage, type BudgetInput, type Category } from "@/lib/types";

// `categories` hanya berisi kategori yang belum punya budget
export default function AddBudgetForm({ onAdd, categories, trigger, onOpenChange }: { onAdd?: (budget: BudgetInput) => Promise<void> | void, categories: readonly Category[], trigger?: React.ReactNode, onOpenChange?: (open: boolean) => void }) {
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [formData, setFormData] = useState({ category: "", limit: "" });

    const toggleOpen = (open: boolean) => {
        setError(null);
        // Pilih kategori pertama yang tersedia setiap kali form dibuka
        if (open) setFormData({ category: categories[0]?.name ?? "", limit: "" });
        setIsOpen(open);
        if (onOpenChange) onOpenChange(open);
    };

    const handleSubmit = async (e: React.SubmitEvent) => {
        e.preventDefault();
        const limit = Number(formData.limit);
        if (!formData.category) {
            setError("Pilih kategori.");
            return;
        }
        if (!Number.isFinite(limit) || limit <= 0) {
            setError("Batas budget harus lebih dari 0.");
            return;
        }

        setError(null);
        setLoading(true);

        try {
            if (onAdd) await onAdd({ category: formData.category, limit });
            toggleOpen(false);
        } catch (err) {
            console.error("Failed to add budget:", err);
            setError(errorMessage(err, "Gagal menyimpan budget."));
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
                    + Budget Baru
                </button>
            )}

            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-[fade-in_0.2s_ease-out]">
                    <div className="glass w-full max-w-md rounded-2xl p-6 shadow-2xl animate-[slide-up_0.3s_ease-out]">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-foreground">Tambah Budget Bulanan</h2>
                            <button
                                type="button"
                                aria-label="Tutup"
                                onClick={() => toggleOpen(false)}
                                className="text-muted-foreground hover:text-foreground transition-colors w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted"
                            >
                                <FontAwesomeIcon icon={faXmark} />
                            </button>
                        </div>

                        {error && (
                            <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-sm font-medium text-foreground">Kategori</label>
                                <select
                                    required
                                    disabled={loading}
                                    value={formData.category}
                                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                    className="w-full px-4 py-3 rounded-xl bg-background border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all disabled:opacity-50"
                                >
                                    {categories.map((c) => (
                                        <option key={c.id} value={c.name}>{c.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label className="text-sm font-medium text-foreground">Batas per Bulan (Rp)</label>
                                <AmountInput
                                    required
                                    autoFocus
                                    disabled={loading}
                                    placeholder="2.000.000"
                                    value={formData.limit}
                                    onChange={(v) => setFormData({ ...formData, limit: v })}
                                    className="w-full px-4 py-3 rounded-xl bg-background border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all disabled:opacity-50"
                                />
                                <p className="text-xs text-muted-foreground">Berlaku setiap bulan sampai diubah.</p>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full mt-4 font-semibold py-3.5 rounded-xl transition-all active:scale-[0.98] bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-70 flex items-center justify-center gap-2"
                            >
                                {loading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                                {loading ? "Menyimpan..." : "Simpan Budget"}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}

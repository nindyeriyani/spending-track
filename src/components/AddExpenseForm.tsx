"use client";

import { useState } from "react";
import { todayLocal } from "@/lib/date";
import { CATEGORIES } from "@/lib/categories";
import { errorMessage, type TransactionInput } from "@/lib/types";

export default function AddExpenseForm({ onAdd, trigger, onOpenChange }: { onAdd?: (expense: TransactionInput) => Promise<void> | void, trigger?: React.ReactNode, onOpenChange?: (open: boolean) => void }) {
    const [isOpen, setIsOpen] = useState(false);

    const toggleOpen = (open: boolean) => {
        // Tanggal default selalu hari ini saat form dibuka, walau app dibiarkan terbuka lewat tengah malam
        if (open) setFormData((prev) => ({ ...prev, date: todayLocal() }));
        setError(null);
        setIsOpen(open);
        if (onOpenChange) onOpenChange(open);
    };
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [formData, setFormData] = useState<Omit<TransactionInput, "amount"> & { amount: string }>({
        type: "expense",
        amount: "",
        category: "Food",
        date: todayLocal(),
        note: "",
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const amount = Number(formData.amount);
        if (!Number.isFinite(amount) || amount <= 0) {
            setError("Jumlah harus lebih dari 0.");
            return;
        }

        setError(null);
        setLoading(true);

        try {
            if (onAdd) {
                await onAdd({
                    ...formData,
                    amount
                });
            }
            setFormData({ ...formData, amount: "", note: "" });
            toggleOpen(false);
        } catch (err) {
            console.error("Failed to add transaction:", err);
            setError(errorMessage(err, "Gagal menyimpan transaksi."));
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
                    className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-3 rounded-full font-bold transition-all shadow-xl shadow-primary/20 active:scale-95 flex items-center gap-2"
                >
                    <span className="text-xl">+</span> Add New
                </button>
            )}

            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-[fade-in_0.2s_ease-out]">
                    <div className="glass w-full max-w-md rounded-2xl p-6 shadow-2xl animate-[slide-up_0.3s_ease-out]">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-foreground">Add Transaction</h2>
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
                            <div className="flex p-1 bg-muted rounded-xl">
                                <button
                                    type="button"
                                    disabled={loading}
                                    onClick={() => setFormData({ ...formData, type: "expense" })}
                                    className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${formData.type === "expense" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                                >
                                    Expense
                                </button>
                                <button
                                    type="button"
                                    disabled={loading}
                                    onClick={() => setFormData({ ...formData, type: "income" })}
                                    className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${formData.type === "income" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                                >
                                    Income
                                </button>
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label className="text-sm font-medium text-foreground">Amount (Rp)</label>
                                <input
                                    type="number"
                                    autoFocus
                                    required
                                    min="1"
                                    disabled={loading}
                                    placeholder="50000"
                                    value={formData.amount}
                                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                    className="w-full px-4 py-3 rounded-xl bg-background border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all disabled:opacity-50"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-sm font-medium text-foreground">Category</label>
                                    <select
                                        value={formData.category}
                                        disabled={loading}
                                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                        className="w-full px-4 py-3 rounded-xl bg-background border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all appearance-none disabled:opacity-50"
                                    >
                                        {CATEGORIES.map((c) => (
                                            <option key={c.value} value={c.value}>{c.value} {c.icon}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="flex flex-col gap-1.5">
                                    <label className="text-sm font-medium text-foreground">Date</label>
                                    <input
                                        type="date"
                                        required
                                        disabled={loading}
                                        value={formData.date}
                                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                        className="w-full px-4 py-3 rounded-xl bg-background border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all disabled:opacity-50"
                                    />
                                </div>
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label className="text-sm font-medium text-foreground">Note (Optional)</label>
                                <input
                                    type="text"
                                    disabled={loading}
                                    placeholder="What was this for?"
                                    value={formData.note}
                                    onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                                    className="w-full px-4 py-3 rounded-xl bg-background border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all disabled:opacity-50"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className={`w-full mt-4 font-semibold py-3.5 rounded-xl transition-all active:scale-[0.98] disabled:opacity-70 flex items-center justify-center gap-2 ${formData.type === "expense" ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-success text-success-foreground hover:bg-success/90"}`}
                            >
                                {loading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                                {loading ? "Saving..." : "Save Transaction"}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}

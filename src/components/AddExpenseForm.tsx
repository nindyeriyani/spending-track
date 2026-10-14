"use client";

import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark } from "@fortawesome/free-solid-svg-icons";
import AmountInput from "@/components/AmountInput";
import { todayLocal } from "@/lib/date";
import { categoriesFor } from "@/lib/categories";
import { errorMessage, type Category, type TransactionInput } from "@/lib/types";

export default function AddExpenseForm({ onAdd, categories, onManageCategories, trigger, onOpenChange }: { onAdd?: (expense: TransactionInput) => Promise<void> | void, categories: readonly Category[], onManageCategories: () => void, trigger?: React.ReactNode, onOpenChange?: (open: boolean) => void }) {
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
        category: "",
        date: todayLocal(),
        note: "",
    });

    // Kategori yang dipilih bisa saja dihapus, atau belum ada saat form dibuka; pakai kategori pertama sebagai gantinya
    const options = categoriesFor(categories, formData.type);
    const category = options.some((c) => c.name === formData.category) ? formData.category : options[0]?.name ?? "";

    const handleSubmit = async (e: React.SubmitEvent) => {
        e.preventDefault();
        const amount = Number(formData.amount);
        if (!Number.isFinite(amount) || amount <= 0) {
            setError("Jumlah harus lebih dari 0.");
            return;
        }
        if (!category) {
            setError("Buat kategori dulu sebelum menyimpan transaksi.");
            return;
        }

        setError(null);
        setLoading(true);

        try {
            if (onAdd) {
                await onAdd({
                    ...formData,
                    category,
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
                    <span className="text-xl">+</span> Tambah
                </button>
            )}

            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-[fade-in_0.2s_ease-out]">
                    <div className="glass w-full max-w-md rounded-2xl p-6 shadow-2xl animate-[slide-up_0.3s_ease-out]">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-foreground">Tambah Transaksi</h2>
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
                            <div className="flex p-1 bg-muted rounded-xl">
                                <button
                                    type="button"
                                    disabled={loading}
                                    onClick={() => setFormData({ ...formData, type: "expense" })}
                                    className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${formData.type === "expense" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                                >
                                    Pengeluaran
                                </button>
                                <button
                                    type="button"
                                    disabled={loading}
                                    onClick={() => setFormData({ ...formData, type: "income" })}
                                    className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${formData.type === "income" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                                >
                                    Pemasukan
                                </button>
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label className="text-sm font-medium text-foreground">Jumlah (Rp)</label>
                                <AmountInput
                                    autoFocus
                                    required
                                    disabled={loading}
                                    placeholder="50.000"
                                    value={formData.amount}
                                    onChange={(v) => setFormData({ ...formData, amount: v })}
                                    className="w-full px-4 py-3 rounded-xl bg-background border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all disabled:opacity-50"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex flex-col gap-1.5">
                                    <div className="flex justify-between items-center">
                                        <label className="text-sm font-medium text-foreground">Kategori</label>
                                        <button type="button" onClick={onManageCategories} disabled={loading} className="text-xs font-bold text-primary hover:underline">
                                            + Baru
                                        </button>
                                    </div>
                                    {options.length === 0 ? (
                                        <button
                                            type="button"
                                            onClick={onManageCategories}
                                            disabled={loading}
                                            className="w-full px-4 py-3 rounded-xl border border-dashed border-primary/40 text-primary text-sm font-bold hover:bg-primary/5 transition-all disabled:opacity-50"
                                        >
                                            Buat kategori
                                        </button>
                                    ) : (
                                        <select
                                            value={category}
                                            disabled={loading}
                                            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                            className="w-full px-4 py-3 rounded-xl bg-background border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all appearance-none disabled:opacity-50"
                                        >
                                            {options.map((c) => (
                                                <option key={c.id} value={c.name}>{c.name}</option>
                                            ))}
                                        </select>
                                    )}
                                </div>

                                <div className="flex flex-col gap-1.5">
                                    <label className="text-sm font-medium text-foreground">Tanggal</label>
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
                                <label className="text-sm font-medium text-foreground">Catatan (opsional)</label>
                                <input
                                    type="text"
                                    disabled={loading}
                                    placeholder="Untuk apa?"
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
                                {loading ? "Menyimpan..." : "Simpan Transaksi"}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}

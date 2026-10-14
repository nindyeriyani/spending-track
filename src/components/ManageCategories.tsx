"use client";

import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark } from "@fortawesome/free-solid-svg-icons";
import { CATEGORY_ICONS, DEFAULT_CATEGORY_ICON, categoriesFor, iconByName } from "@/lib/categories";
import type { Category, CategoryInput, TransactionType } from "@/lib/types";

export default function ManageCategories({ categories, onAdd, onDelete, onClose }: {
    categories: readonly Category[],
    onAdd: (category: CategoryInput) => void,
    onDelete: (category: Category) => void,
    onClose: () => void,
}) {
    const [type, setType] = useState<TransactionType>("expense");
    const [name, setName] = useState("");
    const [icon, setIcon] = useState<string>(DEFAULT_CATEGORY_ICON);
    const [savings, setSavings] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = (e: React.SubmitEvent) => {
        e.preventDefault();
        const trimmed = name.trim();
        if (!trimmed) {
            setError("Nama kategori tidak boleh kosong.");
            return;
        }
        // Transaksi, budget, dan target merujuk kategori lewat namanya, jadi nama harus unik
        if (categories.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) {
            setError(`Kategori "${trimmed}" sudah ada.`);
            return;
        }
        onAdd({ name: trimmed, icon, type, savings: type === "expense" && savings });
        setName("");
        setIcon(DEFAULT_CATEGORY_ICON);
        setSavings(false);
        setError(null);
    };

    return (
        <div className="fixed inset-0 z-70 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm animate-[fade-in_0.2s_ease-out]">
            <div className="w-full max-w-sm max-h-[90vh] overflow-y-auto premium-card p-8 flex flex-col gap-6 animate-[slide-up_0.3s_ease-out]">
                <div className="flex justify-between items-center">
                    <h3 className="text-xl font-bold">Kategori</h3>
                    <button type="button" aria-label="Tutup" onClick={onClose} className="text-muted-foreground hover:text-foreground w-10 h-10 flex items-center justify-center rounded-full hover:bg-muted transition-colors">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <div className="flex p-1 bg-muted rounded-2xl">
                        {(["expense", "income"] as const).map((t) => (
                            <button
                                key={t}
                                type="button"
                                onClick={() => setType(t)}
                                className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${type === t ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"}`}
                            >
                                {t === "expense" ? "Pengeluaran" : "Pemasukan"}
                            </button>
                        ))}
                    </div>

                    {error && (
                        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium">
                            {error}
                        </div>
                    )}

                    <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase ml-1">Nama</label>
                        <div className="flex items-center gap-3 bg-muted rounded-2xl pl-4 focus-within:ring-2 ring-primary transition-all">
                            <FontAwesomeIcon icon={iconByName(icon)} className="text-primary shrink-0" />
                            <input
                                type="text"
                                maxLength={50}
                                placeholder={type === "expense" ? "mis. Makan" : "mis. Gaji"}
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full bg-transparent border-none py-4 pr-4 font-bold outline-none"
                            />
                        </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase ml-1">Ikon</label>
                        <div className="grid grid-cols-6 gap-1.5">
                            {CATEGORY_ICONS.map((def) => (
                                <button
                                    key={def.iconName}
                                    type="button"
                                    onClick={() => setIcon(def.iconName)}
                                    aria-label={`Pakai ikon ${def.iconName}`}
                                    aria-pressed={icon === def.iconName}
                                    className={`aspect-square rounded-xl flex items-center justify-center transition-colors ${icon === def.iconName ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:text-foreground"}`}
                                >
                                    <FontAwesomeIcon icon={def} />
                                </button>
                            ))}
                        </div>
                    </div>

                    {type === "expense" && (
                        <label className="flex items-start gap-3 text-sm cursor-pointer">
                            <input type="checkbox" checked={savings} onChange={(e) => setSavings(e.target.checked)} className="mt-1 accent-primary" />
                            <span>
                                <span className="font-bold">Tabungan</span>
                                <span className="block text-xs text-muted-foreground">Uang yang disisihkan, dihitung terpisah dari pengeluaran dan budget-nya dibaca sebagai target menabung.</span>
                            </span>
                        </label>
                    )}

                    <button
                        type="submit"
                        className="w-full py-4 bg-primary text-white font-bold rounded-2xl hover:opacity-90 transition-opacity active:scale-95"
                    >
                        Tambah Kategori
                    </button>
                </form>

                {(["expense", "income"] as const).map((t) => {
                    const list = categoriesFor(categories, t);
                    return (
                        <div key={t} className="flex flex-col gap-2">
                            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest px-1">
                                {t === "expense" ? "Pengeluaran" : "Pemasukan"} <span className="opacity-60">({list.length})</span>
                            </h4>
                            {list.length === 0 ? (
                                <p className="text-sm text-muted-foreground italic px-1">Belum ada kategori.</p>
                            ) : (
                                <div className="bg-muted/50 rounded-2xl p-1 flex flex-col">
                                    {list.map((c) => (
                                        <div key={c.id} className="flex items-center gap-3 p-2">
                                            <span className="w-9 h-9 rounded-xl bg-background text-primary flex items-center justify-center shrink-0"><FontAwesomeIcon icon={iconByName(c.icon)} /></span>
                                            <span className="flex-1 font-bold text-sm truncate">{c.name}</span>
                                            {c.savings && <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-1 rounded-full shrink-0">Tabungan</span>}
                                            <button
                                                type="button"
                                                onClick={() => onDelete(c)}
                                                aria-label={`Hapus kategori ${c.name}`}
                                                className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors shrink-0"
                                            >
                                                <FontAwesomeIcon icon={faXmark} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

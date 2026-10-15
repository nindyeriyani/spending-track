"use client";

import { useId, useState } from "react";
import Dialog from "./Dialog";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPen, faPlus, faXmark } from "@fortawesome/free-solid-svg-icons";
import { CATEGORY_ICONS, DEFAULT_CATEGORY_ICON, categoriesFor, iconByName } from "@/lib/categories";
import type { Category, CategoryInput, TransactionType } from "@/lib/types";

const CloseIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
);

export default function ManageCategories({ categories, onAdd, onUpdate, onDelete, onAddDefaults, onClose }: {
    categories: readonly Category[],
    onAdd: (category: CategoryInput) => void,
    onUpdate: (category: Category, changes: Pick<CategoryInput, "name" | "icon" | "savings">) => void,
    onDelete: (category: Category) => void,
    onAddDefaults: () => void,
    onClose: () => void,
}) {
    // Form tambah/edit tampil sebagai pop up di atas daftar kategori
    const [formOpen, setFormOpen] = useState(false);
    // Kategori yang sedang diedit; null berarti form dipakai untuk menambah
    const [editing, setEditing] = useState<Category | null>(null);
    const [type, setType] = useState<TransactionType>("expense");
    const [name, setName] = useState("");
    const [icon, setIcon] = useState<string>(DEFAULT_CATEGORY_ICON);
    const [savings, setSavings] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const ids = useId();

    const openForm = (category: Category | null, defaultType: TransactionType = "expense") => {
        setEditing(category);
        setType(category?.type ?? defaultType);
        setName(category?.name ?? "");
        setIcon(category?.icon ?? DEFAULT_CATEGORY_ICON);
        setSavings(category?.savings ?? false);
        setError(null);
        setFormOpen(true);
    };

    const closeForm = () => {
        setFormOpen(false);
        setEditing(null);
    };

    const handleSubmit = (e: React.SubmitEvent) => {
        e.preventDefault();
        const trimmed = name.trim();
        if (!trimmed) {
            setError("Nama kategori tidak boleh kosong.");
            return;
        }
        // Transaksi, budget, dan target merujuk kategori lewat namanya, jadi nama harus unik
        if (categories.some((c) => c.id !== editing?.id && c.name.toLowerCase() === trimmed.toLowerCase())) {
            setError(`Kategori "${trimmed}" sudah ada.`);
            return;
        }
        const isSavings = type === "expense" && savings;
        if (editing) onUpdate(editing, { name: trimmed, icon, savings: isSavings });
        else onAdd({ name: trimmed, icon, type, savings: isSavings });
        closeForm();
    };

    return (
        <Dialog labelledBy={`${ids}-title`} onClose={onClose} className="fixed inset-0 z-70 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm animate-[fade-in_0.2s_ease-out]">
            <div className="w-full max-w-sm max-h-[90vh] overflow-y-auto premium-card p-8 flex flex-col gap-6 animate-[slide-up_0.3s_ease-out]">
                <div className="flex justify-between items-center">
                    <h2 id={`${ids}-title`} className="text-xl font-bold">Kategori</h2>
                    <button type="button" aria-label="Tutup" onClick={onClose} className="text-muted-foreground hover:text-foreground w-10 h-10 flex items-center justify-center rounded-full hover:bg-muted transition-colors">
                        <CloseIcon />
                    </button>
                </div>

                {categories.length === 0 && (
                    <div className="bg-primary/5 rounded-2xl p-4 flex flex-col gap-3">
                        <p className="text-sm text-muted-foreground">Belum ada kategori. Mulai dengan kategori umum seperti Makan & Minum, Transportasi, dan Gaji, lalu ubah sesuai kebutuhan.</p>
                        <button
                            type="button"
                            onClick={onAddDefaults}
                            className="w-full py-3 bg-primary text-white text-sm font-bold rounded-2xl hover:opacity-90 transition-opacity active:scale-95"
                        >
                            Pakai Kategori Bawaan
                        </button>
                    </div>
                )}

                {(["expense", "income"] as const).map((t) => {
                    const list = categoriesFor(categories, t);
                    const label = t === "expense" ? "Pengeluaran" : "Pemasukan";
                    return (
                        <div key={t} className="flex flex-col gap-2">
                            <div className="flex justify-between items-center px-1">
                                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                                    {label} <span className="font-medium">({list.length})</span>
                                </h3>
                                <button
                                    type="button"
                                    onClick={() => openForm(null, t)}
                                    aria-label={`Tambah kategori ${label.toLowerCase()}`}
                                    className="text-xs font-bold text-primary flex items-center gap-1.5 px-3 py-1.5 rounded-full hover:bg-primary/10 transition-colors"
                                >
                                    <FontAwesomeIcon icon={faPlus} /> Tambah
                                </button>
                            </div>
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
                                                onClick={() => openForm(c)}
                                                aria-label={`Edit kategori ${c.name}`}
                                                className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors shrink-0"
                                            >
                                                <FontAwesomeIcon icon={faPen} className="text-xs" />
                                            </button>
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

            {formOpen && (
                <Dialog labelledBy={`${ids}-form-title`} onClose={closeForm} className="fixed inset-0 z-80 flex items-center justify-center p-6 bg-black/40 animate-[fade-in_0.2s_ease-out]">
                    <form onSubmit={handleSubmit} className="w-full max-w-sm max-h-[90vh] overflow-y-auto premium-card p-8 flex flex-col gap-4 animate-[slide-up_0.3s_ease-out]">
                        <div className="flex justify-between items-center">
                            <h2 id={`${ids}-form-title`} className="text-xl font-bold">{editing ? "Edit Kategori" : "Tambah Kategori"}</h2>
                            <button type="button" aria-label="Tutup" onClick={closeForm} className="text-muted-foreground hover:text-foreground w-10 h-10 flex items-center justify-center rounded-full hover:bg-muted transition-colors">
                                <CloseIcon />
                            </button>
                        </div>

                        {editing ? (
                            // Jenis tidak bisa diubah: budget dan target hanya untuk kategori pengeluaran
                            <p className="text-sm text-muted-foreground px-1">
                                Kategori {editing.type === "expense" ? "pengeluaran" : "pemasukan"}
                            </p>
                        ) : (
                            <div className="flex p-1 bg-muted rounded-2xl" role="group" aria-label="Jenis kategori">
                                {(["expense", "income"] as const).map((t) => (
                                    <button
                                        key={t}
                                        type="button"
                                        aria-pressed={type === t}
                                        onClick={() => setType(t)}
                                        className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${type === t ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"}`}
                                    >
                                        {t === "expense" ? "Pengeluaran" : "Pemasukan"}
                                    </button>
                                ))}
                            </div>
                        )}

                        {error && (
                            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium">
                                {error}
                            </div>
                        )}

                        <div className="flex flex-col gap-1.5">
                            <label htmlFor={`${ids}-name`} className="text-[10px] font-bold text-muted-foreground uppercase ml-1">Nama</label>
                            <div className="flex items-center gap-3 bg-muted rounded-2xl pl-4 focus-within:ring-2 ring-primary transition-all">
                                <FontAwesomeIcon icon={iconByName(icon)} className="text-primary shrink-0" />
                                <input
                                    id={`${ids}-name`}
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
                            <p id={`${ids}-icon`} className="text-[10px] font-bold text-muted-foreground uppercase ml-1">Ikon</p>
                            <div className="grid grid-cols-6 gap-1.5" role="group" aria-labelledby={`${ids}-icon`}>
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

                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={closeForm}
                                className="flex-1 py-4 bg-muted font-bold rounded-2xl hover:opacity-80 transition-opacity active:scale-95"
                            >
                                Batal
                            </button>
                            <button
                                type="submit"
                                className="flex-1 py-4 bg-primary text-white font-bold rounded-2xl hover:opacity-90 transition-opacity active:scale-95"
                            >
                                {editing ? "Simpan" : "Tambah"}
                            </button>
                        </div>
                    </form>
                </Dialog>
            )}
        </Dialog>
    );
}

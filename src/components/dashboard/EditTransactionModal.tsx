import AmountInput from "@/components/AmountInput";
import { categoriesFor } from "@/lib/categories";
import type { Category } from "@/lib/types";
import { Field, ModalForm } from "./ui";
import type { EditableTransaction } from "./types";

const inputClass = "w-full bg-muted border-none p-4 rounded-2xl font-bold focus:ring-2 ring-primary outline-none transition-all";

export default function EditTransactionModal({ value, onChange, categories, onSubmit, onClose }: {
    value: EditableTransaction;
    onChange: (value: EditableTransaction) => void;
    categories: readonly Category[];
    onSubmit: (e: React.SubmitEvent) => void;
    onClose: () => void;
}) {
    const options = categoriesFor(categories, value.type);
    return (
        <ModalForm title="Edit Transaksi" onSubmit={onSubmit} onClose={onClose} submitClassName="shadow-xl shadow-primary/20">
            <div className="flex p-1 bg-muted rounded-2xl" role="group" aria-label="Jenis transaksi">
                {(["expense", "income"] as const).map((t) => (
                    <button
                        key={t}
                        type="button"
                        aria-pressed={value.type === t}
                        onClick={() => {
                            // Kategori ikut berganti kalau tidak cocok dengan tipe yang baru
                            const next = categoriesFor(categories, t);
                            onChange({ ...value, type: t, category: next.some((c) => c.name === value.category) ? value.category : next[0]?.name ?? "" });
                        }}
                        className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${value.type === t ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"}`}
                    >
                        {t === "expense" ? "Pengeluaran" : "Pemasukan"}
                    </button>
                ))}
            </div>
            <Field label="Kategori">
                {(id) => (
                    <select id={id} value={value.category} onChange={(e) => onChange({ ...value, category: e.target.value })} className={`${inputClass} appearance-none`}>
                        {options.map((c) => (
                            <option key={c.id} value={c.name}>{c.name}</option>
                        ))}
                        {/* Kategori yang sudah dihapus tetap bisa dipertahankan */}
                        {!options.some((c) => c.name === value.category) && (
                            <option value={value.category}>{value.category || "Pilih kategori"}</option>
                        )}
                    </select>
                )}
            </Field>
            <Field label="Tanggal">
                {(id) => <input id={id} type="date" required value={value.date} onChange={(e) => onChange({ ...value, date: e.target.value })} className={inputClass} />}
            </Field>
            <Field label="Catatan">
                {(id) => <input id={id} type="text" value={value.note} onChange={(e) => onChange({ ...value, note: e.target.value })} className={inputClass} />}
            </Field>
            <Field label="Jumlah (Rp)">
                {(id) => <AmountInput id={id} value={value.amount} onChange={(v) => onChange({ ...value, amount: v })} className={inputClass} />}
            </Field>
        </ModalForm>
    );
}

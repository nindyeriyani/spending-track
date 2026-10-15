import AmountInput from "@/components/AmountInput";
import { formatRupiah } from "@/lib/format";
import type { Category } from "@/lib/types";
import { Field, ModalForm } from "./ui";
import type { EditableGoal } from "./types";

const inputClass = "w-full bg-muted border-none p-4 rounded-2xl font-bold focus:ring-2 ring-primary transition-all outline-none";

export default function EditGoalModal({ value, onChange, linkableCategories, expenseCategories, spentAllTime, onSubmit, onClose }: {
    value: EditableGoal;
    onChange: (value: EditableGoal) => void;
    linkableCategories: readonly Category[]; // kategori yang belum terhubung ke target lain
    expenseCategories: readonly Category[];
    spentAllTime: ReadonlyMap<string, number>;
    onSubmit: (e: React.SubmitEvent) => void;
    onClose: () => void;
}) {
    return (
        <ModalForm title="Edit Target" onSubmit={onSubmit} onClose={onClose}>
            <Field label="Nama Target">
                {(id) => <input id={id} type="text" value={value.name} onChange={(e) => onChange({ ...value, name: e.target.value })} className={inputClass} />}
            </Field>
            <Field label="Hubungkan ke Kategori">
                {(id) => (
                    <select id={id} value={value.category} onChange={(e) => onChange({ ...value, category: e.target.value })} className={`${inputClass} appearance-none`}>
                        <option value="">Tidak dihubungkan (isi manual)</option>
                        {linkableCategories.map((c) => (
                            <option key={c.id} value={c.name}>{c.name}</option>
                        ))}
                        {/* Kategori yang sudah dihapus tetap bisa dipertahankan */}
                        {value.category && !expenseCategories.some((c) => c.name === value.category) && (
                            <option value={value.category}>{value.category}</option>
                        )}
                    </select>
                )}
            </Field>
            <Field label={value.category ? "Saldo Awal (Rp)" : "Terkumpul (Rp)"}>
                {(id) => (
                    <>
                        <AmountInput id={id} value={value.currentAmount} onChange={(v) => onChange({ ...value, currentAmount: v })} className={inputClass} />
                        {value.category && (
                            <p className="text-[11px] text-muted-foreground ml-1">
                                Ditambah {formatRupiah(spentAllTime.get(value.category) ?? 0)} dari transaksi {value.category}. Kurangi saldo awal kalau Anda menarik dana dari tabungan ini.
                            </p>
                        )}
                    </>
                )}
            </Field>
            <Field label="Target Total (Rp)">
                {(id) => <AmountInput id={id} value={value.targetAmount} onChange={(v) => onChange({ ...value, targetAmount: v })} className={inputClass} />}
            </Field>
        </ModalForm>
    );
}

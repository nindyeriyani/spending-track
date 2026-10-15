import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import AmountInput from "@/components/AmountInput";
import { Field, ModalForm } from "./ui";
import type { EditableBudget } from "./types";

export default function EditBudgetModal({ value, onChange, icon, onSubmit, onClose }: {
    value: EditableBudget;
    onChange: (value: EditableBudget) => void;
    icon: IconDefinition;
    onSubmit: (e: React.SubmitEvent) => void;
    onClose: () => void;
}) {
    return (
        <ModalForm title="Edit Budget" onSubmit={onSubmit} onClose={onClose}>
            <div className="flex items-center gap-3 p-4 bg-muted rounded-2xl">
                <span className="text-xl"><FontAwesomeIcon icon={icon} /></span>
                <span className="font-bold">{value.category}</span>
            </div>
            <Field label="Batas per Bulan (Rp)">
                {(id) => (
                    <>
                        <AmountInput
                            id={id}
                            autoFocus
                            value={value.limit}
                            onChange={(v) => onChange({ ...value, limit: v })}
                            className="w-full bg-muted border-none p-4 rounded-2xl font-bold focus:ring-2 ring-primary transition-all outline-none"
                        />
                        <p className="text-[11px] text-muted-foreground ml-1">Perubahan berlaku untuk bulan ini dan bulan-bulan berikutnya.</p>
                    </>
                )}
            </Field>
        </ModalForm>
    );
}

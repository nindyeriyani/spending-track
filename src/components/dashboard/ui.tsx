import { useId, type ReactNode } from "react";
import Dialog from "@/components/Dialog";

export function CloseIcon({ size = 20 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
    );
}

export function LoadingOverlay({ size = "small" }: { size?: "small" | "large" }) {
    return (
        <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-10">
            <div className={size === "large" ? "w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" : "w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"} />
        </div>
    );
}

// Form edit yang tampil sebagai pop up di tengah layar
export function ModalForm({ title, onSubmit, onClose, submitClassName = "", children }: {
    title: string;
    onSubmit: (e: React.SubmitEvent) => void;
    onClose: () => void;
    submitClassName?: string;
    children: ReactNode;
}) {
    const titleId = useId();
    return (
        <Dialog labelledBy={titleId} onClose={onClose} className="fixed inset-0 z-60 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm animate-[fade-in_0.2s_ease-out]">
            <form onSubmit={onSubmit} className="w-full max-w-sm premium-card p-8 flex flex-col gap-6 animate-[slide-up_0.3s_ease-out]">
                <div className="flex justify-between items-center">
                    <h2 id={titleId} className="text-xl font-bold">{title}</h2>
                    <button type="button" aria-label="Tutup" onClick={onClose} className="text-muted-foreground hover:text-foreground w-10 h-10 flex items-center justify-center rounded-full hover:bg-muted transition-colors">
                        <CloseIcon />
                    </button>
                </div>
                <div className="flex flex-col gap-4">{children}</div>
                <button
                    type="submit"
                    className={`w-full py-4 bg-primary text-white font-bold rounded-2xl hover:opacity-90 transition-opacity active:scale-95 ${submitClassName}`}
                >
                    Simpan Perubahan
                </button>
            </form>
        </Dialog>
    );
}

// Label yang terhubung ke inputnya (dibaca pembaca layar dan bisa diketuk untuk fokus ke input)
export function Field({ label, children }: { label: ReactNode; children: (id: string) => ReactNode }) {
    const id = useId();
    return (
        <div className="flex flex-col gap-1.5">
            <label htmlFor={id} className="text-[10px] font-bold text-muted-foreground uppercase ml-1">{label}</label>
            {children(id)}
        </div>
    );
}

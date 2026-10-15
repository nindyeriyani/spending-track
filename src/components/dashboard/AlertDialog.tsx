import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck, faCircleQuestion, faXmark } from "@fortawesome/free-solid-svg-icons";
import { useId } from "react";
import Dialog from "@/components/Dialog";
import type { AlertState } from "@/hooks/useAlert";

// Esc menutup alert; untuk konfirmasi, Esc sama dengan Batal
export default function AlertDialog({ alert, onClose }: { alert: AlertState; onClose: () => void }) {
    const messageId = useId();
    return (
        <Dialog labelledBy={messageId} onClose={onClose} className="fixed inset-0 z-100 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm animate-[fade-in_0.2s_ease-out]">
            <div className="w-full max-w-xs premium-card p-8 flex flex-col items-center text-center gap-6 animate-[slide-up_0.3s_ease-out]">
                <div aria-hidden="true" className={`w-16 h-16 rounded-full flex items-center justify-center text-3xl ${alert.type === "success" ? "bg-success/20 text-success-strong" : alert.type === "error" ? "bg-destructive/20 text-destructive" : "bg-primary/20 text-primary"}`}>
                    <FontAwesomeIcon icon={alert.type === "success" ? faCheck : alert.type === "error" ? faXmark : faCircleQuestion} />
                </div>
                <p id={messageId} role={alert.type === "confirm" ? undefined : "status"} className="font-bold text-lg leading-snug">{alert.message}</p>
                <div className="flex gap-3 w-full">
                    {alert.type === "confirm" ? (
                        <>
                            <button onClick={onClose} className="flex-1 py-3.5 px-4 rounded-2xl bg-muted font-bold text-xs uppercase tracking-widest hover:bg-muted/80 transition-colors">Batal</button>
                            <button onClick={alert.onConfirm} className="flex-1 py-3.5 px-4 rounded-2xl bg-destructive text-white font-bold text-xs uppercase tracking-widest hover:opacity-90 transition-opacity shadow-lg shadow-destructive/20">{alert.confirmText || "Hapus"}</button>
                        </>
                    ) : (
                        <button onClick={onClose} className="flex-1 py-4 px-4 rounded-2xl bg-primary text-white font-bold text-sm hover:opacity-90 transition-opacity shadow-lg shadow-primary/20">Oke</button>
                    )}
                </div>
            </div>
        </Dialog>
    );
}

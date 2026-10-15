"use client";

import { useId, useState } from "react";
import Dialog from "./Dialog";
import Link from "next/link";
import type { User } from "firebase/auth";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowRightFromBracket, faShieldHalved, faTrashCan } from "@fortawesome/free-solid-svg-icons";
import { deleteAccount, reauthenticate, signsInWithPassword } from "@/lib/account";
import { errorCode } from "@/lib/types";

// Kata yang harus diketik supaya akun tidak terhapus karena salah tekan
const CONFIRM_WORD = "HAPUS";

const DELETE_ERROR_MESSAGES: Record<string, string> = {
    "auth/invalid-credential": "Password salah.",
    "auth/wrong-password": "Password salah.",
    "auth/too-many-requests": "Terlalu banyak percobaan. Coba lagi beberapa saat lagi.",
    "auth/network-request-failed": "Koneksi bermasalah. Periksa internet Anda.",
    "auth/user-mismatch": "Login ulang harus memakai akun Google yang sama.",
    "auth/popup-blocked": "Popup login diblokir browser. Izinkan popup lalu coba lagi.",
};

export default function AccountMenu({ user, onLogout, onClose }: {
    user: User,
    onLogout: () => void,
    onClose: () => void,
}) {
    const [confirmingDelete, setConfirmingDelete] = useState(false);
    const [confirmText, setConfirmText] = useState("");
    const [password, setPassword] = useState("");
    const [deleting, setDeleting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const needsPassword = signsInWithPassword(user);
    const titleId = useId();

    const handleDelete = async (e: React.SubmitEvent) => {
        e.preventDefault();
        if (confirmText.trim().toUpperCase() !== CONFIRM_WORD) {
            setError(`Ketik ${CONFIRM_WORD} untuk melanjutkan.`);
            return;
        }
        if (needsPassword && !password) {
            setError("Masukkan password Anda.");
            return;
        }
        if (!navigator.onLine) {
            setError("Hapus akun membutuhkan koneksi internet.");
            return;
        }
        setError(null);
        setDeleting(true);
        try {
            await reauthenticate(user, password);
            await deleteAccount(user);
            // Cache Firestore sudah ditutup, jadi muat ulang app dari awal
            window.location.replace("/");
        } catch (err) {
            console.error("Delete account failed:", err);
            const code = errorCode(err);
            if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
                setDeleting(false);
                return;
            }
            setError((code && DELETE_ERROR_MESSAGES[code]) || "Gagal menghapus akun. Silakan coba lagi.");
            setDeleting(false);
        }
    };

    return (
        // Selama proses hapus berjalan, pop up tidak bisa ditutup (termasuk dengan Esc)
        <Dialog labelledBy={titleId} onClose={deleting ? undefined : onClose} className="fixed inset-0 z-70 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm animate-[fade-in_0.2s_ease-out]">
            <div className="w-full max-w-sm max-h-[90vh] overflow-y-auto premium-card p-8 flex flex-col gap-6 animate-[slide-up_0.3s_ease-out]">
                <div className="flex justify-between items-center gap-3">
                    <div className="min-w-0">
                        <h2 id={titleId} className="text-xl font-bold">{confirmingDelete ? "Hapus Akun" : "Akun"}</h2>
                        <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                    </div>
                    <button type="button" aria-label="Tutup" onClick={onClose} disabled={deleting} className="text-muted-foreground hover:text-foreground w-10 h-10 flex items-center justify-center rounded-full hover:bg-muted transition-colors shrink-0 disabled:opacity-50">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>

                {!confirmingDelete ? (
                    <div className="flex flex-col gap-2">
                        <button
                            type="button"
                            onClick={onLogout}
                            className="flex items-center gap-3 p-4 rounded-2xl bg-muted font-bold text-sm hover:opacity-80 transition-opacity"
                        >
                            <FontAwesomeIcon icon={faArrowRightFromBracket} className="text-primary w-4" /> Keluar
                        </button>
                        <Link
                            href="/privacy"
                            className="flex items-center gap-3 p-4 rounded-2xl bg-muted font-bold text-sm hover:opacity-80 transition-opacity"
                        >
                            <FontAwesomeIcon icon={faShieldHalved} className="text-primary w-4" /> Kebijakan Privasi
                        </Link>
                        <button
                            type="button"
                            onClick={() => setConfirmingDelete(true)}
                            className="flex items-center gap-3 p-4 rounded-2xl font-bold text-sm text-destructive hover:bg-destructive/10 transition-colors"
                        >
                            <FontAwesomeIcon icon={faTrashCan} className="w-4" /> Hapus Akun
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleDelete} className="flex flex-col gap-4">
                        <div className="p-4 rounded-2xl bg-destructive/10 text-sm flex flex-col gap-2">
                            <p className="font-bold text-destructive">Tindakan ini permanen dan tidak bisa dibatalkan.</p>
                            <p>Akun beserta semua transaksi, budget, target, dan kategori akan dihapus. Kalau ingin menyimpan catatan, unduh dulu laporan Excel tiap bulan.</p>
                        </div>

                        {error && (
                            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium">
                                {error}
                            </div>
                        )}

                        <div className="flex flex-col gap-1.5">
                            <label htmlFor="delete-confirm" className="text-[10px] font-bold text-muted-foreground uppercase ml-1">Ketik {CONFIRM_WORD} untuk konfirmasi</label>
                            <input
                                id="delete-confirm"
                                type="text"
                                autoComplete="off"
                                autoCapitalize="characters"
                                value={confirmText}
                                onChange={(e) => setConfirmText(e.target.value)}
                                disabled={deleting}
                                className="w-full bg-muted rounded-2xl p-4 font-bold outline-none focus:ring-2 ring-destructive transition-all"
                            />
                        </div>

                        {needsPassword ? (
                            <div className="flex flex-col gap-1.5">
                                <label htmlFor="delete-password" className="text-[10px] font-bold text-muted-foreground uppercase ml-1">Password</label>
                                <input
                                    id="delete-password"
                                    type="password"
                                    autoComplete="current-password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    disabled={deleting}
                                    className="w-full bg-muted rounded-2xl p-4 font-bold outline-none focus:ring-2 ring-destructive transition-all"
                                />
                            </div>
                        ) : (
                            <p className="text-xs text-muted-foreground px-1">Anda akan diminta login ulang dengan Google untuk memastikan ini memang Anda.</p>
                        )}

                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => { setConfirmingDelete(false); setConfirmText(""); setPassword(""); setError(null); }}
                                disabled={deleting}
                                className="flex-1 py-4 bg-muted font-bold rounded-2xl hover:opacity-80 transition-opacity active:scale-95 disabled:opacity-50"
                            >
                                Batal
                            </button>
                            <button
                                type="submit"
                                disabled={deleting}
                                className="flex-1 py-4 bg-destructive text-white font-bold rounded-2xl hover:opacity-90 transition-opacity active:scale-95 disabled:opacity-60"
                            >
                                {deleting ? "Menghapus..." : "Hapus Permanen"}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </Dialog>
    );
}

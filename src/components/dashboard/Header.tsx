"use client";

import { useState } from "react";
import type { User } from "firebase/auth";

export default function Header({ title, monthLabel, isCurrentMonth, onShiftMonth, onCurrentMonth, onManageCategories, onOpenAccount, user }: {
    title: string;
    monthLabel: string;
    isCurrentMonth: boolean;
    onShiftMonth: (delta: number) => void;
    onCurrentMonth: () => void;
    onManageCategories: () => void;
    onOpenAccount: () => void;
    user: User;
}) {
    // URL foto profil yang gagal dimuat; avatar lalu memakai huruf pertama email
    const [brokenPhotoURL, setBrokenPhotoURL] = useState<string | null>(null);

    return (
        <header className="flex justify-between items-center">
            <div className="flex flex-col">
                <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
                <div className="flex items-center gap-1 -ml-1.5">
                    <button
                        onClick={() => onShiftMonth(-1)}
                        aria-label="Bulan sebelumnya"
                        className="w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
                    </button>
                    <p className="text-muted-foreground text-sm font-medium min-w-30 text-center">{monthLabel}</p>
                    <button
                        onClick={() => onShiftMonth(1)}
                        disabled={isCurrentMonth}
                        aria-label="Bulan berikutnya"
                        className="w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-30 disabled:pointer-events-none"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                    </button>
                    {!isCurrentMonth && (
                        <button
                            onClick={onCurrentMonth}
                            className="ml-1 text-[10px] font-bold text-primary bg-primary/5 px-2 py-1 rounded-full border border-primary/10"
                        >
                            Bulan ini
                        </button>
                    )}
                </div>
            </div>
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={onManageCategories}
                    aria-label="Kelola kategori"
                    title="Kategori"
                    className="w-10 h-10 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" /></svg>
                </button>
                <button
                    type="button"
                    onClick={onOpenAccount}
                    aria-label={`Akun ${user.email ?? ""}`}
                    title="Akun"
                    className="relative w-10 h-10 rounded-full border-2 border-primary/20 p-0.5 ring-2 ring-primary/5 hover:ring-primary/40 transition-all active:scale-95"
                >
                    {user.photoURL && user.photoURL !== brokenPhotoURL ? (
                        // Foto profil Google dari domain eksternal; next/image butuh remotePatterns dan tidak sepadan untuk avatar 40px.
                        // Google sering menolak (403/429) permintaan yang membawa referrer, jadi referrer tidak dikirim.
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={user.photoURL}
                            referrerPolicy="no-referrer"
                            onError={() => setBrokenPhotoURL(user.photoURL)}
                            className="w-full h-full object-cover rounded-full"
                            alt=""
                        />
                    ) : (
                        <span className="w-full h-full rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs uppercase">
                            {(user.email || user.displayName || "?")[0]}
                        </span>
                    )}
                </button>
            </div>
        </header>
    );
}

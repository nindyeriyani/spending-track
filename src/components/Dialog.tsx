"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Pop up yang sedang terbuka, urut dari yang paling bawah. Hanya yang paling atas menanggapi keyboard,
// jadi Esc pada form di atas daftar kategori hanya menutup form-nya.
const openDialogs: symbol[] = [];

// Lapisan pop up: Esc menutup, Tab berputar di dalam pop up, fokus kembali ke tombol pembuka saat ditutup.
// `onClose` boleh diabaikan sementara (mis. saat proses hapus berjalan) dengan mengirim `undefined`.
export default function Dialog({ labelledBy, onClose, className, children }: {
    labelledBy: string; // id judul pop up
    onClose?: () => void;
    className: string; // kelas lapisan latar (posisi, z-index, warna)
    children: ReactNode;
}) {
    const ref = useRef<HTMLDivElement>(null);
    // Dicatat saat render pertama, sebelum input ber-autoFocus di dalam pop up mengambil fokus
    const [opener] = useState(() => (document.activeElement instanceof HTMLElement ? document.activeElement : null));
    const onCloseRef = useRef(onClose);
    useEffect(() => {
        onCloseRef.current = onClose;
    });

    useEffect(() => {
        const id = Symbol();
        openDialogs.push(id);
        const node = ref.current;

        // Fokus ke pop up itu sendiri, bukan ke input pertama, supaya keyboard HP tidak langsung muncul.
        // Elemen dengan autoFocus sudah memegang fokus lebih dulu dan dibiarkan.
        if (node && !node.contains(document.activeElement)) node.focus();

        const onKeyDown = (e: KeyboardEvent) => {
            if (openDialogs[openDialogs.length - 1] !== id || !node) return;
            if (e.key === "Escape") {
                e.preventDefault();
                onCloseRef.current?.();
            } else if (e.key === "Tab") {
                const items = [...node.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
                if (items.length === 0) {
                    e.preventDefault();
                    return;
                }
                const first = items[0];
                const last = items[items.length - 1];
                const active = document.activeElement;
                if (e.shiftKey && (active === first || active === node)) {
                    e.preventDefault();
                    last.focus();
                } else if (!e.shiftKey && (active === last || !node.contains(active))) {
                    e.preventDefault();
                    first.focus();
                }
            }
        };
        document.addEventListener("keydown", onKeyDown);

        return () => {
            document.removeEventListener("keydown", onKeyDown);
            openDialogs.splice(openDialogs.indexOf(id), 1);
            // Kembalikan fokus ke tombol pembuka kalau masih ada di halaman
            if (opener?.isConnected) opener.focus();
        };
    }, [opener]);

    return (
        <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={labelledBy} tabIndex={-1} className={`${className} outline-none`}>
            {children}
        </div>
    );
}

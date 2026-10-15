"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface AlertState {
    message: string;
    type: "success" | "error" | "confirm";
    confirmText?: string;
    onConfirm?: () => void;
}

// Alert sukses/gagal yang menutup sendiri setelah 3 detik, dan dialog konfirmasi
export function useAlert() {
    const [alert, setAlert] = useState<AlertState | null>(null);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const clearTimer = () => {
        if (timer.current) clearTimeout(timer.current);
        timer.current = null;
    };

    // Timer lama selalu dibatalkan supaya tidak menutup alert/konfirmasi yang muncul sesudahnya
    const showAlert = useCallback((message: string, type: "success" | "error" = "success") => {
        clearTimer();
        setAlert({ message, type });
        timer.current = setTimeout(() => setAlert(null), 3000);
    }, []);

    const showConfirm = useCallback((message: string, onConfirm: () => void, confirmText?: string) => {
        clearTimer();
        setAlert({ message, type: "confirm", confirmText, onConfirm });
    }, []);

    const closeAlert = useCallback(() => {
        clearTimer();
        setAlert(null);
    }, []);

    useEffect(() => clearTimer, []);

    return { alert, showAlert, showConfirm, closeAlert };
}

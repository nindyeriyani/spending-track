"use client";

import { useEffect, useState } from "react";

// Tanggal hari ini, diperbarui saat app dibuka lagi supaya app yang dibiarkan terbuka lewat tengah malam tetap benar
export function useToday(): Date {
    const [today, setToday] = useState(() => new Date());
    useEffect(() => {
        const refreshToday = () =>
            setToday((prev) => (prev.toDateString() === new Date().toDateString() ? prev : new Date()));
        document.addEventListener("visibilitychange", refreshToday);
        window.addEventListener("focus", refreshToday);
        return () => {
            document.removeEventListener("visibilitychange", refreshToday);
            window.removeEventListener("focus", refreshToday);
        };
    }, []);
    return today;
}

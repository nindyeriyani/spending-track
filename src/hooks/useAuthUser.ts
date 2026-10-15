"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";

// `loading` true sampai Firebase selesai memulihkan sesi login yang tersimpan
export function useAuthUser(): { user: User | null; loading: boolean } {
    const [state, setState] = useState<{ user: User | null; loading: boolean }>({ user: null, loading: true });
    useEffect(() => onAuthStateChanged(auth, (user) => setState({ user, loading: false })), []);
    return state;
}

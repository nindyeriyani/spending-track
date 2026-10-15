"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { collection, doc, getDocs, onSnapshot, orderBy, query, updateDoc, where, type QuerySnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { spentByCategory } from "@/lib/budget";
import { categoryIdFor, missingCategoryIds, withCurrentCategoryNames } from "@/lib/categories";
import type { Budget, BudgetInput, Category, CategoryInput, Goal, GoalInput, Transaction, TransactionInput } from "@/lib/types";

type OnError = (message: string, type: "error") => void;

function snapshotTransactions(snapshot: QuerySnapshot): Transaction[] {
    return snapshot.docs.map((d) => ({ id: d.id, ...(d.data({ serverTimestamps: "estimate" }) as TransactionInput) }));
}

// Urutkan dari yang paling terakhir diinput; transaksi lama tanpa `createdAt` ditaruh di bawah, urut tanggal
function sortByInputTime(txs: Transaction[]): Transaction[] {
    return txs.sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0) || b.date.localeCompare(a.date));
}

// Kategori, urut sesuai waktu dibuat. `synced` true setelah dikonfirmasi server (bukan hanya dari cache perangkat).
function useCategories(uid: string, onError: OnError) {
    const [state, setState] = useState<{ categories: Category[]; synced: boolean }>({ categories: [], synced: false });
    useEffect(() => {
        return onSnapshot(collection(db, "users", uid, "categories"), { includeMetadataChanges: true }, (snapshot) => {
            const categories = snapshot.docs
                .map((d) => ({ id: d.id, ...(d.data({ serverTimestamps: "estimate" }) as CategoryInput) }))
                // Kategori bawaan dibuat bersamaan (waktunya sama), jadi diurutkan lagi menurut ID-nya
                .sort((a, b) => (a.createdAt?.toMillis() ?? 0) - (b.createdAt?.toMillis() ?? 0) || a.id.localeCompare(b.id));
            setState((prev) => ({ categories, synced: prev.synced || !snapshot.metadata.fromCache }));
        }, (err) => {
            console.error("Failed to load categories:", err);
            onError("Gagal memuat kategori.", "error");
        });
    }, [uid, onError]);
    return state;
}

// Seluruh isi koleksi kecil (target, budget)
function useCollection<T>(uid: string, name: "goals" | "budgets", onError: OnError, failMessage: string) {
    const [state, setState] = useState<{ items: (T & { id: string })[]; loading: boolean }>({ items: [], loading: true });
    useEffect(() => {
        return onSnapshot(collection(db, "users", uid, name), (snapshot) => {
            setState({ items: snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as T) })), loading: false });
        }, (err) => {
            console.error(`Failed to load ${name}:`, err);
            setState((prev) => ({ ...prev, loading: false }));
            onError(failMessage, "error");
        });
    }, [uid, name, onError, failMessage]);
    return state;
}

// Transaksi tidak dimuat semuanya, hanya bulan-bulan yang diminta (per monthKey "YYYY-MM")
function useMonthTransactions(uid: string, months: readonly string[], onError: OnError) {
    const [byMonth, setByMonth] = useState<Record<string, Transaction[]>>({});
    useEffect(() => {
        const unsubscribes = months.map((key) => {
            // `date` berformat "YYYY-MM-DD", jadi satu bulan = rentang string "YYYY-MM-01" sampai "YYYY-MM-31"
            const q = query(
                collection(db, "users", uid, "transactions"),
                where("date", ">=", `${key}-01`),
                where("date", "<=", `${key}-31`),
                orderBy("date", "desc"),
            );
            return onSnapshot(q, (snapshot) => {
                setByMonth((prev) => ({ ...prev, [key]: sortByInputTime(snapshotTransactions(snapshot)) }));
            }, (err) => {
                console.error("Failed to load transactions:", err);
                setByMonth((prev) => ({ ...prev, [key]: prev[key] ?? [] }));
                onError("Gagal memuat transaksi.", "error");
            });
        });
        return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
    }, [uid, months, onError]);
    return byMonth;
}

// Progres target yang terhubung ke kategori dihitung dari semua transaksi kategori itu (sepanjang waktu),
// jadi transaksinya dimuat terpisah dari daftar bulanan. Hasilnya total per nama kategori terkini.
function useGoalSpending(uid: string, goalCategories: readonly string[], categories: readonly Category[], onError: OnError) {
    // Kunci "id:<categoryId>", atau "name:<nama>" untuk kategori yang sudah dihapus (tidak punya ID lagi)
    const links = useMemo(
        () => [...new Set(goalCategories)].map((name) => {
            const categoryId = categoryIdFor(categories, name, "expense");
            return categoryId ? `id:${categoryId}` : `name:${name}`;
        }),
        [goalCategories, categories],
    );
    // String supaya listener hanya dipasang ulang saat daftar kategorinya benar-benar berubah
    const linksKey = JSON.stringify(links);
    const [byLink, setByLink] = useState<Record<string, Transaction[]>>({});

    useEffect(() => {
        const unsubscribes = (JSON.parse(linksKey) as string[]).map((key) => {
            const [field, value] = key.startsWith("id:") ? ["categoryId", key.slice(3)] : ["category", key.slice(5)];
            const q = query(collection(db, "users", uid, "transactions"), where(field, "==", value), where("type", "==", "expense"));
            return onSnapshot(q, (snapshot) => {
                setByLink((prev) => ({ ...prev, [key]: snapshotTransactions(snapshot) }));
            }, (err) => {
                console.error("Failed to load goal transactions:", err);
                onError("Gagal memuat progres target.", "error");
            });
        });
        return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
    }, [uid, linksKey, onError]);

    return useMemo(() => {
        const byId = new Map<string, Transaction>();
        links.forEach((key) => byLink[key]?.forEach((tx) => byId.set(tx.id, tx)));
        return spentByCategory(withCurrentCategoryNames([...byId.values()], categories));
    }, [links, byLink, categories]);
}

// Dokumen lama hanya menyimpan nama kategori; lengkapi `categoryId`-nya dengan mencocokkan nama kategori yang ada
function useCategoryIdMigration(uid: string, categories: readonly Category[], categoriesSynced: boolean, stored: {
    transactions: readonly Transaction[]; budgets: readonly Budget[]; goals: readonly Goal[];
}) {
    // Dokumen yang sudah termuat. Ditulis per dokumen supaya satu dokumen lama yang ditolak rules tidak
    // menggagalkan yang lain, dan tiap dokumen dicoba sekali per sesi supaya tulisan yang ditolak tidak diulang terus.
    const migratedDocs = useRef(new Set<string>());
    const { transactions, budgets, goals } = stored;
    useEffect(() => {
        const expenseOnly = categories.filter((c) => c.type === "expense");
        const updates = [
            ...missingCategoryIds(transactions, categories, (tx) => tx.type).map(([tx, id]) => ["transactions", tx.id, id]),
            ...missingCategoryIds(budgets, expenseOnly, () => "expense").map(([b, id]) => ["budgets", b.id, id]),
            ...missingCategoryIds(goals, expenseOnly, () => "expense").map(([g, id]) => ["goals", g.id, id]),
        ];
        for (const [path, docId, categoryId] of updates) {
            const ref = doc(db, "users", uid, path, docId);
            if (migratedDocs.current.has(ref.path)) continue;
            migratedDocs.current.add(ref.path);
            updateDoc(ref, { categoryId }).catch((err) => console.error(`Gagal melengkapi categoryId ${ref.path}:`, err));
        }
    }, [uid, categories, transactions, budgets, goals]);

    // Transaksi di bulan yang tidak dibuka tidak ikut termuat, jadi sekali per perangkat semua transaksi
    // dibaca untuk dilengkapi. Menunggu kategori dari server supaya pencocokan nama tidak memakai cache
    // yang kosong atau usang.
    const fullMigrationStarted = useRef(false);
    useEffect(() => {
        if (!categoriesSynced || fullMigrationStarted.current) return;
        const flagKey = `categoryId-migrated:${uid}`;
        try {
            if (localStorage.getItem(flagKey)) return;
        } catch {
            // Storage tidak tersedia (mis. mode privat): tetap jalankan, paling banyak sekali per sesi
        }
        fullMigrationStarted.current = true;
        getDocs(collection(db, "users", uid, "transactions"))
            .then((snapshot) => Promise.allSettled(
                missingCategoryIds(snapshotTransactions(snapshot), categories, (tx) => tx.type)
                    .map(([tx, categoryId]) => updateDoc(doc(db, "users", uid, "transactions", tx.id), { categoryId })),
            ))
            .then((results) => {
                results.forEach((r) => { if (r.status === "rejected") console.error("Gagal melengkapi categoryId:", r.reason); });
                try { localStorage.setItem(flagKey, "1"); } catch { /* lihat di atas */ }
            })
            .catch((err) => {
                console.error("Gagal membaca transaksi untuk migrasi categoryId:", err);
                fullMigrationStarted.current = false;
            });
    }, [uid, categoriesSynced, categories]);
}

// Semua data milik user yang dipakai dashboard, dengan nama kategori yang sudah diperbarui ke nama terkini.
// `months`: bulan yang transaksinya dimuat. `extraGoalCategory`: kategori yang sedang dipilih di form edit
// target, supaya progresnya ikut dimuat sebelum disimpan.
export function useUserData(uid: string, { months, extraGoalCategory, onError }: {
    months: readonly string[];
    extraGoalCategory?: string;
    onError: OnError;
}) {
    const { categories, synced: categoriesSynced } = useCategories(uid, onError);
    const goalsState = useCollection<GoalInput>(uid, "goals", onError, "Gagal memuat target.");
    const budgetsState = useCollection<BudgetInput>(uid, "budgets", onError, "Gagal memuat budget.");
    const byMonth = useMonthTransactions(uid, months, onError);

    // Bulan lain yang pernah dibuka bisa masih tersimpan di state, tapi listener-nya sudah berhenti, jadi diabaikan
    const storedTransactions = useMemo(() => months.flatMap((key) => byMonth[key] ?? []), [months, byMonth]);
    useCategoryIdMigration(uid, categories, categoriesSynced, {
        transactions: storedTransactions, budgets: budgetsState.items, goals: goalsState.items,
    });

    const transactions = useMemo(() => withCurrentCategoryNames(storedTransactions, categories), [storedTransactions, categories]);
    const goals = useMemo(() => withCurrentCategoryNames(goalsState.items, categories), [goalsState.items, categories]);
    const budgets = useMemo(() => withCurrentCategoryNames(budgetsState.items, categories), [budgetsState.items, categories]);

    const goalCategories = useMemo(() => {
        const names = goals.map((g) => g.category).filter((name): name is string => !!name);
        return extraGoalCategory ? [...names, extraGoalCategory] : names;
    }, [goals, extraGoalCategory]);
    const spentAllTime = useGoalSpending(uid, goalCategories, categories, onError);

    return {
        categories,
        transactions,
        goals,
        budgets,
        spentAllTime,
        // Bulan yang transaksinya sudah termuat setidaknya sekali (untuk indikator loading)
        isMonthLoaded: (key: string) => key in byMonth,
        goalsLoading: goalsState.loading,
        budgetsLoading: budgetsState.loading,
    };
}

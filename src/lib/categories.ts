import type { TransactionType } from "./types";

// Satu-satunya sumber daftar kategori, dipakai form tambah, form edit, daftar transaksi, dan budget.
// `key` dipakai sebagai ID dokumen budget (nama kategori bisa berisi "/" yang tidak boleh ada di ID Firestore).
// Kalau daftar pengeluaran diubah, samakan juga peta kategori di firestore.rules (isValidBudget).
export const EXPENSE_CATEGORIES = [
    { key: "tabungan-haji", value: "Tabungan Haji", icon: "🕋" },
    { key: "orang-tua", value: "Orang Tua", icon: "👨‍👩‍👧" },
    { key: "dana-darurat", value: "Dana Darurat", icon: "🛟" },
    { key: "makan-jajan", value: "Makan/Jajan", icon: "🍔" },
    { key: "transportasi", value: "Transportasi", icon: "🛵" },
    { key: "servis-motor", value: "Servis Motor", icon: "🔧" },
    { key: "skincare-perawatan", value: "Skincare & Perawatan", icon: "🧴" },
    { key: "tabungan-pakaian", value: "Tabungan Pakaian", icon: "👕" },
    { key: "kuota-langganan", value: "Kuota & Langganan", icon: "📱" },
    { key: "kebutuhan-rumah", value: "Kebutuhan Rumah", icon: "🏠" },
    { key: "sedekah", value: "Sedekah", icon: "🤲" },
    { key: "kado-traktiran", value: "Kado & Traktiran", icon: "🎁" },
    { key: "hiburan", value: "Hiburan", icon: "🎬" },
    { key: "pengembangan-diri", value: "Pengembangan Diri", icon: "📚" },
    { key: "wishlist", value: "Wishlist", icon: "⭐" },
    { key: "cadangan-tak-terduga", value: "Cadangan Tak Terduga", icon: "📦" },
] as const;

// Kategori pemasukan tidak bisa diberi budget pengeluaran
export const INCOME_CATEGORIES = [
    { key: "gaji", value: "Gaji", icon: "💰" },
    { key: "bonus", value: "Bonus", icon: "🎉" },
] as const;

export const CATEGORIES = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];

export const BUDGET_CATEGORIES = EXPENSE_CATEGORIES;

export function categoriesFor(type: TransactionType) {
    return type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
}

export function categoryIcon(category: string): string {
    return CATEGORIES.find((c) => c.value === category)?.icon ?? "💰";
}

// ID dokumen budget untuk sebuah kategori pengeluaran
export function budgetKey(category: string): string | undefined {
    return BUDGET_CATEGORIES.find((c) => c.value === category)?.key;
}

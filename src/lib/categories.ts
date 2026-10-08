// Satu-satunya sumber daftar kategori, dipakai form tambah, form edit, dan daftar transaksi.
export const CATEGORIES = [
    { value: "Food", icon: "🍔" },
    { value: "Transport", icon: "🚕" },
    { value: "Entertainment", icon: "🎬" },
    { value: "Shopping", icon: "🛍️" },
    { value: "Bills", icon: "📱" },
    { value: "Salary", icon: "💰" },
    { value: "Other", icon: "📦" },
] as const;

export function categoryIcon(category: string): string {
    return CATEGORIES.find((c) => c.value === category)?.icon ?? "💰";
}

import { describe, expect, it, vi } from "vitest";
import { faUtensils, faWallet } from "@fortawesome/free-solid-svg-icons";
import { categoryIdFor, iconByName, isSavingsCategory, missingCategoryIds, withCurrentCategoryNames } from "./categories";
import type { Category, Transaction } from "./types";

// categories.ts juga berisi fungsi yang menulis ke Firestore; koneksinya tidak dipakai di tes ini
vi.mock("./firebase", () => ({ db: {} }));

const categories: Category[] = [
    { id: "c1", name: "Makan", icon: "utensils", type: "expense", savings: false },
    { id: "c2", name: "Tabungan", icon: "piggy-bank", type: "expense", savings: true },
    { id: "c3", name: "Gaji", icon: "briefcase", type: "income", savings: false },
];

const tx = (id: string, category: string, extra: Partial<Transaction> = {}): Transaction =>
    ({ id, type: "expense", amount: 1_000, category, date: "2026-10-01", note: "", ...extra });

describe("categoryIdFor", () => {
    it("mencocokkan nama sekaligus jenis kategori", () => {
        expect(categoryIdFor(categories, "Makan", "expense")).toBe("c1");
        expect(categoryIdFor(categories, "Makan", "income")).toBeUndefined();
        expect(categoryIdFor(categories, undefined, "expense")).toBeUndefined();
    });
});

describe("withCurrentCategoryNames", () => {
    it("memakai nama kategori terkini lewat categoryId", () => {
        const [item] = withCurrentCategoryNames([tx("t1", "Makan Lama", { categoryId: "c1" })], categories);
        expect(item.category).toBe("Makan");
    });

    it("memakai nama tersimpan kalau kategorinya sudah dihapus atau belum punya ID", () => {
        const items = [tx("t1", "Jajan", { categoryId: "dihapus" }), tx("t2", "Makan")];
        expect(withCurrentCategoryNames(items, categories).map((t) => t.category)).toEqual(["Jajan", "Makan"]);
    });

    it("mengembalikan objek yang sama kalau tidak ada perubahan", () => {
        const item = tx("t1", "Makan", { categoryId: "c1" });
        expect(withCurrentCategoryNames([item], categories)[0]).toBe(item);
    });
});

describe("missingCategoryIds", () => {
    it("hanya mengembalikan dokumen tanpa categoryId yang namanya cocok", () => {
        const items = [
            tx("t1", "Makan"),
            tx("t2", "Makan", { categoryId: "c1" }),
            tx("t3", "Tidak Ada"),
            tx("t4", "Gaji", { type: "income" }),
        ];
        const result = missingCategoryIds(items, categories, (t) => t.type).map(([t, id]) => [t.id, id]);
        expect(result).toEqual([["t1", "c1"], ["t4", "c3"]]);
    });
});

describe("isSavingsCategory", () => {
    it("hanya kategori pengeluaran bertanda tabungan", () => {
        expect(isSavingsCategory(categories, "Tabungan")).toBe(true);
        expect(isSavingsCategory(categories, "Makan")).toBe(false);
        expect(isSavingsCategory(categories, "Tidak Ada")).toBe(false);
    });
});

describe("iconByName", () => {
    it("memakai ikon default untuk nama yang tidak dikenal", () => {
        expect(iconByName("utensils")).toBe(faUtensils);
        expect(iconByName("🍔")).toBe(faWallet);
        expect(iconByName(undefined)).toBe(faWallet);
    });
});

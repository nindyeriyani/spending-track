import { describe, expect, it } from "vitest";
import { budgetStatus, daysLeftInMonth, needsAttention, spentByCategory } from "./budget";
import type { Transaction } from "./types";

const tx = (category: string, amount: number, type: Transaction["type"] = "expense"): Transaction =>
    ({ id: `${category}-${amount}`, type, amount, category, date: "2026-10-01", note: "" });

describe("budgetStatus", () => {
    it("aman di bawah 80%, hampir habis mulai 80%, terlampaui di atas batas", () => {
        expect(budgetStatus(79_999, 100_000)).toBe("safe");
        expect(budgetStatus(80_000, 100_000)).toBe("warning");
        expect(budgetStatus(100_000, 100_000)).toBe("warning");
        expect(budgetStatus(100_001, 100_000)).toBe("over");
    });

    it("budget tabungan dibaca terbalik: mencapai batas berarti tercapai", () => {
        expect(budgetStatus(50_000, 100_000, true)).toBe("saving");
        expect(budgetStatus(100_000, 100_000, true)).toBe("saved");
        expect(budgetStatus(150_000, 100_000, true)).toBe("saved");
    });
});

describe("needsAttention", () => {
    it("hanya hampir habis dan terlampaui yang perlu perhatian", () => {
        expect(needsAttention("warning")).toBe(true);
        expect(needsAttention("over")).toBe(true);
        expect(needsAttention("safe")).toBe(false);
        expect(needsAttention("saving")).toBe(false);
        expect(needsAttention("saved")).toBe(false);
    });
});

describe("spentByCategory", () => {
    it("menjumlahkan pengeluaran per kategori dan mengabaikan pemasukan", () => {
        const spent = spentByCategory([tx("Makan", 10_000), tx("Makan", 5_000), tx("Transport", 7_000), tx("Gaji", 1_000_000, "income")]);
        expect(spent).toEqual(new Map([["Makan", 15_000], ["Transport", 7_000]]));
    });
});

describe("daysLeftInMonth", () => {
    it("menghitung hari ini sebagai hari tersisa", () => {
        expect(daysLeftInMonth(new Date(2026, 9, 1))).toBe(31);
        expect(daysLeftInMonth(new Date(2026, 9, 31))).toBe(1);
    });

    it("memperhitungkan Februari tahun kabisat", () => {
        expect(daysLeftInMonth(new Date(2028, 1, 1))).toBe(29);
        expect(daysLeftInMonth(new Date(2026, 1, 1))).toBe(28);
    });
});

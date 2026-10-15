import { describe, expect, it } from "vitest";
import { monthKey, parseLocalDate } from "./date";

describe("parseLocalDate", () => {
    it("membaca tanggal sebagai waktu lokal, bukan UTC", () => {
        const d = parseLocalDate("2026-01-31");
        expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 0, 31, 0]);
    });
});

describe("monthKey", () => {
    it("memakai format YYYY-MM dengan bulan dua digit", () => {
        expect(monthKey(new Date(2026, 0, 15))).toBe("2026-01");
        expect(monthKey(new Date(2026, 11, 1))).toBe("2026-12");
    });

    it("cocok dengan awalan string tanggal transaksi", () => {
        expect("2026-03-09".startsWith(monthKey(parseLocalDate("2026-03-09")))).toBe(true);
    });
});

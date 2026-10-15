import { describe, expect, it } from "vitest";
import { goalSaved, isGoalReached } from "./goals";

describe("goalSaved", () => {
    const spent = new Map([["Tabungan", 300_000]]);

    it("target biasa memakai angka terkumpul manual", () => {
        expect(goalSaved({ name: "Liburan", targetAmount: 1_000_000, currentAmount: 200_000 }, spent)).toBe(200_000);
    });

    it("target terhubung = saldo awal + total transaksi kategorinya", () => {
        expect(goalSaved({ name: "Dana darurat", targetAmount: 1_000_000, currentAmount: 100_000, category: "Tabungan" }, spent)).toBe(400_000);
    });

    it("kategori tanpa transaksi dihitung 0", () => {
        expect(goalSaved({ name: "Motor", targetAmount: 1_000_000, currentAmount: 50_000, category: "Kendaraan" }, spent)).toBe(50_000);
    });
});

describe("isGoalReached", () => {
    it("tercapai saat terkumpul sama dengan atau melebihi target", () => {
        expect(isGoalReached(999, 1_000)).toBe(false);
        expect(isGoalReached(1_000, 1_000)).toBe(true);
        expect(isGoalReached(1_500, 1_000)).toBe(true);
    });
});

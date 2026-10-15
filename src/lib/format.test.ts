import { describe, expect, it } from "vitest";
import { formatNumber, formatRupiah } from "./format";

describe("formatNumber", () => {
    it("memakai titik sebagai pemisah ribuan", () => {
        expect(formatNumber(1_250_000)).toBe("1.250.000");
    });
});

describe("formatRupiah", () => {
    it("menaruh tanda minus di depan Rp", () => {
        expect(formatRupiah(50_000)).toBe("Rp 50.000");
        expect(formatRupiah(-5_000)).toBe("-Rp 5.000");
        expect(formatRupiah(0)).toBe("Rp 0");
    });
});

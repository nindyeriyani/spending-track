"use client";

import { formatNumber } from "@/lib/format";

// Input nominal Rupiah yang menampilkan pemisah ribuan saat mengetik ("2.000.000").
// `value` dan `onChange` memakai string angka polos ("2000000") supaya field tetap bisa dikosongkan.
export default function AmountInput({ value, onChange, ...props }: {
    value: string;
    onChange: (digits: string) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type" | "inputMode">) {
    return (
        <input
            {...props}
            type="text"
            inputMode="numeric"
            value={value === "" ? "" : formatNumber(Number(value))}
            onChange={(e) => onChange(e.target.value.replace(/\D/g, "").replace(/^0+(?=\d)/, ""))}
        />
    );
}

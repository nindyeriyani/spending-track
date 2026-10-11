// Format angka selalu memakai locale Indonesia, apa pun bahasa perangkatnya ("50.000", bukan "50,000").
export function formatNumber(n: number): string {
    return n.toLocaleString("id-ID");
}

// Tanda minus di depan "Rp" ("-Rp 5.000"), bukan "Rp -5.000"
export function formatRupiah(n: number): string {
    return `${n < 0 ? "-" : ""}Rp ${formatNumber(Math.abs(n))}`;
}

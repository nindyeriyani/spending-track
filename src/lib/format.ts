// Format angka selalu memakai locale Indonesia, apa pun bahasa perangkatnya ("50.000", bukan "50,000").
export function formatNumber(n: number): string {
    return n.toLocaleString("id-ID");
}

export function formatRupiah(n: number): string {
    return `Rp ${formatNumber(n)}`;
}

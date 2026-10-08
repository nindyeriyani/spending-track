// Tanggal transaksi disimpan sebagai string "YYYY-MM-DD" (tanggal lokal, tanpa zona waktu).

const pad = (n: number) => String(n).padStart(2, "0");

// Tanggal hari ini menurut zona waktu perangkat, bukan UTC.
export function todayLocal(): string {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// "YYYY-MM-DD" -> Date pada tengah malam waktu lokal.
// `new Date("YYYY-MM-DD")` membacanya sebagai UTC sehingga bisa bergeser satu hari.
export function parseLocalDate(value: string): Date {
    const [y, m, d] = value.split("-").map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
}

// Kunci bulan "YYYY-MM" untuk sebuah Date.
export function monthKey(date: Date): string {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

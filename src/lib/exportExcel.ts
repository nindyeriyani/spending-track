import type { Transaction } from "./types";
import type { BudgetStatus } from "./budget";
import { isSavingsCategory } from "./categories";

export interface BudgetRow {
    category: string;
    limit: number;
    spent: number;
    status: BudgetStatus;
}

const RUPIAH_FORMAT = '"Rp" #,##0;-"Rp" #,##0';
const HEADER_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F46E5" } } as const;
const STATUS_LABEL: Record<BudgetStatus, string> = { safe: "Aman", warning: "Hampir habis", over: "Terlampaui", saving: "Menabung", saved: "Tercapai" };

// exceljs cukup besar, jadi baru dimuat saat user menekan tombol export
export async function exportMonthToExcel({ monthLabel, transactions, budgets }: {
    monthLabel: string;
    transactions: Transaction[];
    budgets: BudgetRow[];
}) {
    const { default: ExcelJS } = await import("exceljs");
    const workbook = new ExcelJS.Workbook();

    const txSheet = workbook.addWorksheet("Transaksi");
    txSheet.columns = [
        { header: "Tanggal", key: "date", width: 14, style: { numFmt: "dd/mm/yyyy" } },
        { header: "Kategori", key: "category", width: 16 },
        { header: "Catatan", key: "note", width: 32 },
        { header: "Tipe", key: "type", width: 14 },
        { header: "Jumlah", key: "amount", width: 18, style: { numFmt: RUPIAH_FORMAT } },
    ];
    for (const tx of transactions) {
        const [y, m, d] = tx.date.split("-").map(Number);
        txSheet.addRow({
            // exceljs menulis Date sebagai UTC; tanggal lokal dibuat di UTC supaya tidak mundur sehari
            date: new Date(Date.UTC(y, m - 1, d)),
            category: tx.category,
            note: tx.note || "-",
            type: tx.type === "income" ? "Pemasukan" : isSavingsCategory(tx.category) ? "Tabungan" : "Pengeluaran",
            amount: tx.amount,
        });
    }
    let totalIncome = 0;
    let totalExpense = 0;
    let totalSavings = 0;
    for (const tx of transactions) {
        if (tx.type === "income") totalIncome += tx.amount;
        else if (isSavingsCategory(tx.category)) totalSavings += tx.amount;
        else totalExpense += tx.amount;
    }
    txSheet.addRow({});
    for (const [label, value] of [
        ["Total Pemasukan", totalIncome],
        ["Total Pengeluaran", totalExpense],
        ["Total Tabungan", totalSavings],
        ["Saldo", totalIncome - totalExpense - totalSavings],
    ] as const) {
        const row = txSheet.addRow({ type: label, amount: value });
        row.font = { bold: true };
    }

    const budgetSheet = workbook.addWorksheet("Budget");
    budgetSheet.columns = [
        { header: "Kategori", key: "category", width: 16 },
        { header: "Batas", key: "limit", width: 18, style: { numFmt: RUPIAH_FORMAT } },
        { header: "Terpakai", key: "spent", width: 18, style: { numFmt: RUPIAH_FORMAT } },
        { header: "Sisa", key: "remaining", width: 18, style: { numFmt: RUPIAH_FORMAT } },
        { header: "Pemakaian", key: "usage", width: 12, style: { numFmt: "0%" } },
        { header: "Status", key: "status", width: 14 },
    ];
    for (const b of budgets) {
        budgetSheet.addRow({
            category: b.category,
            limit: b.limit,
            spent: b.spent,
            remaining: b.limit - b.spent,
            usage: b.spent / b.limit,
            status: STATUS_LABEL[b.status],
        });
    }

    for (const sheet of [txSheet, budgetSheet]) {
        const header = sheet.getRow(1);
        header.font = { bold: true, color: { argb: "FFFFFFFF" } };
        header.eachCell((cell) => { cell.fill = HEADER_FILL; });
        sheet.views = [{ state: "frozen", ySplit: 1 }];
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `spending_track_${monthLabel.replace(/ /g, "_")}.xlsx`;
    a.click();
    // Safari bisa membatalkan download kalau URL langsung dicabut setelah click()
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

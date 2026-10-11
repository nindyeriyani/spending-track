import type { Borders, Cell, Row, Workbook, Worksheet } from "exceljs";
import type { Transaction } from "./types";
import type { BudgetStatus } from "./budget";
import { isSavingsCategory } from "./categories";

export interface BudgetRow {
    category: string;
    limit: number;
    spent: number;
    status: BudgetStatus;
}

type Kind = "Pemasukan" | "Pengeluaran" | "Tabungan";
const KINDS: Kind[] = ["Pemasukan", "Pengeluaran", "Tabungan"];

const COLOR = {
    brand: "FF4F46E5",
    brandSoft: "FFEEF2FF",
    text: "FF0F172A",
    muted: "FF64748B",
    border: "FFE2E8F0",
    zebra: "FFF8FAFC",
    green: "FF047857",
    greenSoft: "FFD1FAE5",
    amber: "FFB45309",
    amberSoft: "FFFEF3C7",
    red: "FFB91C1C",
    redSoft: "FFFEE2E2",
    indigo: "FF4338CA",
    indigoSoft: "FFE0E7FF",
};

// Angka negatif tampil merah; pemisah ribuan mengikuti pengaturan Excel pengguna
const RUPIAH = '"Rp"#,##0;[Red]-"Rp"#,##0';
const PERCENT = "0%";
const DATE = "dd mmm yyyy";

const KIND_COLOR: Record<Kind, string> = { Pemasukan: COLOR.green, Pengeluaran: COLOR.text, Tabungan: COLOR.indigo };

const STATUS_STYLE: Record<BudgetStatus, { label: string; color: string; fill: string }> = {
    safe: { label: "Aman", color: COLOR.green, fill: COLOR.greenSoft },
    warning: { label: "Hampir habis", color: COLOR.amber, fill: COLOR.amberSoft },
    over: { label: "Terlampaui", color: COLOR.red, fill: COLOR.redSoft },
    saving: { label: "Menabung", color: COLOR.indigo, fill: COLOR.indigoSoft },
    saved: { label: "Tercapai", color: COLOR.green, fill: COLOR.greenSoft },
};

const THIN = { style: "thin", color: { argb: COLOR.border } } as const;
const CELL_BORDER: Partial<Borders> = { top: THIN, left: THIN, bottom: THIN, right: THIN };

function kindOf(tx: Transaction): Kind {
    if (tx.type === "income") return "Pemasukan";
    return isSavingsCategory(tx.category) ? "Tabungan" : "Pengeluaran";
}

function solid(argb: string) {
    return { type: "pattern", pattern: "solid", fgColor: { argb } } as const;
}

// exceljs menulis Date sebagai UTC; tanggal lokal dibuat di UTC supaya tidak mundur sehari
function excelDate(value: string): Date {
    const [y, m, d] = value.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d));
}

// Judul laporan di tiga baris teratas; tabel di bawahnya dimulai dari baris 5
function addTitle(ws: Worksheet, title: string, subtitle: string, lastCol: string) {
    ws.mergeCells(`A1:${lastCol}1`);
    ws.mergeCells(`A2:${lastCol}2`);
    ws.mergeCells(`A3:${lastCol}3`);
    const t = ws.getCell("A1");
    t.value = title;
    t.font = { size: 16, bold: true, color: { argb: COLOR.brand } };
    ws.getRow(1).height = 26;
    ws.getCell("A2").value = subtitle;
    ws.getCell("A2").font = { size: 11, bold: true, color: { argb: COLOR.text } };
    ws.getCell("A3").font = { size: 9, italic: true, color: { argb: COLOR.muted } };
}

function styleHeader(row: Row) {
    row.height = 22;
    row.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
        cell.fill = solid(COLOR.brand);
        cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
        cell.border = CELL_BORDER;
    });
}

function styleBody(row: Row, index: number, colCount: number) {
    for (let c = 1; c <= colCount; c++) {
        const cell = row.getCell(c);
        cell.border = CELL_BORDER;
        cell.alignment = { vertical: "middle", ...cell.alignment };
        if (index % 2 === 1) cell.fill = solid(COLOR.zebra);
    }
}

function styleTotal(row: Row, colCount: number, emphasize = false) {
    for (let c = 1; c <= colCount; c++) {
        const cell = row.getCell(c);
        cell.font = { bold: true, color: { argb: COLOR.text } };
        cell.fill = solid(emphasize ? COLOR.indigoSoft : COLOR.brandSoft);
        cell.border = { ...CELL_BORDER, top: { style: "thin", color: { argb: COLOR.brand } } };
    }
}

function sectionTitle(ws: Worksheet, rowNumber: number, text: string, lastCol: string) {
    ws.mergeCells(`A${rowNumber}:${lastCol}${rowNumber}`);
    const cell = ws.getCell(`A${rowNumber}`);
    cell.value = text;
    cell.font = { size: 12, bold: true, color: { argb: COLOR.brand } };
    cell.border = { bottom: { style: "medium", color: { argb: COLOR.brand } } };
    ws.getRow(rowNumber).height = 20;
}

function emptyRow(ws: Worksheet, rowNumber: number, text: string, lastCol: string) {
    ws.mergeCells(`A${rowNumber}:${lastCol}${rowNumber}`);
    const cell = ws.getCell(`A${rowNumber}`);
    cell.value = text;
    cell.font = { italic: true, color: { argb: COLOR.muted } };
    cell.alignment = { horizontal: "center" };
    cell.border = CELL_BORDER;
}

// Pengaturan cetak: A4, muat selebar halaman, header tabel diulang di tiap halaman
function setupPrint(ws: Worksheet, footer: string, orientation: "portrait" | "landscape", headerRow?: number) {
    ws.pageSetup = {
        paperSize: 9,
        orientation,
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        horizontalCentered: true,
        margins: { left: 0.5, right: 0.5, top: 0.6, bottom: 0.7, header: 0.3, footer: 0.3 },
        ...(headerRow ? { printTitlesRow: `${headerRow}:${headerRow}` } : {}),
    };
    ws.headerFooter = { oddFooter: `&L&8${footer}&R&8Halaman &P dari &N` };
}

function setFormula(cell: Cell, formula: string, result: number) {
    // `result` disimpan juga supaya nilainya terlihat di penampil yang tidak menghitung rumus (mis. preview di HP)
    cell.value = { formula, result };
}

export function buildMonthlyReport(ExcelJS: typeof import("exceljs"), { monthLabel, transactions, budgets, generatedAt = new Date() }: {
    monthLabel: string;
    transactions: Transaction[];
    budgets: BudgetRow[];
    generatedAt?: Date;
}): Workbook {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Spending Track";
    workbook.created = generatedAt;
    workbook.title = `Laporan Keuangan ${monthLabel}`;
    // Hitung ulang semua rumus saat dibuka (exceljs tidak menyimpan hasil rumus yang bernilai 0)
    workbook.calcProperties.fullCalcOnLoad = true;

    const period = `Periode: ${monthLabel}`;
    const generated = `Dibuat ${generatedAt.toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short" })} dengan Spending Track`;
    const footer = `Spending Track · Laporan Keuangan ${monthLabel}`;

    const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date));
    const totals: Record<Kind, number> = { Pemasukan: 0, Pengeluaran: 0, Tabungan: 0 };
    const byCategory = new Map<string, { kind: Kind; amount: number; count: number }>();
    for (const tx of sorted) {
        const kind = kindOf(tx);
        totals[kind] += tx.amount;
        const key = `${kind}|${tx.category}`;
        const entry = byCategory.get(key) ?? { kind, amount: 0, count: 0 };
        entry.amount += tx.amount;
        entry.count += 1;
        byCategory.set(key, entry);
    }
    const balance = totals.Pemasukan - totals.Pengeluaran - totals.Tabungan;

    // ---------- Sheet 1: Ringkasan ----------
    const summary = workbook.addWorksheet("Ringkasan", { views: [{ showGridLines: false }] });
    summary.columns = [{ width: 28 }, { width: 16 }, { width: 20 }, { width: 12 }, { width: 13 }];
    addTitle(summary, "Laporan Keuangan Bulanan", period, "E");
    summary.getCell("A3").value = generated;

    sectionTitle(summary, 5, "Ringkasan", "E");
    const summaryRows: [string, number, string][] = [
        ["Total Pemasukan", totals.Pemasukan, COLOR.green],
        ["Total Pengeluaran", totals.Pengeluaran, COLOR.text],
        ["Total Tabungan", totals.Tabungan, COLOR.indigo],
    ];
    summaryRows.forEach(([label, value, color], i) => {
        const row = summary.getRow(6 + i);
        row.getCell(1).value = label;
        summary.mergeCells(`B${6 + i}:C${6 + i}`);
        const cell = row.getCell(2);
        cell.value = value;
        cell.numFmt = RUPIAH;
        cell.font = { bold: true, color: { argb: color } };
        cell.alignment = { horizontal: "right" };
        styleBody(row, i, 3);
    });
    const balanceRow = summary.getRow(9);
    balanceRow.getCell(1).value = "Saldo (Pemasukan − Pengeluaran − Tabungan)";
    summary.mergeCells("B9:C9");
    setFormula(balanceRow.getCell(2), "B6-B7-B8", balance);
    balanceRow.getCell(2).numFmt = RUPIAH;
    balanceRow.getCell(2).alignment = { horizontal: "right" };
    styleTotal(balanceRow, 3, true);
    balanceRow.getCell(1).alignment = { wrapText: true };
    balanceRow.height = 30;
    const countRow = summary.getRow(10);
    countRow.getCell(1).value = "Jumlah transaksi";
    summary.mergeCells("B10:C10");
    countRow.getCell(2).value = sorted.length;
    countRow.getCell(2).alignment = { horizontal: "right" };
    styleBody(countRow, 0, 3);

    sectionTitle(summary, 12, "Rincian per Kategori", "E");
    const catHeader = summary.getRow(13);
    catHeader.values = ["Kategori", "Jenis", "Jumlah", "Porsi", "Transaksi"];
    styleHeader(catHeader);
    const categoryRows = [...byCategory.entries()]
        .map(([key, v]) => ({ category: key.split("|")[1], ...v }))
        .sort((a, b) => KINDS.indexOf(a.kind) - KINDS.indexOf(b.kind) || b.amount - a.amount);
    if (categoryRows.length === 0) {
        emptyRow(summary, 14, "Tidak ada transaksi di periode ini", "E");
    }
    categoryRows.forEach((c, i) => {
        const row = summary.getRow(14 + i);
        row.values = [c.category, c.kind, c.amount, totals[c.kind] > 0 ? c.amount / totals[c.kind] : 0, c.count];
        row.getCell(2).font = { color: { argb: KIND_COLOR[c.kind] } };
        row.getCell(3).numFmt = RUPIAH;
        row.getCell(4).numFmt = PERCENT;
        row.getCell(4).alignment = { horizontal: "right" };
        row.getCell(5).alignment = { horizontal: "center" };
        styleBody(row, i, 5);
    });
    const noteRow = 14 + Math.max(categoryRows.length, 1) + 1;
    summary.mergeCells(`A${noteRow}:E${noteRow}`);
    summary.getCell(`A${noteRow}`).value = "Porsi = bagian kategori terhadap total jenisnya (pemasukan, pengeluaran, atau tabungan).";
    summary.getCell(`A${noteRow}`).font = { size: 9, italic: true, color: { argb: COLOR.muted } };
    setupPrint(summary, footer, "portrait");

    // ---------- Sheet 2: Transaksi ----------
    const txSheet = workbook.addWorksheet("Transaksi", { views: [{ state: "frozen", ySplit: 5, showGridLines: false }] });
    txSheet.columns = [{ width: 6 }, { width: 14 }, { width: 14 }, { width: 22 }, { width: 38 }, { width: 18 }];
    addTitle(txSheet, "Daftar Transaksi", period, "F");
    txSheet.getCell("A3").value = generated;
    const txHeader = txSheet.getRow(5);
    txHeader.values = ["No", "Tanggal", "Jenis", "Kategori", "Catatan", "Jumlah"];
    styleHeader(txHeader);

    const firstTx = 6;
    sorted.forEach((tx, i) => {
        const kind = kindOf(tx);
        const row = txSheet.getRow(firstTx + i);
        row.values = [i + 1, excelDate(tx.date), kind, tx.category, tx.note || "-", tx.amount];
        row.getCell(1).alignment = { horizontal: "center" };
        row.getCell(2).numFmt = DATE;
        row.getCell(2).alignment = { horizontal: "center" };
        row.getCell(3).font = { color: { argb: KIND_COLOR[kind] } };
        row.getCell(5).alignment = { wrapText: true };
        row.getCell(6).numFmt = RUPIAH;
        styleBody(row, i, 6);
    });
    if (sorted.length === 0) emptyRow(txSheet, firstTx, "Tidak ada transaksi di periode ini", "F");
    const lastTx = firstTx + Math.max(sorted.length, 1) - 1;
    if (sorted.length > 0) txSheet.autoFilter = { from: { row: 5, column: 1 }, to: { row: lastTx, column: 6 } };

    // Total memakai rumus supaya ikut berubah kalau data di sheet ini diedit
    let totalRow = lastTx + 2;
    const totalCells: Record<Kind, string> = { Pemasukan: "", Pengeluaran: "", Tabungan: "" };
    KINDS.forEach((kind) => {
        const row = txSheet.getRow(totalRow);
        txSheet.mergeCells(`A${totalRow}:E${totalRow}`);
        row.getCell(1).value = `Total ${kind}`;
        row.getCell(1).alignment = { horizontal: "right" };
        setFormula(row.getCell(6), `SUMIF(C${firstTx}:C${lastTx},"${kind}",F${firstTx}:F${lastTx})`, totals[kind]);
        row.getCell(6).numFmt = RUPIAH;
        styleTotal(row, 6);
        totalCells[kind] = `F${totalRow}`;
        totalRow++;
    });
    const txBalance = txSheet.getRow(totalRow);
    txSheet.mergeCells(`A${totalRow}:E${totalRow}`);
    txBalance.getCell(1).value = "Saldo";
    txBalance.getCell(1).alignment = { horizontal: "right" };
    setFormula(txBalance.getCell(6), `${totalCells.Pemasukan}-${totalCells.Pengeluaran}-${totalCells.Tabungan}`, balance);
    txBalance.getCell(6).numFmt = RUPIAH;
    styleTotal(txBalance, 6, true);
    setupPrint(txSheet, footer, "portrait", 5);

    // ---------- Sheet 3: Budget ----------
    const budgetSheet = workbook.addWorksheet("Budget", { views: [{ state: "frozen", ySplit: 5, showGridLines: false }] });
    budgetSheet.columns = [{ width: 24 }, { width: 14 }, { width: 17 }, { width: 17 }, { width: 17 }, { width: 12 }, { width: 15 }];
    addTitle(budgetSheet, "Realisasi Budget", period, "G");
    budgetSheet.getCell("A3").value = "Untuk tabungan, Rencana adalah target menabung bulan ini; Sisa positif berarti masih kurang.";
    const budgetHeader = budgetSheet.getRow(5);
    budgetHeader.values = ["Kategori", "Jenis", "Rencana", "Realisasi", "Sisa", "Pemakaian", "Status"];
    styleHeader(budgetHeader);

    const orderedBudgets = [...budgets].sort((a, b) => Number(isSavingsCategory(a.category)) - Number(isSavingsCategory(b.category)));
    const firstBudget = 6;
    orderedBudgets.forEach((b, i) => {
        const r = firstBudget + i;
        const kind: Kind = isSavingsCategory(b.category) ? "Tabungan" : "Pengeluaran";
        const row = budgetSheet.getRow(r);
        row.values = [b.category, kind, b.limit, b.spent];
        setFormula(row.getCell(5), `C${r}-D${r}`, b.limit - b.spent);
        setFormula(row.getCell(6), `IF(C${r}=0,0,D${r}/C${r})`, b.limit > 0 ? b.spent / b.limit : 0);
        row.getCell(2).font = { color: { argb: KIND_COLOR[kind] } };
        for (const c of [3, 4, 5]) row.getCell(c).numFmt = RUPIAH;
        row.getCell(6).numFmt = PERCENT;
        row.getCell(6).alignment = { horizontal: "right" };
        styleBody(row, i, 7);
        const status = STATUS_STYLE[b.status];
        const statusCell = row.getCell(7);
        statusCell.value = status.label;
        statusCell.font = { bold: true, color: { argb: status.color } };
        statusCell.fill = solid(status.fill);
        statusCell.alignment = { horizontal: "center", vertical: "middle" };
    });
    if (orderedBudgets.length === 0) emptyRow(budgetSheet, firstBudget, "Belum ada budget yang diatur", "G");
    const lastBudget = firstBudget + Math.max(orderedBudgets.length, 1) - 1;

    let budgetTotalRow = lastBudget + 2;
    for (const kind of ["Pengeluaran", "Tabungan"] as const) {
        const rows = orderedBudgets.filter((b) => isSavingsCategory(b.category) === (kind === "Tabungan"));
        if (rows.length === 0) continue;
        const r = budgetTotalRow;
        const row = budgetSheet.getRow(r);
        budgetSheet.mergeCells(`A${r}:B${r}`);
        row.getCell(1).value = `Total ${kind}`;
        const range = (col: string) => `${col}${firstBudget}:${col}${lastBudget}`;
        const limit = rows.reduce((s, b) => s + b.limit, 0);
        const spent = rows.reduce((s, b) => s + b.spent, 0);
        setFormula(row.getCell(3), `SUMIF(${range("B")},"${kind}",${range("C")})`, limit);
        setFormula(row.getCell(4), `SUMIF(${range("B")},"${kind}",${range("D")})`, spent);
        setFormula(row.getCell(5), `C${r}-D${r}`, limit - spent);
        setFormula(row.getCell(6), `IF(C${r}=0,0,D${r}/C${r})`, limit > 0 ? spent / limit : 0);
        for (const c of [3, 4, 5]) row.getCell(c).numFmt = RUPIAH;
        row.getCell(6).numFmt = PERCENT;
        styleTotal(row, 7);
        budgetTotalRow++;
    }
    setupPrint(budgetSheet, footer, "landscape", 5);

    return workbook;
}

// exceljs cukup besar, jadi baru dimuat saat user menekan tombol export
export async function exportMonthToExcel(options: { monthLabel: string; transactions: Transaction[]; budgets: BudgetRow[] }) {
    const ExcelJS = await import("exceljs");
    const workbook = buildMonthlyReport(ExcelJS.default ?? ExcelJS, options);

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Laporan_Keuangan_${options.monthLabel.replace(/ /g, "_")}.xlsx`;
    a.click();
    // Safari bisa membatalkan download kalau URL langsung dicabut setelah click()
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

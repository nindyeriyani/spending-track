import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
    faBolt, faBook, faBox, faBriefcase, faBriefcaseMedical, faCar, faCartShopping, faFilm, faGamepad, faGasPump,
    faGift, faGraduationCap, faHandHoldingHeart, faHeartPulse, faHouse, faKaaba, faMobileScreen, faMoneyBillWave,
    faMotorcycle, faPiggyBank, faPlane, faPumpSoap, faSackDollar, faScrewdriverWrench, faShirt, faStar, faUsers,
    faUtensils, faWallet, faWifi,
} from "@fortawesome/free-solid-svg-icons";
import type { Category, TransactionType } from "./types";

// Kategori dibuat sendiri oleh user (users/{uid}/categories). Transaksi, budget, dan target menyimpan
// nama kategori, jadi data yang kategorinya sudah dihapus tetap tampil dengan ikon default.
// `savings: true` = uang yang disisihkan/ditabung, bukan dibelanjakan. Tetap dicatat sebagai pengeluaran
// (uangnya keluar dari dana harian), tapi ditampilkan terpisah dan budget-nya dibaca sebagai target menabung.

// Ikon Font Awesome yang bisa dipilih. Dokumen kategori menyimpan `iconName`-nya (mis. "utensils").
export const CATEGORY_ICONS: readonly IconDefinition[] = [
    faUtensils, faMotorcycle, faCar, faGasPump, faHouse, faBolt, faMobileScreen, faWifi, faCartShopping, faPumpSoap,
    faShirt, faFilm, faGamepad, faGift, faBook, faGraduationCap, faHeartPulse, faHandHoldingHeart, faUsers, faKaaba,
    faPlane, faScrewdriverWrench, faBriefcaseMedical, faPiggyBank, faWallet, faSackDollar, faMoneyBillWave, faBriefcase,
    faStar, faBox,
];

export const DEFAULT_CATEGORY_ICON = faWallet.iconName;

const ICONS_BY_NAME = new Map<string, IconDefinition>(CATEGORY_ICONS.map((icon) => [icon.iconName, icon]));

// Nama yang tidak dikenal (mis. emoji dari versi lama) memakai ikon default
export function iconByName(name: string | undefined): IconDefinition {
    return (name && ICONS_BY_NAME.get(name)) || faWallet;
}

export function categoriesFor(categories: readonly Category[], type: TransactionType): Category[] {
    return categories.filter((c) => c.type === type);
}

export function isSavingsCategory(categories: readonly Category[], name: string): boolean {
    return categories.some((c) => c.name === name && c.type === "expense" && c.savings);
}

export function categoryIcon(categories: readonly Category[], name: string): IconDefinition {
    return iconByName(categories.find((c) => c.name === name)?.icon);
}

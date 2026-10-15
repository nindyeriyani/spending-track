import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
    faBolt, faBook, faBox, faBriefcase, faBriefcaseMedical, faCar, faCartShopping, faFilm, faGamepad, faGasPump,
    faGift, faGraduationCap, faHandHoldingHeart, faHeartPulse, faHouse, faKaaba, faMobileScreen, faMoneyBillWave,
    faMotorcycle, faPiggyBank, faPlane, faPumpSoap, faSackDollar, faScrewdriverWrench, faShirt, faStar, faUsers,
    faUtensils, faWallet, faWifi,
} from "@fortawesome/free-solid-svg-icons";
import { doc, serverTimestamp, writeBatch } from "firebase/firestore";
import { db } from "./firebase";
import type { Category, CategoryInput, TransactionType } from "./types";

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

// Kategori awal untuk akun baru, supaya bisa langsung mencatat. Nama harus unik lintas jenis.
const DEFAULT_CATEGORIES: readonly Omit<CategoryInput, "createdAt">[] = [
    { name: "Makan & Minum", icon: faUtensils.iconName, type: "expense", savings: false },
    { name: "Transportasi", icon: faMotorcycle.iconName, type: "expense", savings: false },
    { name: "Belanja", icon: faCartShopping.iconName, type: "expense", savings: false },
    { name: "Tagihan & Listrik", icon: faBolt.iconName, type: "expense", savings: false },
    { name: "Pulsa & Internet", icon: faWifi.iconName, type: "expense", savings: false },
    { name: "Kesehatan", icon: faHeartPulse.iconName, type: "expense", savings: false },
    { name: "Hiburan", icon: faFilm.iconName, type: "expense", savings: false },
    { name: "Pendidikan", icon: faGraduationCap.iconName, type: "expense", savings: false },
    { name: "Sedekah & Donasi", icon: faHandHoldingHeart.iconName, type: "expense", savings: false },
    { name: "Tabungan", icon: faPiggyBank.iconName, type: "expense", savings: true },
    { name: "Lainnya", icon: faBox.iconName, type: "expense", savings: false },
    { name: "Gaji", icon: faBriefcase.iconName, type: "income", savings: false },
    { name: "Bonus", icon: faGift.iconName, type: "income", savings: false },
    { name: "Usaha", icon: faSackDollar.iconName, type: "income", savings: false },
    { name: "Pemasukan Lain", icon: faMoneyBillWave.iconName, type: "income", savings: false },
];

// ID dokumen tetap ("default-01", ...), jadi kalau terpanggil dua kali (mis. dua tab) kategorinya tidak dobel.
// Hanya dipanggil untuk akun yang belum punya kategori, sehingga tidak menimpa kategori buatan user.
export function addDefaultCategories(uid: string): Promise<void> {
    const batch = writeBatch(db);
    DEFAULT_CATEGORIES.forEach((category, i) => {
        const id = `default-${String(i + 1).padStart(2, "0")}`;
        batch.set(doc(db, "users", uid, "categories", id), { ...category, createdAt: serverTimestamp() });
    });
    return batch.commit();
}

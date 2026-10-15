# Spending Track

Aplikasi web untuk mencatat pemasukan, pengeluaran, budget bulanan, dan target tabungan. Dibuat dengan Next.js dan Firebase (Authentication + Cloud Firestore), di-hosting di Vercel, dan bisa di-install ke layar utama HP (PWA).

## Fitur

- Login dengan email/password atau Google; akun baru langsung mendapat kategori bawaan
- Transaksi pemasukan/pengeluaran per bulan, dengan saldo dan ringkasan
- Kategori buatan sendiri (bisa diedit dan dihapus), termasuk kategori tabungan yang dihitung terpisah dari pengeluaran
- Budget per kategori dengan peringatan saat hampir habis atau terlampaui
- Target keuangan, bisa dihubungkan ke kategori supaya progresnya terisi otomatis
- Unduh laporan bulanan ke Excel
- Tetap bisa mencatat saat offline (tersinkron saat online lagi)
- Hapus akun beserta semua data, dan halaman [Kebijakan Privasi](src/app/privacy/page.tsx)

## Menjalankan secara lokal

Butuh Node.js 22.

```bash
npm install
cp .env.example .env.local   # lalu isi konfigurasi Firebase
npm run dev                  # http://localhost:3000
```

Nilai di `.env.local` ada di Firebase Console → Project Settings → General → Your apps (Web). Di Firebase Console, aktifkan juga **Authentication → Sign-in method → Email/Password** dan **Google**.

### Tanpa menyentuh data asli (emulator)

Untuk mencoba fitur tanpa memakai project Firebase asli, jalankan emulator lokal lalu arahkan app ke sana:

```bash
npm run emulators   # Auth di :9099, Firestore di :8080 (butuh Java 21)
NEXT_PUBLIC_FIREBASE_EMULATORS=true NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-spending-track npm run dev
```

Data emulator hilang saat emulator dimatikan.

## Perintah

| Perintah | Fungsi |
| --- | --- |
| `npm run dev` | Server development |
| `npm run build` / `npm start` | Build dan jalankan versi produksi |
| `npm run lint` | ESLint |
| `npm run typecheck` | Pemeriksaan TypeScript |
| `npm test` | Unit test (Vitest) untuk logika di `src/lib` |
| `npm run test:rules` | Tes aturan Firestore dengan emulator (butuh Java 21) |
| `npm run emulators` | Emulator Auth + Firestore |

CI di GitHub Actions ([.github/workflows/ci.yml](.github/workflows/ci.yml)) menjalankan lint, typecheck, unit test, build, dan tes aturan Firestore di setiap push ke `main` dan setiap pull request.

## Deploy

- **App**: Vercel men-deploy otomatis setiap push ke `main`. Variabel `NEXT_PUBLIC_FIREBASE_*` diisi di pengaturan project Vercel.
- **Aturan Firestore** ([firestore.rules](firestore.rules)) tidak ikut ter-deploy bersama app. Setelah mengubahnya, publish lewat Firebase Console (Firestore → Rules) atau `npx firebase deploy --only firestore:rules`. Publish aturan **sebelum** men-deploy kode yang menulis field baru, karena aturan menolak field yang tidak dikenal.

## Struktur

```
src/
  app/                  halaman (page.tsx: login atau dashboard), privacy/, manifest.ts
  components/           form tambah, kategori, akun, Dialog (pop up yang bisa dipakai dengan keyboard)
  components/dashboard/ dashboard: header, tab Ringkasan/Budget/Target, modal edit
  hooks/                useUserData (sinkronisasi Firestore), useAlert, useToday, useAuthUser
  lib/                  logika murni (budget, target, ringkasan, kategori, format) + unit test
tests/rules/            tes aturan Firestore
firestore.rules         aturan keamanan database
```

## Catatan desain

- **Data per user**: semua dokumen ada di `users/{uid}/transactions|categories|budgets|goals`. Aturan Firestore memastikan setiap akun hanya bisa membaca dan menulis datanya sendiri, dan memeriksa bentuk setiap dokumen (lihat `src/lib/types.ts`).
- **Kategori dirujuk lewat `categoryId`**: transaksi, budget, dan target menyimpan `categoryId` beserta nama kategori saat ditulis. Saat dibaca, nama diganti dengan nama kategori terkini, jadi mengganti nama kategori cukup mengubah satu dokumen. Nama tersimpan hanya dipakai kalau kategorinya sudah dihapus. Dokumen lama yang belum punya `categoryId` dilengkapi otomatis saat app dibuka.
- **Transaksi dimuat per bulan**: hanya bulan yang sedang dilihat dan bulan berjalan yang dibaca dari Firestore. Progres target yang terhubung ke kategori dibaca terpisah, hanya untuk kategori tersebut.
- **Tulisan tidak ditunggu**: Firestore langsung menyimpan perubahan di perangkat (termasuk saat offline) lalu menyinkronkannya; kegagalan dari server dilaporkan belakangan lewat alert.
- **Tanggal transaksi** disimpan sebagai string `YYYY-MM-DD` waktu lokal, bukan timestamp, supaya tidak bergeser karena zona waktu.

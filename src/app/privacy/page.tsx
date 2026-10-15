import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Kebijakan Privasi - Spending Track",
  description: "Data apa yang disimpan Spending Track, untuk apa, dan bagaimana menghapusnya.",
};

const CONTACT_EMAIL = "nindyindy29@gmail.com";
const LAST_UPDATED = "15 Oktober 2026";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-bold">{title}</h2>
      <div className="flex flex-col gap-3 text-sm leading-relaxed text-muted-foreground [&_strong]:text-foreground">{children}</div>
    </section>
  );
}

export default function PrivacyPolicy() {
  return (
    <main className="min-h-screen bg-background text-foreground px-4 py-10">
      <article className="max-w-2xl mx-auto flex flex-col gap-8">
        <Link href="/" className="text-sm font-bold text-primary hover:opacity-80 self-start">← Kembali ke aplikasi</Link>

        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Kebijakan Privasi</h1>
          <p className="text-sm text-muted-foreground">Terakhir diperbarui {LAST_UPDATED}</p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Spending Track adalah aplikasi untuk mencatat pemasukan, pengeluaran, budget, dan target keuangan pribadi.
            Halaman ini menjelaskan data apa yang kami simpan, untuk apa, dan hak Anda atas data tersebut, sesuai
            Undang-Undang No. 27 Tahun 2022 tentang Pelindungan Data Pribadi.
          </p>
        </header>

        <Section title="Data yang kami simpan">
          <p><strong>Data akun.</strong> Alamat email Anda. Kalau Anda masuk dengan Google, kami juga menerima nama dan foto profil dari akun Google Anda. Password tidak pernah kami simpan atau lihat; password dikelola oleh Firebase Authentication.</p>
          <p><strong>Catatan keuangan.</strong> Transaksi (jenis, jumlah, kategori, tanggal, catatan), budget, target, dan kategori yang Anda buat sendiri.</p>
          <p>Kami <strong>tidak</strong> meminta atau menyimpan nomor rekening, kartu, akses ke bank, lokasi, maupun kontak Anda.</p>
        </Section>

        <Section title="Untuk apa data dipakai">
          <p>Data hanya dipakai untuk menjalankan aplikasi: memungkinkan Anda masuk, menyimpan dan menampilkan catatan keuangan Anda, serta menyinkronkannya di perangkat yang Anda pakai.</p>
          <p>Kami tidak menjual data, tidak memakainya untuk iklan, dan tidak memasang pelacak atau analitik pihak ketiga.</p>
        </Section>

        <Section title="Di mana data disimpan dan siapa yang bisa melihatnya">
          <p>Data disimpan di <strong>Google Firebase</strong> (Authentication dan Cloud Firestore). Aturan keamanan database memastikan setiap akun hanya bisa membaca dan mengubah datanya sendiri.</p>
          <p>Aplikasi di-hosting di <strong>Vercel</strong>, yang dapat mencatat data teknis seperti alamat IP dan jenis browser untuk keperluan operasional dan keamanan.</p>
          <p>Supaya aplikasi tetap bisa dipakai saat offline, salinan data Anda juga disimpan di browser perangkat Anda. Salinan ini dihapus dari perangkat tersebut saat Anda menghapus akun.</p>
          <p>Google dan Vercel memproses data atas nama kami sebagai penyedia layanan dan dapat menyimpannya di server di luar Indonesia.</p>
        </Section>

        <Section title="Berapa lama data disimpan">
          <p>Data disimpan selama akun Anda ada. Saat Anda menghapus akun, data dihapus dari database saat itu juga. Salinan cadangan di sistem penyedia layanan dapat bertahan untuk waktu terbatas sesuai kebijakan mereka sebelum terhapus otomatis.</p>
        </Section>

        <Section title="Hak Anda">
          <p><strong>Melihat dan mengubah.</strong> Semua data Anda bisa dilihat dan diubah langsung di aplikasi.</p>
          <p><strong>Mengunduh.</strong> Laporan setiap bulan bisa diunduh dalam format Excel.</p>
          <p><strong>Menghapus.</strong> Ketuk foto profil di pojok kanan atas aplikasi, lalu pilih <strong>Hapus Akun</strong>. Akun dan semua catatan keuangan Anda akan dihapus permanen.</p>
          <p><strong>Pertanyaan atau keberatan.</strong> Hubungi kami di <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary font-bold hover:opacity-80">{CONTACT_EMAIL}</a>.</p>
        </Section>

        <Section title="Perubahan kebijakan">
          <p>Kalau kebijakan ini berubah, tanggal di bagian atas halaman akan diperbarui.</p>
        </Section>
      </article>
    </main>
  );
}

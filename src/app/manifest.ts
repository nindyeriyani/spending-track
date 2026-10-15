import type { MetadataRoute } from "next";

// Disajikan Next.js di /manifest.webmanifest; membuat app bisa di-install ke layar utama (Android/Chrome)
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Spending Track",
    short_name: "Spending",
    description: "Catatan pemasukan, pengeluaran, budget, dan target keuangan",
    lang: "id",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f8fafc",
    theme_color: "#5356ff",
    // Ikon persegi penuh tanpa transparansi; logo cukup kecil di tengah sehingga aman dipotong sebagai maskable
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

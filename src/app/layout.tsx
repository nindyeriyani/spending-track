import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { config } from "@fortawesome/fontawesome-svg-core";
import "@fortawesome/fontawesome-svg-core/styles.css";
import "./globals.css";

// CSS Font Awesome sudah diimpor di atas; jangan disisipkan lagi saat runtime (mencegah ikon berkedip besar)
config.autoAddCss = false;

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Spending Track",
  description: "Catatan pemasukan, pengeluaran, budget, dan target keuangan",
  icons: {
    icon: "/logo-spending-tracker.png",
    apple: { url: "/apple-touch-icon.png", sizes: "180x180" },
  },
  appleWebApp: {
    title: "Spending Track",
    statusBarStyle: "default",
  },
};

// Warna bilah status/judul browser saat app dibuka dari layar utama
export const viewport: Viewport = {
  themeColor: "#5356ff",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}

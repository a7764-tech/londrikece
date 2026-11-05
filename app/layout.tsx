import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Londri Kece — Kasir Laundry",
  description: "Kelola transaksi, antrean, riwayat, laporan, dan tarif laundry Londri Kece.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}

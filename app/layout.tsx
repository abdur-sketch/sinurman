import type { Metadata } from "next";
import "@flaticon/flaticon-uicons/css/regular/rounded.css";
import "./globals.css";
import PwaRegister from "./pwa-register";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ||
      "https://sinurman--sinurman-2026.asia-southeast1.hosted.app",
  ),
  title: "SINURMAN — Sistem Informasi Nurul Iman",
  description:
    "Platform terpadu untuk memantau perkembangan, tahfidz, ibadah, kesehatan, dan keuangan santri Pondok Pesantren Nurul Iman.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  openGraph: {
    title: "SINURMAN — Sistem Informasi Nurul Iman",
    description:
      "Platform terpadu untuk memantau perkembangan santri, tahfidz, ibadah, kesehatan, dan keuangan.",
    type: "website",
    images: [
      { url: "/og.png", width: 1200, height: 630, alt: "Dashboard SINURMAN" },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "SINURMAN — Sistem Informasi Nurul Iman",
    description: "Tumbuh, terpantau, terhubung.",
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body>{children}<PwaRegister /></body>
    </html>
  );
}

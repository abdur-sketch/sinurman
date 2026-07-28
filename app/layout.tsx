import type { Metadata } from "next";
import "@flaticon/flaticon-uicons/css/regular/rounded.css";
import "./globals.css";

export const metadata: Metadata = {
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
      <body>{children}</body>
    </html>
  );
}

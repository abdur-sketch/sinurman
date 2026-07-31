import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SINURMAN — Sistem Informasi Nurul Iman",
    short_name: "SINURMAN",
    description: "Manajemen pesantren, Portal Wali, PPDB, dan SINURPAY dalam satu aplikasi.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f7fb",
    theme_color: "#0f766e",
    lang: "id",
    orientation: "any",
    categories: ["education", "finance", "productivity"],
    icons: [
      { src: "/favicon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/favicon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}

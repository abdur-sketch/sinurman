import type { Metadata } from "next";
import Link from "next/link";
import BrandMark from "../brand-mark";
import AdminLoginClient from "./login-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Login Pengelola — SINURMAN",
  description: "Akses aman untuk Admin dan pengelola SINURMAN.",
};

export default function AdminLoginPage() {
  return (
    <main className="guardian-login-page">
      <header className="guardian-login-header">
        <Link className="guardian-login-brand" href="/login">
          <BrandMark />
          <div>
            <strong>SINURMAN</strong>
            <small>Panel Pengelola Pesantren</small>
          </div>
        </Link>
        <div className="guardian-login-header-actions">
          <Link className="secondary-button link-button" href="/wali">Portal Wali</Link>
          <Link className="secondary-button link-button" href="/ppdb">PPDB Online</Link>
        </div>
      </header>

      <section className="guardian-login-hero admin-login-hero">
        <div className="guardian-login-copy">
          <span className="guardian-login-eyebrow">AKSES PENGELOLA SINURMAN</span>
          <h1>Kelola pesantren dari satu dashboard.</h1>
          <p>
            Masuk memakai akun Firebase sekolah. Hak akses Admin, Kepala Asrama,
            Musyrif, dan Ustadz tetap dibatasi sesuai perannya.
          </p>
          <AdminLoginClient />
        </div>

        <aside className="guardian-login-guide">
          <span>AKSES TERPISAH</span>
          <h2>Portal sesuai kebutuhan</h2>
          <ol>
            <li><b>1</b><div><strong>Admin & pengelola</strong><p>Masuk di halaman ini untuk mengelola data dan laporan.</p></div></li>
            <li><b>2</b><div><strong>Wali Santri</strong><p>Masuk melalui Portal Wali memakai nomor HP dan PIN.</p></div></li>
            <li><b>3</b><div><strong>Masyarakat umum</strong><p>Mengakses PPDB Online tanpa membuka dashboard internal.</p></div></li>
          </ol>
          <div className="guardian-login-help">
            <strong>Pertama kali masuk?</strong>
            <p>Klik “Lupa / buat kata sandi”, lalu buka email dari Firebase.</p>
          </div>
        </aside>
      </section>
    </main>
  );
}

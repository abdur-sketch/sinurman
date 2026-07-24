import type { Metadata } from "next";
import Link from "next/link";
import { getChatGPTUser } from "../chatgpt-auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Portal Wali Santri — SINURMAN",
  description:
    "Akses laporan perkembangan anak yang terhubung dengan akun wali di SINURMAN.",
};

export default async function GuardianLoginPage() {
  const user = await getChatGPTUser();

  return (
    <main className="guardian-login-page">
      <header className="guardian-login-header">
        <Link className="guardian-login-brand" href="/wali">
          <span>ن</span>
          <div>
            <strong>SINURMAN</strong>
            <small>Portal Wali Santri Nurul Iman</small>
          </div>
        </Link>
        <Link className="secondary-button link-button" href="/ppdb">
          Penerimaan Santri Baru
        </Link>
      </header>

      <section className="guardian-login-hero">
        <div className="guardian-login-copy">
          <span className="guardian-login-eyebrow">AKSES KHUSUS WALI SANTRI</span>
          <h1>Laporan anak, aman dalam satu portal.</h1>
          <p>
            SINURMAN mencocokkan email akun Anda dengan email wali pada data
            santri. Setelah masuk, Anda hanya dapat melihat anak yang memang
            terhubung dengan email tersebut.
          </p>

          {user ? (
            <div className="guardian-login-session">
              <span>Akun yang sedang aktif</span>
              <strong>{user.displayName}</strong>
              <small>{user.email}</small>
              <Link className="primary-button link-button" href="/">
                Buka Portal Wali →
              </Link>
            </div>
          ) : (
            <div className="guardian-login-actions">
              <a
                className="primary-button link-button guardian-login-primary"
                href="/signin-with-chatgpt?return_to=%2F"
              >
                Masuk ke Portal Wali →
              </a>
              <small>Gunakan email yang didaftarkan oleh Admin pesantren.</small>
            </div>
          )}

          <div className="guardian-security-note">
            <span>✓</span>
            <p>
              Data Admin, data santri lain, dan modul pengelolaan pesantren
              tidak tersedia untuk akun Wali Santri.
            </p>
          </div>
        </div>

        <aside className="guardian-login-guide">
          <span>CARA MASUK</span>
          <h2>Tiga langkah sederhana</h2>
          <ol>
            <li>
              <b>1</b>
              <div>
                <strong>Pastikan email sudah terdaftar</strong>
                <p>
                  Admin mengisi kolom “Email akun wali” pada Data Santri dengan
                  email milik Anda.
                </p>
              </div>
            </li>
            <li>
              <b>2</b>
              <div>
                <strong>Masuk memakai email yang sama</strong>
                <p>
                  Tekan tombol masuk, lalu gunakan akun ChatGPT dengan alamat
                  email tersebut.
                </p>
              </div>
            </li>
            <li>
              <b>3</b>
              <div>
                <strong>Lihat laporan anak</strong>
                <p>
                  Sistem membuka Portal Wali dan menampilkan anak yang terhubung
                  secara otomatis.
                </p>
              </div>
            </li>
          </ol>
          <div className="guardian-login-help">
            <strong>Anak belum muncul?</strong>
            <p>
              Hubungi Admin pesantren dan kirimkan nama santri serta email yang
              Anda pakai untuk masuk.
            </p>
            {user && <code>{user.email}</code>}
          </div>
        </aside>
      </section>

      <section className="guardian-login-features">
        {[
          ["Perkembangan", "Tahfidz, mutaba’ah, akademik, dan karakter."],
          ["Kehadiran", "Absensi, perizinan, kesehatan, dan kegiatan."],
          ["Keuangan", "Tagihan, tabungan, saldo, serta belanja kantin."],
        ].map(([title, copy], index) => (
          <article key={title}>
            <i>{["◫", "✓", "Rp"][index]}</i>
            <div>
              <strong>{title}</strong>
              <p>{copy}</p>
            </div>
          </article>
        ))}
      </section>

      <footer className="guardian-login-footer">
        © 2026 Pondok Pesantren Nurul Iman · Portal Wali SINURMAN
      </footer>
    </main>
  );
}

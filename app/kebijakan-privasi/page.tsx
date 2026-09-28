import BrandMark from "../brand-mark";
import Link from "next/link";

export default function PrivacyPage() {
  return <main className="public-info-page">
    <header className="public-info-header"><Link href="/"><BrandMark/><strong>SINURMAN</strong></Link><Link href="/ppdb">Kembali ke SPMB</Link></header>
    <article className="public-info-card"><span className="section-kicker">DOKUMEN PUBLIK</span><h1>Kebijakan Privasi</h1><p className="lead">SINURMAN menghormati privasi santri, wali santri, dan seluruh pengguna aplikasi.</p>
      <h2>Data yang kami kelola</h2><p>Data identitas santri, data wali, presensi, akademik, kesehatan, keuangan, dokumen SPMB, serta aktivitas akun dikelola hanya untuk layanan pendidikan dan operasional pesantren.</p>
      <h2>Keamanan dan akses</h2><p>Akses dibatasi berdasarkan peran. Dokumen disimpan pada layanan Firebase dan aktivitas penting dicatat pada audit log. Wali santri hanya dapat melihat data anak yang terhubung dengan akunnya.</p>
      <h2>Hak pengguna</h2><p>Pengguna dapat meminta koreksi data melalui admin pesantren. Permintaan penghapusan atau ekspor data diproses setelah verifikasi identitas.</p>
      <h2>Kontak pengelola</h2><p>Isi data resmi berikut sebelum kebijakan ini dipublikasikan sebagai dokumen final.</p>
      <dl className="privacy-contact"><div><dt>Pengelola</dt><dd>[ISI NAMA PENGELOLA RESMI]</dd></div><div><dt>Lembaga</dt><dd>[ISI NAMA LEMBAGA RESMI]</dd></div><div><dt>Alamat</dt><dd>[ISI ALAMAT RESMI PESANTREN]</dd></div><div><dt>Email privasi</dt><dd>[ISI EMAIL PRIVASI RESMI]</dd></div><div><dt>Nomor kontak</dt><dd>[ISI NOMOR KONTAK RESMI]</dd></div><div><dt>Kanal permintaan data</dt><dd>[ISI PROSEDUR/KANAL PERMINTAAN DATA]</dd></div></dl>
      <small>Terakhir diperbarui: [ISI TANGGAL BERLAKU]</small>
    </article>
  </main>;
}

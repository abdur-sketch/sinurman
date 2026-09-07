import BrandMark from "../brand-mark";

export default function PrivacyPage() {
  return <main className="public-info-page">
    <header className="public-info-header"><a href="/"><BrandMark/><strong>SINURMAN</strong></a><a href="/ppdb">Kembali ke SPMB</a></header>
    <article className="public-info-card"><span className="section-kicker">DOKUMEN PUBLIK</span><h1>Kebijakan Privasi</h1><p className="lead">SINURMAN menghormati privasi santri, wali santri, dan seluruh pengguna aplikasi.</p>
      <h2>Data yang kami kelola</h2><p>Data identitas santri, data wali, presensi, akademik, kesehatan, keuangan, dokumen SPMB, serta aktivitas akun dikelola hanya untuk layanan pendidikan dan operasional pesantren.</p>
      <h2>Keamanan dan akses</h2><p>Akses dibatasi berdasarkan peran. Dokumen disimpan pada layanan Firebase dan aktivitas penting dicatat pada audit log. Wali santri hanya dapat melihat data anak yang terhubung dengan akunnya.</p>
      <h2>Hak pengguna</h2><p>Pengguna dapat meminta koreksi data melalui admin pesantren. Permintaan penghapusan atau ekspor data diproses setelah verifikasi identitas.</p>
      <h2>Kontak</h2><p>Untuk pertanyaan privasi, hubungi administrator pesantren melalui pusat bantuan di dalam aplikasi.</p>
      <small>Terakhir diperbarui: 7 September 2026</small>
    </article>
  </main>;
}

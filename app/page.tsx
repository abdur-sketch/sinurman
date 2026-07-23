"use client";

import { useMemo, useState } from "react";

type Role = "Admin" | "Ustadz" | "Wali Santri";
type PageKey =
  | "dashboard"
  | "santri"
  | "tahfidz"
  | "mutabaah"
  | "kesehatan"
  | "keuangan"
  | "karakter"
  | "inventaris"
  | "pengumuman"
  | "laporan";

const navGroups: { label: string; items: { key: PageKey; icon: string; label: string }[] }[] = [
  {
    label: "UTAMA",
    items: [
      { key: "dashboard", icon: "⌂", label: "Dashboard" },
      { key: "santri", icon: "♙", label: "Data Santri" },
    ],
  },
  {
    label: "AKADEMIK & PEMBINAAN",
    items: [
      { key: "tahfidz", icon: "◫", label: "Tahfidz" },
      { key: "mutabaah", icon: "✓", label: "Mutaba’ah" },
      { key: "karakter", icon: "☆", label: "Rapor Karakter" },
    ],
  },
  {
    label: "LAYANAN SANTRI",
    items: [
      { key: "kesehatan", icon: "✚", label: "Kesehatan" },
      { key: "keuangan", icon: "Rp", label: "Keuangan" },
      { key: "inventaris", icon: "◇", label: "Inventaris" },
    ],
  },
  {
    label: "INFORMASI",
    items: [
      { key: "pengumuman", icon: "◉", label: "Pengumuman" },
      { key: "laporan", icon: "▥", label: "Laporan" },
    ],
  },
];

const pageTitles: Record<PageKey, { title: string; subtitle: string }> = {
  dashboard: { title: "Assalamu’alaikum, Ahmad 👋", subtitle: "Berikut ringkasan perkembangan pesantren hari ini." },
  santri: { title: "Data Santri", subtitle: "Kelola profil, kelas, kamar, dan status seluruh santri." },
  tahfidz: { title: "Tahfidz & Hafalan", subtitle: "Pantau target, setoran, dan capaian hafalan santri." },
  mutabaah: { title: "Mutaba’ah Ibadah", subtitle: "Rekap pelaksanaan ibadah dan kegiatan harian." },
  kesehatan: { title: "Kesehatan Santri", subtitle: "Catatan pemeriksaan, keluhan, dan tindak lanjut kesehatan." },
  keuangan: { title: "Keuangan", subtitle: "Kelola SPP, uang saku, dan riwayat transaksi." },
  karakter: { title: "Rapor Karakter", subtitle: "Evaluasi adab, kedisiplinan, kemandirian, dan tanggung jawab." },
  inventaris: { title: "Inventaris", subtitle: "Pantau aset, lokasi, kondisi, dan stok pesantren." },
  pengumuman: { title: "Pengumuman", subtitle: "Informasi terbaru untuk santri, wali, dan pengurus." },
  laporan: { title: "Pusat Laporan", subtitle: "Unduh dan tinjau laporan operasional pesantren." },
};

const students = [
  { name: "Muhammad Fikri", nis: "SN-240181", class: "VIII A", room: "Ibnu Sina 03", status: "Aktif", avatar: "MF" },
  { name: "Ahmad Fauzan", nis: "SN-240182", class: "VIII A", room: "Ibnu Sina 03", status: "Aktif", avatar: "AF" },
  { name: "Rizky Maulana", nis: "SN-240194", class: "VIII B", room: "Al-Farabi 02", status: "Aktif", avatar: "RM" },
  { name: "Nabil Hidayat", nis: "SN-240207", class: "VII C", room: "Al-Khawarizmi 01", status: "Izin", avatar: "NH" },
  { name: "Faris Abdullah", nis: "SN-240212", class: "IX A", room: "Ibnu Khaldun 02", status: "Aktif", avatar: "FA" },
];

const money = new Intl.NumberFormat("id-ID");

function MiniIcon({ children, tone = "blue" }: { children: React.ReactNode; tone?: string }) {
  return <span className={`mini-icon ${tone}`}>{children}</span>;
}

function Sparkline({ values, color = "blue" }: { values: number[]; color?: string }) {
  const max = Math.max(...values);
  return (
    <div className={`sparkline ${color}`} aria-hidden="true">
      {values.map((value, index) => <span key={index} style={{ height: `${Math.max(18, (value / max) * 100)}%` }} />)}
    </div>
  );
}

function Progress({ value, tone = "blue" }: { value: number; tone?: string }) {
  return <div className="progress-track"><span className={tone} style={{ width: `${value}%` }} /></div>;
}

function Status({ children, tone = "green" }: { children: React.ReactNode; tone?: string }) {
  return <span className={`status ${tone}`}><i />{children}</span>;
}

function Overview() {
  return (
    <>
      <section className="stats-grid">
        <article className="stat-card">
          <div className="stat-copy"><span>Total Santri</span><strong>486</strong><small className="up">↑ 8,2% <b>dari semester lalu</b></small></div>
          <MiniIcon tone="blue">♙</MiniIcon><Sparkline values={[32, 44, 38, 58, 51, 68, 72, 83]} />
        </article>
        <article className="stat-card">
          <div className="stat-copy"><span>Setoran Hari Ini</span><strong>142</strong><small className="up">↑ 12,5% <b>dari kemarin</b></small></div>
          <MiniIcon tone="green">◫</MiniIcon><Sparkline color="green" values={[48, 31, 58, 45, 70, 62, 75, 88]} />
        </article>
        <article className="stat-card">
          <div className="stat-copy"><span>Kehadiran</span><strong>96,8%</strong><small className="down">↓ 0,4% <b>dari kemarin</b></small></div>
          <MiniIcon tone="amber">✓</MiniIcon><Sparkline color="amber" values={[82, 75, 90, 84, 78, 92, 86, 80]} />
        </article>
        <article className="stat-card">
          <div className="stat-copy"><span>Tagihan Tertagih</span><strong>Rp128jt</strong><small className="up">↑ 4,8% <b>bulan ini</b></small></div>
          <MiniIcon tone="violet">Rp</MiniIcon><Sparkline color="violet" values={[24, 40, 35, 56, 48, 68, 62, 78]} />
        </article>
      </section>

      <section className="dashboard-grid">
        <article className="card chart-card">
          <header className="card-header">
            <div><h3>Perkembangan Hafalan</h3><p>Rata-rata capaian juz seluruh santri</p></div>
            <select aria-label="Periode grafik"><option>6 Bulan Terakhir</option><option>Tahun Ini</option></select>
          </header>
          <div className="legend"><span><i className="legend-dot blue" />Target</span><span><i className="legend-dot green" />Tercapai</span></div>
          <div className="bar-chart">
            {[{m:"Feb",a:58,b:49},{m:"Mar",a:70,b:62},{m:"Apr",a:65,b:57},{m:"Mei",a:79,b:72},{m:"Jun",a:85,b:78},{m:"Jul",a:92,b:86}].map((x) => (
              <div className="bar-group" key={x.m}><div className="bars"><span style={{height:`${x.a}%`}} /><span style={{height:`${x.b}%`}} /></div><small>{x.m}</small></div>
            ))}
          </div>
        </article>

        <article className="card activity-card">
          <header className="card-header"><div><h3>Aktivitas Terbaru</h3><p>Pembaruan hari ini</p></div><button className="text-button">Lihat semua</button></header>
          <div className="timeline">
            {[
              ["green","✓","Setoran diterima","Muhammad Fikri menyetor QS. Al-Mulk","10 menit lalu"],
              ["blue","Rp","Pembayaran SPP","Pembayaran Juli dari wali Ahmad Fauzan","35 menit lalu"],
              ["amber","✚","Pemeriksaan kesehatan","Nabil diperiksa karena demam ringan","1 jam lalu"],
              ["violet","☆","Nilai karakter diperbarui","Ust. Hasan memperbarui 12 rapor","2 jam lalu"],
            ].map(([tone,icon,title,desc,time]) => (
              <div className="timeline-item" key={title}><MiniIcon tone={tone}>{icon}</MiniIcon><div><strong>{title}</strong><p>{desc}</p><small>{time}</small></div></div>
            ))}
          </div>
        </article>
      </section>

      <section className="dashboard-grid lower">
        <article className="card compact-list">
          <header className="card-header"><div><h3>Target Tahfidz Kelas</h3><p>Progres bulan Juli 2026</p></div><button className="more">•••</button></header>
          {[
            ["Kelas VII A","Juz 30",82,"green"],["Kelas VII B","Juz 30",74,"blue"],["Kelas VIII A","Juz 29",68,"amber"],["Kelas IX A","Juz 28",91,"violet"]
          ].map(([label,target,value,tone]) => <div className="progress-row" key={String(label)}><div><strong>{label}</strong><small>{target}</small></div><Progress value={Number(value)} tone={String(tone)} /><b>{value}%</b></div>)}
        </article>
        <article className="card announcement-card">
          <header className="card-header"><div><h3>Pengumuman</h3><p>Informasi penting pesantren</p></div><button className="text-button">Semua</button></header>
          <div className="announcement-feature"><span className="date-box"><b>26</b>JUL</span><div><Status tone="blue">Akademik</Status><h4>Jadwal Ujian Tahfidz Semester</h4><p>Ujian dilaksanakan mulai 29 Juli 2026.</p></div></div>
          <div className="announcement-mini"><span>24 Jul</span><p>Jadwal kunjungan wali santri bulan Agustus</p></div>
          <div className="announcement-mini"><span>21 Jul</span><p>Daftar perlengkapan kegiatan Muharram</p></div>
        </article>
      </section>
    </>
  );
}

function TahfidzPage() {
  const rows = [
    ["Muhammad Fikri","Al-Mulk: 1–15","15 ayat","Mumtaz","Hari ini, 07.25"],
    ["Ahmad Fauzan","Al-Qalam: 1–12","12 ayat","Jayyid Jiddan","Hari ini, 07.18"],
    ["Rizky Maulana","Al-Haqqah: 20–30","11 ayat","Jayyid","Hari ini, 07.05"],
    ["Faris Abdullah","Al-Ma’arij: 1–18","18 ayat","Mumtaz","Kemarin, 16.40"],
  ];
  return (
    <>
      <section className="stats-grid three">
        <article className="metric-card"><MiniIcon tone="green">✓</MiniIcon><div><span>Setoran Hari Ini</span><strong>142</strong><small>126 diterima</small></div></article>
        <article className="metric-card"><MiniIcon tone="blue">◫</MiniIcon><div><span>Total Hafalan Bulan Ini</span><strong>3.284</strong><small>ayat disetorkan</small></div></article>
        <article className="metric-card"><MiniIcon tone="amber">☆</MiniIcon><div><span>Santri Sesuai Target</span><strong>78%</strong><small>379 dari 486 santri</small></div></article>
      </section>
      <section className="card data-card">
        <header className="card-header"><div><h3>Setoran Hafalan Terbaru</h3><p>Daftar setoran yang telah diperiksa ustadz</p></div><button className="primary-button">+ Input Setoran</button></header>
        <div className="table-wrap"><table><thead><tr><th>Santri</th><th>Surat / Ayat</th><th>Jumlah</th><th>Penilaian</th><th>Waktu</th><th /></tr></thead>
          <tbody>{rows.map((r,i)=><tr key={r[0]}><td><div className="person"><span>{r[0].split(" ").map(x=>x[0]).slice(0,2).join("")}</span><strong>{r[0]}</strong></div></td><td>{r[1]}</td><td>{r[2]}</td><td><Status tone={i===2?"amber":"green"}>{r[3]}</Status></td><td className="muted">{r[4]}</td><td><button className="more">•••</button></td></tr>)}</tbody>
        </table></div>
      </section>
    </>
  );
}

function StudentsPage() {
  return (
    <section className="card data-card">
      <header className="card-header responsive"><div><h3>Daftar Santri</h3><p>486 santri terdaftar pada tahun ajaran 2026/2027</p></div><div className="header-actions"><button className="secondary-button">⇩ Ekspor</button><button className="primary-button">+ Tambah Santri</button></div></header>
      <div className="filters"><div className="search-field">⌕ <input placeholder="Cari nama atau NIS..." /></div><select><option>Semua Kelas</option><option>VII</option><option>VIII</option><option>IX</option></select><select><option>Semua Status</option><option>Aktif</option><option>Izin</option></select></div>
      <div className="table-wrap"><table><thead><tr><th>Nama Santri</th><th>NIS</th><th>Kelas</th><th>Kamar</th><th>Status</th><th /></tr></thead>
        <tbody>{students.map(s=><tr key={s.nis}><td><div className="person"><span>{s.avatar}</span><strong>{s.name}</strong></div></td><td className="muted">{s.nis}</td><td>{s.class}</td><td>{s.room}</td><td><Status tone={s.status==="Aktif"?"green":"amber"}>{s.status}</Status></td><td><button className="more">•••</button></td></tr>)}</tbody>
      </table></div>
      <footer className="table-footer"><span>Menampilkan 1–5 dari 486 santri</span><div><button>‹</button><button className="active">1</button><button>2</button><button>3</button><button>›</button></div></footer>
    </section>
  );
}

function MutabaahPage() {
  const habits = [["Sholat Subuh Berjamaah",96],["Dzikir Pagi",89],["Sholat Dhuha",84],["Tilawah Harian",92],["Kajian Ba’da Maghrib",94],["Qiyamul Lail",71]];
  return (
    <>
      <section className="summary-banner"><div><span>Rekap Hari Ini</span><strong>92,6%</strong><p>450 dari 486 santri telah mengisi mutaba’ah</p></div><div className="donut"><span>93<small>%</small></span></div></section>
      <section className="dashboard-grid">
        <article className="card compact-list"><header className="card-header"><div><h3>Capaian Kegiatan</h3><p>Kamis, 23 Juli 2026</p></div><button className="secondary-button">Ubah tanggal</button></header>
          {habits.map(([h,v],i)=><div className="progress-row habit" key={String(h)}><div><strong>{h}</strong><small>{Math.round(Number(v)*4.86)} santri</small></div><Progress value={Number(v)} tone={i===5?"amber":"green"} /><b>{v}%</b></div>)}
        </article>
        <article className="card"><header className="card-header"><div><h3>Perlu Perhatian</h3><p>Santri dengan capaian di bawah 70%</p></div></header>
          <div className="attention-list">{students.slice(2).map((s,i)=><div key={s.nis}><span className="avatar">{s.avatar}</span><div><strong>{s.name}</strong><small>{s.class} · {62+i*3}% tercapai</small></div><button>Hubungi</button></div>)}</div>
        </article>
      </section>
    </>
  );
}

function HealthPage() {
  return (
    <>
      <section className="stats-grid three">
        <article className="metric-card"><MiniIcon tone="green">✓</MiniIcon><div><span>Kondisi Sehat</span><strong>473</strong><small>97,3% total santri</small></div></article>
        <article className="metric-card"><MiniIcon tone="amber">✚</MiniIcon><div><span>Dalam Perawatan</span><strong>9</strong><small>Keluhan ringan</small></div></article>
        <article className="metric-card"><MiniIcon tone="red">!</MiniIcon><div><span>Dirujuk</span><strong>4</strong><small>Fasilitas kesehatan</small></div></article>
      </section>
      <section className="card data-card"><header className="card-header"><div><h3>Kunjungan Klinik Terbaru</h3><p>Catatan pemeriksaan tujuh hari terakhir</p></div><button className="primary-button">+ Pemeriksaan Baru</button></header>
        <div className="table-wrap"><table><thead><tr><th>Santri</th><th>Keluhan</th><th>Diagnosis</th><th>Penanganan</th><th>Status</th></tr></thead><tbody>
          {[["Nabil Hidayat","Demam & pusing","Demam ringan","Istirahat, paracetamol","Dipantau"],["Rizky Maulana","Batuk","Iritasi tenggorokan","Obat batuk","Membaik"],["Faris Abdullah","Nyeri pergelangan","Terkilir ringan","Kompres & perban","Istirahat"]].map((r,i)=><tr key={r[0]}><td><strong>{r[0]}</strong></td><td>{r[1]}</td><td>{r[2]}</td><td className="muted">{r[3]}</td><td><Status tone={i===0?"amber":"green"}>{r[4]}</Status></td></tr>)}
        </tbody></table></div></section>
    </>
  );
}

function FinancePage() {
  return (
    <>
      <section className="stats-grid three">
        <article className="metric-card"><MiniIcon tone="blue">Rp</MiniIcon><div><span>SPP Tertagih</span><strong>Rp128,4jt</strong><small>92% bulan Juli</small></div></article>
        <article className="metric-card"><MiniIcon tone="green">✓</MiniIcon><div><span>Uang Saku Masuk</span><strong>Rp46,8jt</strong><small>486 rekening aktif</small></div></article>
        <article className="metric-card"><MiniIcon tone="amber">!</MiniIcon><div><span>Belum Dibayar</span><strong>Rp11,2jt</strong><small>38 wali santri</small></div></article>
      </section>
      <section className="dashboard-grid">
        <article className="card balance-card"><span>Saldo Uang Saku</span><strong>Rp 1.275.000</strong><p>Muhammad Fikri · SN-240181</p><div><button className="primary-button">+ Tambah Saldo</button><button className="secondary-button">Lihat Mutasi</button></div></article>
        <article className="card"><header className="card-header"><div><h3>Pengeluaran Terbesar</h3><p>Bulan Juli 2026</p></div></header>
          {[["Koperasi Santri","Rp 8.420.000",76],["Kantin","Rp 6.180.000",58],["Laundry","Rp 3.750.000",36]].map((x)=><div className="expense" key={String(x[0])}><div><strong>{x[0]}</strong><span>{x[1]}</span></div><Progress value={Number(x[2])} tone="blue" /></div>)}
        </article>
      </section>
    </>
  );
}

function CharacterPage() {
  const traits = [["Adab & Akhlak",92,"green"],["Kedisiplinan",86,"blue"],["Kemandirian",81,"amber"],["Tanggung Jawab",88,"violet"],["Kebersihan",84,"green"]];
  return (
    <section className="dashboard-grid">
      <article className="card character-profile"><span className="large-avatar">MF</span><h3>Muhammad Fikri</h3><p>VIII A · Ibnu Sina 03</p><strong>A</strong><small>Predikat: Sangat Baik</small><button className="secondary-button">Pilih Santri</button></article>
      <article className="card compact-list"><header className="card-header"><div><h3>Penilaian Karakter</h3><p>Semester Ganjil 2026/2027</p></div><button className="primary-button">Input Nilai</button></header>
        {traits.map(([t,v,c])=><div className="trait-row" key={String(t)}><div><strong>{t}</strong><small>{Number(v)>=90?"Istiqamah":"Baik"}</small></div><Progress value={Number(v)} tone={String(c)} /><b>{v}</b></div>)}
        <div className="teacher-note"><span>“</span><p>Fikri menunjukkan perkembangan adab yang sangat baik dan konsisten membantu teman satu kamar.</p><small>— Ustadz Hasan, Wali Kelas</small></div>
      </article>
    </section>
  );
}

function InventoryPage() {
  const assets = [["Ranjang Susun","Asrama","248 unit","Baik"],["Lemari Santri","Asrama","486 unit","Baik"],["Proyektor","Ruang Kelas","14 unit","Perawatan"],["Kitab Fathul Qarib","Perpustakaan","112 eks","Baik"],["Dispenser","Asrama","22 unit","Perbaikan"]];
  return <section className="card data-card"><header className="card-header"><div><h3>Daftar Inventaris</h3><p>882 item pada 24 lokasi</p></div><button className="primary-button">+ Tambah Barang</button></header><div className="table-wrap"><table><thead><tr><th>Nama Barang</th><th>Lokasi</th><th>Jumlah</th><th>Kondisi</th><th /></tr></thead><tbody>{assets.map((r,i)=><tr key={r[0]}><td><strong>{r[0]}</strong></td><td>{r[1]}</td><td>{r[2]}</td><td><Status tone={i===2?"amber":i===4?"red":"green"}>{r[3]}</Status></td><td><button className="more">•••</button></td></tr>)}</tbody></table></div></section>;
}

function AnnouncementsPage() {
  const items = [
    ["26","JUL","Akademik","Jadwal Ujian Tahfidz Semester","Ujian tahfidz semester ganjil akan dilaksanakan mulai 29 Juli 2026.","blue"],
    ["24","JUL","Kunjungan","Jadwal Kunjungan Wali Santri","Kunjungan bulan Agustus dibuka pada hari Ahad pekan pertama dan ketiga.","green"],
    ["21","JUL","Kegiatan","Peringatan Tahun Baru Hijriah","Seluruh santri mengikuti pawai dan kajian Muharram pada Sabtu pagi.","violet"],
  ];
  return <section className="card announcements-page"><header className="card-header"><div><h3>Semua Pengumuman</h3><p>Informasi resmi Pondok Pesantren Nurul Iman</p></div><button className="primary-button">+ Buat Pengumuman</button></header>{items.map(x=><article key={x[3]}><span className="date-box"><b>{x[0]}</b>{x[1]}</span><div><Status tone={x[5]}>{x[2]}</Status><h3>{x[3]}</h3><p>{x[4]}</p><small>Dipublikasikan oleh Admin · 09.00 WIB</small></div><button className="more">•••</button></article>)}</section>;
}

function ReportsPage() {
  const reports = [["Laporan Perkembangan Santri","Akademik & karakter","PDF","23 Jul 2026"],["Rekap Setoran Tahfidz","Hafalan per kelas","XLSX","23 Jul 2026"],["Laporan Keuangan Bulanan","SPP dan uang saku","PDF","20 Jul 2026"],["Rekap Kesehatan Santri","Kunjungan klinik","XLSX","18 Jul 2026"]];
  return <><section className="report-hero"><div><span>PUSAT DATA SINURMAN</span><h2>Laporan pesantren, siap dalam beberapa klik.</h2><p>Pilih periode dan jenis laporan, kemudian unduh dalam format yang Anda butuhkan.</p></div><button className="light-button">Buat Laporan Baru →</button></section><section className="report-grid">{reports.map((r,i)=><article className="card report-card" key={r[0]}><MiniIcon tone={["blue","green","violet","amber"][i]}>{r[2]==="PDF"?"▥":"▦"}</MiniIcon><div><h3>{r[0]}</h3><p>{r[1]}</p><span>{r[2]} · Diperbarui {r[3]}</span></div><button>⇩</button></article>)}</section></>;
}

function LoginModal({ onClose, onLogin }: { onClose: () => void; onLogin: (role: Role) => void }) {
  const [selected, setSelected] = useState<Role>("Admin");
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="login-modal" onMouseDown={e=>e.stopPropagation()}>
    <button className="modal-close" onClick={onClose}>×</button>
    <div className="login-brand"><span>ن</span><div><strong>SINURMAN</strong><small>Sistem Informasi Nurul Iman</small></div></div>
    <h2>Selamat datang kembali</h2><p>Masuk ke akun demo sesuai peran Anda.</p>
    <div className="role-picker">{(["Admin","Ustadz","Wali Santri"] as Role[]).map(r=><button key={r} className={selected===r?"active":""} onClick={()=>setSelected(r)}><span>{r==="Admin"?"A":r==="Ustadz"?"U":"W"}</span>{r}</button>)}</div>
    <label>Email atau username<input defaultValue={selected==="Admin"?"admin@sinurman.id":selected==="Ustadz"?"ustadz.hasan":"wali.fikri"} /></label>
    <label>Kata sandi<div className="password"><input type="password" defaultValue="sinurman2026" /><button>◉</button></div></label>
    <div className="login-options"><label><input type="checkbox" defaultChecked /> Ingat saya</label><button>Lupa kata sandi?</button></div>
    <button className="login-button" onClick={()=>onLogin(selected)}>Masuk sebagai {selected} →</button>
    <small className="demo-note">Akun ini hanya untuk keperluan demonstrasi.</small>
  </div></div>;
}

export default function Home() {
  const [page, setPage] = useState<PageKey>("dashboard");
  const [role, setRole] = useState<Role>("Admin");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [dark, setDark] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [toast, setToast] = useState("");
  const title = pageTitles[page];

  const content = useMemo(() => {
    switch (page) {
      case "dashboard": return <Overview />;
      case "santri": return <StudentsPage />;
      case "tahfidz": return <TahfidzPage />;
      case "mutabaah": return <MutabaahPage />;
      case "kesehatan": return <HealthPage />;
      case "keuangan": return <FinancePage />;
      case "karakter": return <CharacterPage />;
      case "inventaris": return <InventoryPage />;
      case "pengumuman": return <AnnouncementsPage />;
      case "laporan": return <ReportsPage />;
    }
  }, [page]);

  function selectPage(key: PageKey) {
    setPage(key);
    setSidebarOpen(false);
  }

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  }

  return (
    <div className={`app-shell ${dark ? "dark" : ""}`}>
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="brand"><span className="brand-mark">ن</span><div><strong>SINURMAN</strong><small>Nurul Iman</small></div><button className="close-sidebar" onClick={()=>setSidebarOpen(false)}>×</button></div>
        <nav>{navGroups.map(group=><div className="nav-group" key={group.label}><span className="nav-label">{group.label}</span>{group.items.map(item=><button key={item.key} className={page===item.key?"active":""} onClick={()=>selectPage(item.key)}><i>{item.icon}</i><span>{item.label}</span>{item.key==="pengumuman"&&<b>3</b>}</button>)}</div>)}</nav>
        <div className="sidebar-help"><span>?</span><div><strong>Butuh bantuan?</strong><small>Hubungi tim SINURMAN</small></div></div>
        <div className="sidebar-footer"><span>© 2026 SINURMAN</span><small>Versi 1.0.0</small></div>
      </aside>
      {sidebarOpen && <button className="mobile-overlay" aria-label="Tutup menu" onClick={()=>setSidebarOpen(false)} />}

      <div className="main-area">
        <header className="topbar">
          <button className="menu-button" onClick={()=>setSidebarOpen(true)} aria-label="Buka menu">☰</button>
          <div className="top-search">⌕<input placeholder="Cari santri, laporan, atau menu..." /><kbd>⌘ K</kbd></div>
          <div className="top-actions">
            <button onClick={()=>setDark(!dark)} aria-label="Ubah tema">{dark?"☀":"☾"}</button>
            <button className="notification" onClick={()=>notify("Tidak ada notifikasi baru.")} aria-label="Notifikasi">♢<i /></button>
            <span className="divider" />
            <div className="profile-wrap"><button className="profile-button" onClick={()=>setProfileOpen(!profileOpen)}><span>AH</span><div><strong>Ahmad Hidayat</strong><small>{role}</small></div><i>⌄</i></button>
              {profileOpen&&<div className="profile-menu"><button onClick={()=>{setShowLogin(true);setProfileOpen(false)}}>⇄ Ganti peran demo</button><button onClick={()=>notify("Profil pengguna dibuka.")}>♙ Profil saya</button><button onClick={()=>notify("Pengaturan dibuka.")}>⚙ Pengaturan</button></div>}
            </div>
          </div>
        </header>

        <main>
          <div className="page-heading"><div><p>Beranda <span>/</span> {page==="dashboard"?"Ringkasan":title.title}</p><h1>{title.title}</h1><span>{title.subtitle}</span></div><div className="heading-actions"><button className="secondary-button" onClick={()=>notify("Data terbaru berhasil dimuat.")}>↻ Perbarui</button><button className="primary-button" onClick={()=>selectPage("laporan")}>▥ Buat Laporan</button></div></div>
          {content}
          <footer className="page-footer"><span>© 2026 Pondok Pesantren Nurul Iman</span><div><button>Kebijakan Privasi</button><button>Bantuan</button></div></footer>
        </main>
      </div>
      <nav className="mobile-nav">
        {[navGroups[0].items[0],navGroups[1].items[0],navGroups[1].items[1],navGroups[2].items[1]].map(item=><button key={item.key} className={page===item.key?"active":""} onClick={()=>selectPage(item.key)}><i>{item.icon}</i><span>{item.label}</span></button>)}
        <button onClick={()=>setSidebarOpen(true)}><i>•••</i><span>Lainnya</span></button>
      </nav>
      {showLogin&&<LoginModal onClose={()=>setShowLogin(false)} onLogin={r=>{setRole(r);setShowLogin(false);notify(`Berhasil masuk sebagai ${r}.`)}} />}
      {toast&&<div className="toast"><span>✓</span>{toast}</div>}
    </div>
  );
}

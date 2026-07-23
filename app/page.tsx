"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Role = "Admin" | "Ustadz" | "Wali Santri";
type Resource = "students" | "tahfidz" | "health" | "transactions" | "characters" | "inventory" | "announcements" | "attendance" | "permits" | "schedules" | "rooms" | "admissions" | "counseling" | "bills" | "users";
type Row = Record<string, string | number | null>;
type AppData = {
  user?: { name: string; email: string; role: Role };
  students: Row[];
  tahfidz: Row[];
  health: Row[];
  transactions: Row[];
  characters: Row[];
  inventory: Row[];
  announcements: Row[];
  notifications: Row[];
  attendance: Row[];
  permits: Row[];
  schedules: Row[];
  rooms: Row[];
  admissions: Row[];
  counseling: Row[];
  bills: Row[];
  users: Row[];
  audit: Row[];
};
type EditorState = { resource: Resource; row?: Row } | null;

const emptyData: AppData = {
  students: [], tahfidz: [], health: [], transactions: [], characters: [],
  inventory: [], announcements: [], notifications: [],
  attendance: [], permits: [], schedules: [], rooms: [], admissions: [],
  counseling: [], bills: [], users: [], audit: [],
};
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
  | "laporan"
  | "absensi"
  | "jadwal"
  | "penerimaan"
  | "konseling"
  | "pengguna"
  | "integrasi"
  | "portalwali";

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
      { key: "absensi", icon: "◷", label: "Absensi & Izin" },
      { key: "jadwal", icon: "▦", label: "Jadwal & Kamar" },
    ],
  },
  {
    label: "LAYANAN SANTRI",
    items: [
      { key: "kesehatan", icon: "✚", label: "Kesehatan" },
      { key: "keuangan", icon: "Rp", label: "Keuangan" },
      { key: "inventaris", icon: "◇", label: "Inventaris" },
      { key: "konseling", icon: "♧", label: "Konseling" },
    ],
  },
  {
    label: "INFORMASI",
    items: [
      { key: "pengumuman", icon: "◉", label: "Pengumuman" },
      { key: "laporan", icon: "▥", label: "Laporan" },
      { key: "penerimaan", icon: "+", label: "Penerimaan Santri" },
      { key: "portalwali", icon: "♙", label: "Portal Wali" },
    ],
  },
  {
    label: "SISTEM",
    items: [
      { key: "pengguna", icon: "⚙", label: "Pengguna & Audit" },
      { key: "integrasi", icon: "↗", label: "Integrasi & Backup" },
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
  absensi: { title: "Absensi & Perizinan", subtitle: "Catat kehadiran dan proses izin santri secara terpadu." },
  jadwal: { title: "Jadwal & Kamar", subtitle: "Kelola pelajaran, ustadz, lokasi, dan hunian santri." },
  penerimaan: { title: "Penerimaan Santri Baru", subtitle: "Pantau pendaftaran, verifikasi, tes, dan kelulusan." },
  konseling: { title: "Konseling & Pelanggaran", subtitle: "Dokumentasikan pembinaan dan tindak lanjut santri." },
  pengguna: { title: "Pengguna & Audit", subtitle: "Atur peran dan pantau seluruh aktivitas penting." },
  integrasi: { title: "Integrasi & Backup", subtitle: "Sambungkan pembayaran, WhatsApp, impor, dan cadangan data." },
  portalwali: { title: "Portal Wali Santri", subtitle: "Ringkasan perkembangan dan layanan untuk orang tua." },
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

function Overview({ data }: { data: AppData }) {
  const paid = data.transactions.filter((x) => x.type === "Masuk").reduce((sum, x) => sum + Number(x.amount || 0), 0);
  return (
    <>
      <section className="stats-grid">
        <article className="stat-card">
          <div className="stat-copy"><span>Total Santri</span><strong>{data.students.length || 486}</strong><small className="up">↑ Data aktif <b>tersimpan permanen</b></small></div>
          <MiniIcon tone="blue">♙</MiniIcon><Sparkline values={[32, 44, 38, 58, 51, 68, 72, 83]} />
        </article>
        <article className="stat-card">
          <div className="stat-copy"><span>Total Setoran</span><strong>{data.tahfidz.length || 142}</strong><small className="up">↑ Sinkron <b>dengan data tahfidz</b></small></div>
          <MiniIcon tone="green">◫</MiniIcon><Sparkline color="green" values={[48, 31, 58, 45, 70, 62, 75, 88]} />
        </article>
        <article className="stat-card">
          <div className="stat-copy"><span>Kehadiran</span><strong>96,8%</strong><small className="down">↓ 0,4% <b>dari kemarin</b></small></div>
          <MiniIcon tone="amber">✓</MiniIcon><Sparkline color="amber" values={[82, 75, 90, 84, 78, 92, 86, 80]} />
        </article>
        <article className="stat-card">
          <div className="stat-copy"><span>Transaksi Masuk</span><strong>Rp{paid ? `${(paid/1000000).toFixed(1)}jt` : "128jt"}</strong><small className="up">↑ Tercatat <b>di buku keuangan</b></small></div>
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

function TahfidzPage({ rows, onAdd, onEdit, onDelete }: { rows: Row[]; onAdd: () => void; onEdit: (row: Row) => void; onDelete: (row: Row) => void }) {
  return (
    <>
      <section className="stats-grid three">
        <article className="metric-card"><MiniIcon tone="green">✓</MiniIcon><div><span>Setoran Hari Ini</span><strong>142</strong><small>126 diterima</small></div></article>
        <article className="metric-card"><MiniIcon tone="blue">◫</MiniIcon><div><span>Total Hafalan Bulan Ini</span><strong>3.284</strong><small>ayat disetorkan</small></div></article>
        <article className="metric-card"><MiniIcon tone="amber">☆</MiniIcon><div><span>Santri Sesuai Target</span><strong>78%</strong><small>379 dari 486 santri</small></div></article>
      </section>
      <section className="card data-card">
        <header className="card-header"><div><h3>Setoran Hafalan Terbaru</h3><p>Daftar setoran tersimpan dan telah diperiksa ustadz</p></div><button className="primary-button" onClick={onAdd}>+ Input Setoran</button></header>
        <div className="table-wrap"><table><thead><tr><th>Santri</th><th>Surat / Ayat</th><th>Jumlah</th><th>Penilaian</th><th>Waktu</th><th /></tr></thead>
          <tbody>{rows.map((r,i)=><tr key={String(r.id)}><td><div className="person"><span>{String(r.student_name).split(" ").map(x=>x[0]).slice(0,2).join("")}</span><strong>{r.student_name}</strong></div></td><td>{r.surah}: {r.verses}</td><td>{r.amount} ayat</td><td><Status tone={i===2?"amber":"green"}>{r.grade}</Status></td><td className="muted">{new Date(String(r.recorded_at)).toLocaleDateString("id-ID")}</td><td><div className="row-actions"><button onClick={()=>onEdit(r)}>Ubah</button><button className="danger-link" onClick={()=>onDelete(r)}>Hapus</button></div></td></tr>)}</tbody>
        </table></div>
      </section>
    </>
  );
}

function StudentsPage({ rows, onAdd, onEdit, onDelete, onCard }: { rows: Row[]; onAdd: () => void; onEdit: (row: Row) => void; onDelete: (row: Row) => void; onCard:(row:Row)=>void }) {
  const [query, setQuery] = useState("");
  const filtered = rows.filter((s) => `${s.name} ${s.nis}`.toLowerCase().includes(query.toLowerCase()));
  return (
    <section className="card data-card">
      <header className="card-header responsive"><div><h3>Daftar Santri</h3><p>{rows.length} santri tersimpan pada tahun ajaran 2026/2027</p></div><div className="header-actions"><a className="secondary-button link-button" href="/api/export?type=students&format=csv">⇩ Excel/CSV</a><button className="primary-button" onClick={onAdd}>+ Tambah Santri</button></div></header>
      <div className="filters"><div className="search-field">⌕ <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Cari nama atau NIS..." /></div><select><option>Semua Kelas</option><option>VII</option><option>VIII</option><option>IX</option></select><select><option>Semua Status</option><option>Aktif</option><option>Izin</option></select></div>
      <div className="table-wrap"><table><thead><tr><th>Nama Santri</th><th>NIS</th><th>Kelas</th><th>Kamar</th><th>Status</th><th /></tr></thead>
        <tbody>{filtered.map(s=><tr key={String(s.id)}><td><div className="person"><span>{String(s.name).split(" ").map(x=>x[0]).slice(0,2).join("")}</span><strong>{s.name}</strong></div></td><td className="muted">{s.nis}</td><td>{s.class_name}</td><td>{s.room}</td><td><Status tone={s.status==="Aktif"?"green":"amber"}>{s.status}</Status></td><td><div className="row-actions"><button onClick={()=>onCard(s)}>QR</button><button onClick={()=>onEdit(s)}>Ubah</button><button className="danger-link" onClick={()=>onDelete(s)}>Hapus</button></div></td></tr>)}</tbody>
      </table></div>
      <footer className="table-footer"><span>Menampilkan {filtered.length} dari {rows.length} santri</span><div><button>‹</button><button className="active">1</button><button>›</button></div></footer>
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

function HealthPage({ rows, onAdd, onEdit, onDelete }: { rows: Row[]; onAdd: () => void; onEdit: (row: Row) => void; onDelete: (row: Row) => void }) {
  return (
    <>
      <section className="stats-grid three">
        <article className="metric-card"><MiniIcon tone="green">✓</MiniIcon><div><span>Kondisi Sehat</span><strong>473</strong><small>97,3% total santri</small></div></article>
        <article className="metric-card"><MiniIcon tone="amber">✚</MiniIcon><div><span>Dalam Perawatan</span><strong>9</strong><small>Keluhan ringan</small></div></article>
        <article className="metric-card"><MiniIcon tone="red">!</MiniIcon><div><span>Dirujuk</span><strong>4</strong><small>Fasilitas kesehatan</small></div></article>
      </section>
      <section className="card data-card"><header className="card-header"><div><h3>Kunjungan Klinik Terbaru</h3><p>{rows.length} catatan pemeriksaan tersimpan</p></div><button className="primary-button" onClick={onAdd}>+ Pemeriksaan Baru</button></header>
        <div className="table-wrap"><table><thead><tr><th>Santri</th><th>Keluhan</th><th>Diagnosis</th><th>Penanganan</th><th>Status</th></tr></thead><tbody>
          {rows.map((r,i)=><tr key={String(r.id)}><td><strong>{r.student_name}</strong></td><td>{r.complaint}</td><td>{r.diagnosis}</td><td className="muted">{r.treatment}</td><td><Status tone={i===0?"amber":"green"}>{r.status}</Status><div className="row-actions"><button onClick={()=>onEdit(r)}>Ubah</button><button className="danger-link" onClick={()=>onDelete(r)}>Hapus</button></div></td></tr>)}
        </tbody></table></div></section>
    </>
  );
}

function FinancePage({ rows, bills, onAdd, onBill, onNotify, onPayment }: { rows: Row[]; bills:Row[]; onAdd: () => void; onBill:()=>void; onNotify: () => void; onPayment:(row:Row)=>void }) {
  const incoming = rows.filter(x=>x.type==="Masuk").reduce((sum,x)=>sum+Number(x.amount||0),0);
  return (
    <>
      <section className="stats-grid three">
        <article className="metric-card"><MiniIcon tone="blue">Rp</MiniIcon><div><span>Pemasukan Tercatat</span><strong>Rp{money.format(incoming)}</strong><small>Data transaksi permanen</small></div></article>
        <article className="metric-card"><MiniIcon tone="green">✓</MiniIcon><div><span>Uang Saku Masuk</span><strong>Rp46,8jt</strong><small>486 rekening aktif</small></div></article>
        <article className="metric-card"><MiniIcon tone="amber">!</MiniIcon><div><span>Belum Dibayar</span><strong>Rp11,2jt</strong><small>38 wali santri</small></div></article>
      </section>
      <section className="dashboard-grid">
        <article className="card balance-card"><span>Kelola Pembayaran & Uang Saku</span><strong>Rp {money.format(incoming)}</strong><p>{rows.length} transaksi tercatat dan siap dilaporkan</p><div><button className="primary-button" onClick={onAdd}>+ Catat Pembayaran</button><button className="secondary-button" onClick={onNotify}>Kirim Pengingat WA</button></div></article>
        <article className="card"><header className="card-header"><div><h3>Transaksi Terbaru</h3><p>SPP, uang saku, dan pengeluaran</p></div><a className="text-button link-button" href="/api/export?type=finance&format=csv">Ekspor</a></header>
          {rows.slice(0,5).map((x)=><div className="expense" key={String(x.id)}><div><strong>{x.student_name} · {x.category}</strong><span>Rp {money.format(Number(x.amount||0))}</span></div><Progress value={Math.min(100,Number(x.amount||0)/10000)} tone={x.type==="Masuk"?"green":"amber"} /></div>)}
        </article>
      </section><section className="card data-card"><header className="card-header"><div><h3>Tagihan Santri</h3><p>Siap dihubungkan ke gateway pembayaran</p></div><button className="primary-button" onClick={onBill}>+ Buat Tagihan</button></header><div className="table-wrap"><table><thead><tr><th>Invoice</th><th>Santri</th><th>Kategori</th><th>Nominal</th><th>Jatuh Tempo</th><th>Status</th><th /></tr></thead><tbody>{bills.map(x=><tr key={String(x.id)}><td className="muted">{x.invoice_no}</td><td><strong>{x.student_name}</strong></td><td>{x.category}</td><td>Rp {money.format(Number(x.amount))}</td><td>{x.due_date}</td><td><Status tone={x.status==="Lunas"?"green":"amber"}>{x.status}</Status></td><td>{x.status!=="Lunas"&&<button className="text-button" onClick={()=>onPayment(x)}>{x.payment_url?"Buka Link":"Buat Link"}</button>}</td></tr>)}</tbody></table></div></section>
    </>
  );
}

function CharacterPage({ onAdd }: { onAdd: () => void }) {
  const traits = [["Adab & Akhlak",92,"green"],["Kedisiplinan",86,"blue"],["Kemandirian",81,"amber"],["Tanggung Jawab",88,"violet"],["Kebersihan",84,"green"]];
  return (
    <section className="dashboard-grid">
      <article className="card character-profile"><span className="large-avatar">MF</span><h3>Muhammad Fikri</h3><p>VIII A · Ibnu Sina 03</p><strong>A</strong><small>Predikat: Sangat Baik</small><button className="secondary-button">Pilih Santri</button></article>
      <article className="card compact-list"><header className="card-header"><div><h3>Penilaian Karakter</h3><p>Semester Ganjil 2026/2027</p></div><button className="primary-button" onClick={onAdd}>Input Nilai</button></header>
        {traits.map(([t,v,c])=><div className="trait-row" key={String(t)}><div><strong>{t}</strong><small>{Number(v)>=90?"Istiqamah":"Baik"}</small></div><Progress value={Number(v)} tone={String(c)} /><b>{v}</b></div>)}
        <div className="teacher-note"><span>“</span><p>Fikri menunjukkan perkembangan adab yang sangat baik dan konsisten membantu teman satu kamar.</p><small>— Ustadz Hasan, Wali Kelas</small></div>
      </article>
    </section>
  );
}

function InventoryPage({ rows, onAdd, onEdit, onDelete }: { rows: Row[]; onAdd: () => void; onEdit: (row: Row) => void; onDelete: (row: Row) => void }) {
  return <section className="card data-card"><header className="card-header"><div><h3>Daftar Inventaris</h3><p>{rows.reduce((sum,x)=>sum+Number(x.quantity||0),0)} item tercatat</p></div><button className="primary-button" onClick={onAdd}>+ Tambah Barang</button></header><div className="table-wrap"><table><thead><tr><th>Nama Barang</th><th>Lokasi</th><th>Jumlah</th><th>Kondisi</th><th /></tr></thead><tbody>{rows.map((r,i)=><tr key={String(r.id)}><td><strong>{r.name}</strong></td><td>{r.location}</td><td>{r.quantity} {r.unit}</td><td><Status tone={i===2?"amber":"green"}>{r.condition}</Status></td><td><div className="row-actions"><button onClick={()=>onEdit(r)}>Ubah</button><button className="danger-link" onClick={()=>onDelete(r)}>Hapus</button></div></td></tr>)}</tbody></table></div></section>;
}

function AnnouncementsPage({ rows, onAdd, onEdit, onDelete, onNotify }: { rows: Row[]; onAdd: () => void; onEdit: (row: Row) => void; onDelete: (row: Row) => void; onNotify: () => void }) {
  return <section className="card announcements-page"><header className="card-header"><div><h3>Semua Pengumuman</h3><p>Informasi resmi Pondok Pesantren Nurul Iman</p></div><div className="header-actions"><button className="secondary-button" onClick={onNotify}>Kirim WhatsApp</button><button className="primary-button" onClick={onAdd}>+ Buat Pengumuman</button></div></header>{rows.map((x,i)=><article key={String(x.id)}><span className="date-box"><b>{new Date(String(x.published_at)).getDate()}</b>JUL</span><div><Status tone={["blue","green","violet"][i%3]}>{x.category}</Status><h3>{x.title}</h3><p>{x.content}</p><small>Dipublikasikan oleh {x.author} · {x.audience}</small></div><div className="row-actions"><button onClick={()=>onEdit(x)}>Ubah</button><button className="danger-link" onClick={()=>onDelete(x)}>Hapus</button></div></article>)}</section>;
}

function DataActions({ row, onEdit, onDelete }: { row:Row; onEdit:(r:Row)=>void; onDelete:(r:Row)=>void }) {
  return <div className="row-actions"><button onClick={()=>onEdit(row)}>Ubah</button><button className="danger-link" onClick={()=>onDelete(row)}>Hapus</button></div>;
}

function AttendancePage({ data, edit, remove }: { data:AppData; edit:(r:Resource,row?:Row)=>void; remove:(r:Resource,row:Row)=>void }) {
  return <><section className="stats-grid three"><article className="metric-card"><MiniIcon tone="green">✓</MiniIcon><div><span>Hadir Hari Ini</span><strong>{data.attendance.filter(x=>x.status==="Hadir").length}</strong><small>Catatan tersinkron</small></div></article><article className="metric-card"><MiniIcon tone="amber">◷</MiniIcon><div><span>Izin Aktif</span><strong>{data.permits.filter(x=>x.status==="Disetujui").length}</strong><small>Perlu dipantau</small></div></article><article className="metric-card"><MiniIcon tone="red">!</MiniIcon><div><span>Tanpa Keterangan</span><strong>{data.attendance.filter(x=>x.status==="Alpa").length}</strong><small>Hari ini</small></div></article></section>
  <section className="dashboard-grid operations-grid"><article className="card data-card"><header className="card-header"><div><h3>Absensi Santri</h3><p>Rekap kehadiran terbaru</p></div><button className="primary-button" onClick={()=>edit("attendance")}>+ Catat Absensi</button></header><div className="table-wrap"><table><thead><tr><th>Santri</th><th>Tanggal</th><th>Status</th><th>Catatan</th><th /></tr></thead><tbody>{data.attendance.map(x=><tr key={String(x.id)}><td><strong>{x.student_name}</strong></td><td>{x.record_date}</td><td><Status tone={x.status==="Hadir"?"green":x.status==="Alpa"?"red":"amber"}>{x.status}</Status></td><td>{x.note}</td><td><DataActions row={x} onEdit={r=>edit("attendance",r)} onDelete={r=>remove("attendance",r)} /></td></tr>)}</tbody></table></div></article>
  <article className="card data-card"><header className="card-header"><div><h3>Perizinan</h3><p>Izin pulang, sakit, dan keperluan keluarga</p></div><button className="primary-button" onClick={()=>edit("permits")}>+ Ajukan Izin</button></header><div className="table-wrap"><table><thead><tr><th>Santri</th><th>Periode</th><th>Status</th><th /></tr></thead><tbody>{data.permits.map(x=><tr key={String(x.id)}><td><strong>{x.student_name}</strong><small className="cell-note">{x.reason}</small></td><td>{x.start_date} – {x.end_date}</td><td><Status tone={x.status==="Disetujui"?"green":"amber"}>{x.status}</Status></td><td><DataActions row={x} onEdit={r=>edit("permits",r)} onDelete={r=>remove("permits",r)} /></td></tr>)}</tbody></table></div></article></section></>;
}

function SchedulePage({ data, edit, remove }: { data:AppData; edit:(r:Resource,row?:Row)=>void; remove:(r:Resource,row:Row)=>void }) {
  return <section className="dashboard-grid operations-grid"><article className="card data-card"><header className="card-header"><div><h3>Jadwal Pesantren</h3><p>Pelajaran dan kegiatan rutin</p></div><button className="primary-button" onClick={()=>edit("schedules")}>+ Jadwal</button></header><div className="schedule-list">{data.schedules.map((x,i)=><div key={String(x.id)}><span className={`schedule-time tone-${i%4}`}>{x.start_time}<small>{x.end_time}</small></span><div><Status tone={i%2?"green":"blue"}>{x.category}</Status><strong>{x.title}</strong><small>{x.day_name} · {x.teacher} · {x.location}</small></div><DataActions row={x} onEdit={r=>edit("schedules",r)} onDelete={r=>remove("schedules",r)} /></div>)}</div></article>
  <article className="card data-card"><header className="card-header"><div><h3>Kamar & Hunian</h3><p>Kapasitas dan pembina asrama</p></div><button className="primary-button" onClick={()=>edit("rooms")}>+ Kamar</button></header><div className="room-grid">{data.rooms.map(x=><div className="room-card" key={String(x.id)}><span>◇</span><div><strong>{x.name}</strong><small>{x.supervisor}</small><p>Kapasitas {x.capacity} santri</p></div><Status>{x.status}</Status><DataActions row={x} onEdit={r=>edit("rooms",r)} onDelete={r=>remove("rooms",r)} /></div>)}</div></article></section>;
}

function AdmissionsPage({ rows, edit, remove }: { rows:Row[]; edit:(r:Resource,row?:Row)=>void; remove:(r:Resource,row:Row)=>void }) {
  return <><section className="summary-banner admission-banner"><div><span>PPDB 2026/2027</span><strong>{rows.length} Pendaftar</strong><p>Alur pendaftaran, verifikasi, tes, dan kelulusan dalam satu tempat.</p></div><button className="light-button" onClick={()=>edit("admissions")}>+ Pendaftar Baru</button></section><section className="card data-card"><header className="card-header"><div><h3>Daftar Calon Santri</h3><p>Penerimaan santri baru</p></div><button className="primary-button" onClick={()=>edit("admissions")}>Tambah Pendaftar</button></header><div className="table-wrap"><table><thead><tr><th>No. Pendaftaran</th><th>Nama</th><th>Asal Sekolah</th><th>Nilai</th><th>Tahap</th><th /></tr></thead><tbody>{rows.map(x=><tr key={String(x.id)}><td className="muted">{x.registration_no}</td><td><strong>{x.name}</strong><small className="cell-note">{x.guardian_name} · {x.guardian_phone}</small></td><td>{x.previous_school}</td><td>{x.score}</td><td><Status tone={x.status==="Lulus"?"green":"blue"}>{x.status}</Status></td><td><DataActions row={x} onEdit={r=>edit("admissions",r)} onDelete={r=>remove("admissions",r)} /></td></tr>)}</tbody></table></div></section></>;
}

function CounselingPage({ rows, edit, remove }: { rows:Row[]; edit:(r:Resource,row?:Row)=>void; remove:(r:Resource,row:Row)=>void }) {
  return <section className="card data-card"><header className="card-header"><div><h3>Catatan Konseling & Pembinaan</h3><p>Data bersifat terbatas untuk pengurus berwenang</p></div><button className="primary-button" onClick={()=>edit("counseling")}>+ Catatan Baru</button></header><div className="table-wrap"><table><thead><tr><th>Santri</th><th>Jenis</th><th>Kategori</th><th>Catatan</th><th>Poin</th><th>Status</th><th /></tr></thead><tbody>{rows.map(x=><tr key={String(x.id)}><td><strong>{x.student_name}</strong></td><td><Status tone={x.type==="Prestasi"?"green":x.type==="Pelanggaran"?"red":"blue"}>{x.type}</Status></td><td>{x.category}</td><td>{x.description}</td><td>{x.points}</td><td>{x.status}</td><td><DataActions row={x} onEdit={r=>edit("counseling",r)} onDelete={r=>remove("counseling",r)} /></td></tr>)}</tbody></table></div></section>;
}

function UsersPage({ data, edit, remove }: { data:AppData; edit:(r:Resource,row?:Row)=>void; remove:(r:Resource,row:Row)=>void }) {
  return <section className="dashboard-grid operations-grid"><article className="card data-card"><header className="card-header"><div><h3>Manajemen Pengguna</h3><p>Hak akses server-side</p></div><button className="primary-button" onClick={()=>edit("users")}>+ Pengguna</button></header><div className="table-wrap"><table><thead><tr><th>Pengguna</th><th>Peran</th><th /></tr></thead><tbody>{data.users.map(x=><tr key={String(x.id)}><td><strong>{x.name}</strong><small className="cell-note">{x.email}</small></td><td><Status tone={x.role==="Admin"?"violet":x.role==="Ustadz"?"blue":"green"}>{x.role}</Status></td><td><DataActions row={x} onEdit={r=>edit("users",r)} onDelete={r=>remove("users",r)} /></td></tr>)}</tbody></table></div></article><article className="card data-card"><header className="card-header"><div><h3>Audit Aktivitas</h3><p>Jejak perubahan terbaru</p></div></header><div className="audit-list">{data.audit.map(x=><div key={String(x.id)}><MiniIcon tone={x.action==="Hapus"?"red":x.action==="Tambah"?"green":"blue"}>{String(x.action).slice(0,1)}</MiniIcon><div><strong>{x.action} · {x.resource}</strong><p>{x.detail}</p><small>{x.user_email} · {new Date(String(x.created_at)).toLocaleString("id-ID")}</small></div></div>)}</div></article></section>;
}

function GuardianPortal({ data, onNotify, onCard }: { data:AppData; onNotify:()=>void; onCard:(row:Row)=>void }) {
  const student=data.students[0]; const bills=data.bills.filter(x=>x.student_id===student?.id); const attendance=data.attendance.filter(x=>x.student_id===student?.id); const tahfidz=data.tahfidz.filter(x=>x.student_id===student?.id);
  return <>{student?<><section className="guardian-hero"><div className="large-avatar">{String(student.name).split(" ").map(x=>x[0]).slice(0,2).join("")}</div><div><span>PORTAL WALI SANTRI</span><h2>{student.name}</h2><p>{student.nis} · {student.class_name} · {student.room}</p></div><div className="header-actions"><button className="secondary-button" onClick={()=>onCard(student)}>Kartu QR</button><button className="primary-button" onClick={onNotify}>Hubungi Pesantren</button></div></section><section className="stats-grid three"><article className="metric-card"><MiniIcon tone="green">✓</MiniIcon><div><span>Kehadiran</span><strong>{attendance.filter(x=>x.status==="Hadir").length}/{attendance.length||1}</strong><small>Catatan terakhir</small></div></article><article className="metric-card"><MiniIcon tone="blue">◫</MiniIcon><div><span>Setoran Tahfidz</span><strong>{tahfidz.length}</strong><small>Total setoran</small></div></article><article className="metric-card"><MiniIcon tone="amber">Rp</MiniIcon><div><span>Tagihan Aktif</span><strong>{bills.filter(x=>x.status!=="Lunas").length}</strong><small>Perlu dibayar</small></div></article></section><section className="dashboard-grid"><article className="card compact-list"><header className="card-header"><div><h3>Perkembangan Terbaru</h3><p>Tahfidz dan karakter</p></div></header>{tahfidz.slice(0,5).map(x=><div className="progress-row" key={String(x.id)}><div><strong>{x.surah}</strong><small>Ayat {x.verses}</small></div><Progress value={Math.min(100,Number(x.amount)*5)} tone="green" /><b>{x.grade}</b></div>)}</article><article className="card compact-list"><header className="card-header"><div><h3>Tagihan</h3><p>Status pembayaran</p></div></header>{bills.map(x=><div className="announcement-mini" key={String(x.id)}><span>{x.due_date}</span><p>{x.category} · Rp{money.format(Number(x.amount))}</p><Status tone={x.status==="Lunas"?"green":"amber"}>{x.status}</Status></div>)}</article></section></>:<div className="empty-state">Belum ada santri yang terhubung.</div>}</>;
}

function IntegrationsPage({ onImported, notify }: { onImported:()=>Promise<void>; notify:(s:string)=>void }) {
  const [status,setStatus]=useState<{midtrans?:boolean;xendit?:boolean;whatsapp?:boolean}>({});
  const [uploading,setUploading]=useState(false);
  useEffect(()=>{void (async()=>{try{const response=await fetch("/api/integrations");setStatus(await response.json() as {midtrans?:boolean;xendit?:boolean;whatsapp?:boolean});}catch{setStatus({});}})();},[]);
  async function upload(file:File) { setUploading(true); const form=new FormData(); form.append("file",file); const response=await fetch("/api/import",{method:"POST",body:form}); const result=await response.json() as {error?:string;imported?:number}; setUploading(false); if(!response.ok){notify(result.error||"Impor gagal.");return;} notify(`${result.imported} santri berhasil diimpor.`); await onImported(); }
  return <><section className="integration-grid">{[["Midtrans","Pembayaran otomatis dan payment link",status.midtrans],["Xendit","Alternatif kanal pembayaran",status.xendit],["WhatsApp Cloud API","Notifikasi otomatis ke wali",status.whatsapp]].map((x,i)=><article className="card integration-card" key={String(x[0])}><MiniIcon tone={["blue","violet","green"][i]}>{i===2?"WA":"↗"}</MiniIcon><div><h3>{x[0]}</h3><p>{x[1]}</p></div><Status tone={x[2]?"green":"amber"}>{x[2]?"Terhubung":"Perlu kredensial"}</Status></article>)}</section><section className="dashboard-grid operations-grid"><article className="card utility-card"><div><MiniIcon tone="blue">⇧</MiniIcon><h3>Impor Excel/CSV</h3><p>Kolom: nama, nis, kelas, kamar, nama_wali, whatsapp. Maksimal 500 baris.</p><label className="upload-button">{uploading?"Mengimpor...":"Pilih Berkas"}<input type="file" accept=".xlsx,.xls,.csv" disabled={uploading} onChange={e=>e.target.files?.[0]&&void upload(e.target.files[0])} /></label></div></article><article className="card utility-card"><div><MiniIcon tone="green">⇩</MiniIcon><h3>Backup Lengkap</h3><p>Unduh seluruh data operasional sebagai JSON untuk arsip dan pemulihan.</p><a className="primary-button link-button" href="/api/backup">Unduh Backup</a></div></article></section></>;
}

function StudentCardModal({ student, onClose }: { student:Row; onClose:()=>void }) {
  const [qr,setQr]=useState(""); useEffect(()=>{void (async()=>{const response=await fetch(`/api/student-card?id=${student.id}`);const result=await response.json() as {qr?:string};setQr(result.qr||"");})();},[student.id]);
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="student-card-modal" onMouseDown={e=>e.stopPropagation()}><button className="modal-close no-print" onClick={onClose}>×</button><div className="student-id-card"><header><span className="brand-mark">ن</span><div><strong>SINURMAN</strong><small>Pondok Pesantren Nurul Iman</small></div></header><div className="student-card-body"><div><span className="student-photo">{String(student.name).split(" ").map(x=>x[0]).slice(0,2).join("")}</span><h3>{student.name}</h3><p>{student.nis}</p><dl><dt>Kelas</dt><dd>{student.class_name}</dd><dt>Kamar</dt><dd>{student.room}</dd><dt>Status</dt><dd>{student.status}</dd></dl></div>{qr?<img src={qr} alt={`QR ${student.name}`} />:<span className="qr-loading">Memuat QR…</span>}</div><footer>Kartu Santri Digital · Tahun Ajaran 2026/2027</footer></div><button className="primary-button print-card no-print" onClick={()=>window.print()}>Cetak Kartu</button></div></div>;
}

function ReportsPage() {
  const reports = [["students","Laporan Data Santri","Profil, kelas, dan wali"],["tahfidz","Rekap Setoran Tahfidz","Hafalan per santri"],["finance","Laporan Keuangan","SPP dan uang saku"],["health","Rekap Kesehatan","Kunjungan klinik"]];
  return <><section className="report-hero"><div><span>PUSAT DATA SINURMAN</span><h2>Laporan pesantren, siap dalam beberapa klik.</h2><p>Unduh data terbaru dalam PDF siap cetak atau CSV yang dapat dibuka di Excel.</p></div><a className="light-button link-button" href="/api/export?type=students&format=pdf">Unduh Laporan Utama →</a></section><section className="report-grid">{reports.map((r,i)=><article className="card report-card" key={r[0]}><MiniIcon tone={["blue","green","violet","amber"][i]}>▥</MiniIcon><div><h3>{r[1]}</h3><p>{r[2]}</p><span>PDF & Excel/CSV · Data langsung</span></div><div className="export-actions"><a href={`/api/export?type=${r[0]}&format=pdf`}>PDF</a><a href={`/api/export?type=${r[0]}&format=csv`}>CSV</a></div></article>)}</section></>;
}

const formFields: Record<Resource, { key: string; label: string; type?: string; options?: string[] }[]> = {
  students: [
    { key:"name",label:"Nama lengkap" },{ key:"nis",label:"NIS" },{ key:"class_name",label:"Kelas" },
    { key:"room",label:"Kamar" },{ key:"guardian_name",label:"Nama wali" },{ key:"guardian_phone",label:"Nomor WhatsApp wali",type:"tel" },
    { key:"status",label:"Status",options:["Aktif","Izin","Nonaktif"] },
  ],
  tahfidz: [
    { key:"student_id",label:"Santri",type:"student" },{ key:"surah",label:"Surat" },{ key:"verses",label:"Ayat" },
    { key:"amount",label:"Jumlah ayat",type:"number" },{ key:"grade",label:"Penilaian",options:["Mumtaz","Jayyid Jiddan","Jayyid","Mengulang"] },
  ],
  health: [
    { key:"student_id",label:"Santri",type:"student" },{ key:"complaint",label:"Keluhan" },{ key:"diagnosis",label:"Diagnosis" },
    { key:"treatment",label:"Penanganan" },{ key:"status",label:"Status",options:["Dipantau","Membaik","Dirujuk","Selesai"] },
  ],
  transactions: [
    { key:"student_id",label:"Santri",type:"student" },{ key:"type",label:"Jenis",options:["Masuk","Keluar"] },
    { key:"category",label:"Kategori",options:["SPP","Uang Saku","Koperasi","Kantin","Laundry","Lainnya"] },
    { key:"amount",label:"Nominal",type:"number" },{ key:"status",label:"Status",options:["Berhasil","Lunas","Tertunda"] },{ key:"note",label:"Catatan" },
  ],
  characters: [
    { key:"student_id",label:"Santri",type:"student" },{ key:"category",label:"Kategori",options:["Adab & Akhlak","Kedisiplinan","Kemandirian","Tanggung Jawab","Kebersihan"] },
    { key:"score",label:"Nilai",type:"number" },{ key:"note",label:"Catatan pembina" },
  ],
  inventory: [
    { key:"name",label:"Nama barang" },{ key:"location",label:"Lokasi" },{ key:"quantity",label:"Jumlah",type:"number" },
    { key:"unit",label:"Satuan" },{ key:"condition",label:"Kondisi",options:["Baik","Perawatan","Perbaikan","Rusak"] },
  ],
  announcements: [
    { key:"title",label:"Judul" },{ key:"category",label:"Kategori",options:["Akademik","Kunjungan","Kegiatan","Keuangan","Umum"] },
    { key:"content",label:"Isi pengumuman",type:"textarea" },{ key:"audience",label:"Penerima",options:["Semua","Wali Santri","Ustadz","Admin"] },
  ],
  attendance: [
    {key:"student_id",label:"Santri",type:"student"},{key:"record_date",label:"Tanggal",type:"date"},{key:"status",label:"Status",options:["Hadir","Sakit","Izin","Alpa"]},{key:"note",label:"Catatan"},
  ],
  permits: [
    {key:"student_id",label:"Santri",type:"student"},{key:"start_date",label:"Tanggal mulai",type:"date"},{key:"end_date",label:"Tanggal selesai",type:"date"},{key:"reason",label:"Alasan",type:"textarea"},{key:"status",label:"Status",options:["Diajukan","Disetujui","Ditolak","Selesai"]},
  ],
  schedules: [
    {key:"title",label:"Nama kegiatan/pelajaran"},{key:"category",label:"Kategori",options:["Pelajaran","Tahfidz","Ibadah","Kegiatan"]},{key:"teacher",label:"Ustadz/Penanggung jawab"},{key:"location",label:"Lokasi"},{key:"day_name",label:"Hari"},{key:"start_time",label:"Mulai",type:"time"},{key:"end_time",label:"Selesai",type:"time"},
  ],
  rooms: [
    {key:"name",label:"Nama kamar"},{key:"capacity",label:"Kapasitas",type:"number"},{key:"supervisor",label:"Musyrif/Pembina"},{key:"status",label:"Status",options:["Aktif","Perawatan","Penuh"]},
  ],
  admissions: [
    {key:"registration_no",label:"Nomor pendaftaran"},{key:"name",label:"Nama calon santri"},{key:"guardian_name",label:"Nama wali"},{key:"guardian_phone",label:"WhatsApp wali",type:"tel"},{key:"previous_school",label:"Asal sekolah"},{key:"status",label:"Tahap",options:["Pendaftaran","Verifikasi","Tes","Lulus","Tidak Lulus"]},{key:"score",label:"Nilai tes",type:"number"},
  ],
  counseling: [
    {key:"student_id",label:"Santri",type:"student"},{key:"type",label:"Jenis",options:["Konseling","Pembinaan","Pelanggaran","Prestasi"]},{key:"category",label:"Kategori"},{key:"description",label:"Catatan kejadian",type:"textarea"},{key:"points",label:"Poin",type:"number"},{key:"status",label:"Status",options:["Baru","Ditindaklanjuti","Selesai"]},
  ],
  bills: [
    {key:"student_id",label:"Santri",type:"student"},{key:"invoice_no",label:"Nomor tagihan"},{key:"category",label:"Kategori",options:["SPP","Daftar Ulang","Kegiatan","Seragam","Lainnya"]},{key:"amount",label:"Nominal",type:"number"},{key:"due_date",label:"Jatuh tempo",type:"date"},{key:"status",label:"Status",options:["Belum Dibayar","Tertunda","Lunas"]},
  ],
  users: [
    {key:"name",label:"Nama pengguna"},{key:"email",label:"Email",type:"email"},{key:"role",label:"Peran",options:["Admin","Ustadz","Wali Santri"]},
  ],
};

const resourceNames: Record<Resource,string> = {
  students:"santri",tahfidz:"setoran tahfidz",health:"pemeriksaan",transactions:"transaksi",
  characters:"nilai karakter",inventory:"barang",announcements:"pengumuman",
  attendance:"absensi",permits:"izin",schedules:"jadwal",rooms:"kamar",admissions:"pendaftar",
  counseling:"catatan konseling",bills:"tagihan",users:"pengguna",
};

function RecordModal({ editor, students, onClose, onSave }: { editor: NonNullable<EditorState>; students: Row[]; onClose: () => void; onSave: (resource: Resource, row: Row | undefined, data: Record<string, unknown>) => Promise<void> }) {
  const [form, setForm] = useState<Record<string, string>>(() => {
    const values: Record<string,string> = {};
    for (const field of formFields[editor.resource]) values[field.key] = String(editor.row?.[field.key] ?? "");
    return values;
  });
  const [saving,setSaving] = useState(false);
  const [error,setError] = useState("");
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const data: Record<string,unknown> = {};
      for (const [key,value] of Object.entries(form)) data[key] = ["amount","quantity","score","student_id","points","capacity"].includes(key) ? Number(value) : value;
      await onSave(editor.resource,editor.row,data);
    } catch (e) { setError(e instanceof Error?e.message:"Gagal menyimpan."); setSaving(false); }
  }
  return <div className="modal-backdrop" onMouseDown={onClose}><form className="record-modal" onSubmit={submit} onMouseDown={e=>e.stopPropagation()}>
    <button type="button" className="modal-close" onClick={onClose}>×</button>
    <span className="modal-eyebrow">DATA SINURMAN</span>
    <h2>{editor.row?"Ubah":"Tambah"} {resourceNames[editor.resource]}</h2>
    <p>Data akan tersimpan permanen dan langsung memperbarui dashboard.</p>
    <div className="form-grid">{formFields[editor.resource].map(field=><label key={field.key} className={field.type==="textarea"?"wide":""}>{field.label}
      {field.type==="student"?<select required value={form[field.key]} onChange={e=>setForm({...form,[field.key]:e.target.value})}><option value="">Pilih santri</option>{students.map(s=><option key={String(s.id)} value={String(s.id)}>{s.name} · {s.nis}</option>)}</select>
      :field.options?<select required value={form[field.key]} onChange={e=>setForm({...form,[field.key]:e.target.value})}><option value="">Pilih</option>{field.options.map(o=><option key={o}>{o}</option>)}</select>
      :field.type==="textarea"?<textarea required value={form[field.key]} onChange={e=>setForm({...form,[field.key]:e.target.value})} />
      :<input required={!["status","note"].includes(field.key)} type={field.type||"text"} value={form[field.key]} onChange={e=>setForm({...form,[field.key]:e.target.value})} />}
    </label>)}</div>
    {error&&<div className="form-error">{error}</div>}
    <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Batal</button><button disabled={saving} className="primary-button">{saving?"Menyimpan...":"Simpan Data"}</button></div>
  </form></div>;
}

function NotificationModal({ students, onClose, onSent }: { students: Row[]; onClose: () => void; onSent: (message:string) => void }) {
  const [studentId,setStudentId] = useState(String(students[0]?.id??""));
  const student = students.find(s=>String(s.id)===studentId);
  const [message,setMessage] = useState("Assalamu’alaikum, kami mengingatkan pembayaran SPP bulan Juli 2026 melalui SINURMAN. Jazakumullahu khairan.");
  const [sending,setSending] = useState(false);
  async function send() {
    if(!student) return; setSending(true);
    const response=await fetch("/api/notifications",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({studentId:Number(student.id),recipient:student.guardian_phone,message,channel:"WhatsApp"})});
    const result=await response.json() as {error?:string;whatsappUrl?:string};
    if(!response.ok) { setSending(false); onSent(result.error||"Gagal menyiapkan WhatsApp."); return; }
    if(result.whatsappUrl) window.open(result.whatsappUrl,"_blank","noopener,noreferrer");
    onSent("Pesan dicatat dan WhatsApp siap dikirim."); onClose();
  }
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="record-modal notification-modal" onMouseDown={e=>e.stopPropagation()}><button className="modal-close" onClick={onClose}>×</button><span className="modal-eyebrow">NOTIFIKASI WALI</span><h2>Kirim melalui WhatsApp</h2><p>Pesan dicatat sebagai riwayat, lalu dibuka di WhatsApp untuk konfirmasi pengiriman.</p><label>Santri<select value={studentId} onChange={e=>setStudentId(e.target.value)}>{students.map(s=><option key={String(s.id)} value={String(s.id)}>{s.name} · {s.guardian_name}</option>)}</select></label><label>Pesan<textarea value={message} onChange={e=>setMessage(e.target.value)} /></label><div className="recipient-preview"><span>Tujuan</span><strong>{student?.guardian_name} · +{student?.guardian_phone}</strong></div><div className="modal-actions"><button className="secondary-button" onClick={onClose}>Batal</button><button className="whatsapp-button" disabled={sending} onClick={send}>{sending?"Menyiapkan...":"Buka WhatsApp →"}</button></div></div></div>;
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
  const [data, setData] = useState<AppData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [editor, setEditor] = useState<EditorState>(null);
  const [cardStudent, setCardStudent] = useState<Row | null>(null);
  const [showNotification, setShowNotification] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [dark, setDark] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [toast, setToast] = useState("");
  const title = pageTitles[page];

  const loadData = useCallback(async () => {
    setLoading(true); setLoadError("");
    try {
      const response = await fetch("/api/bootstrap", { cache:"no-store" });
      const result = await response.json() as AppData & { error?:string };
      if (!response.ok) throw new Error(result.error || "Data tidak dapat dimuat.");
      setData(result);
      if(result.user?.role) setRole(result.user.role);
    } catch (error) {
      setLoadError(error instanceof Error?error.message:"Data tidak dapat dimuat.");
    } finally { setLoading(false); }
  },[]);

  useEffect(()=>{ void loadData(); },[loadData]);

  async function saveRecord(resource: Resource, row: Row | undefined, values: Record<string, unknown>) {
    const response=await fetch("/api/records",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:row?"update":"create",resource,id:row?.id,data:values})});
    const result=await response.json() as {error?:string};
    if(!response.ok) throw new Error(result.error||"Gagal menyimpan data.");
    setEditor(null); notify("Data berhasil disimpan."); await loadData();
  }

  async function deleteRecord(resource: Resource,row: Row) {
    if(!window.confirm(`Hapus ${resourceNames[resource]} ini? Tindakan ini tidak dapat dibatalkan.`)) return;
    const response=await fetch("/api/records",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"delete",resource,id:row.id})});
    const result=await response.json() as {error?:string};
    if(!response.ok) { notify(result.error||"Gagal menghapus data."); return; }
    notify("Data berhasil dihapus."); await loadData();
  }

  async function openPayment(row:Row) {
    if(row.payment_url) { window.open(String(row.payment_url),"_blank","noopener,noreferrer"); return; }
    const response=await fetch("/api/integrations",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"payment-link",billId:row.id})});
    const result=await response.json() as {error?:string;paymentUrl?:string};
    if(!response.ok){notify(result.error||"Link pembayaran gagal dibuat.");return;}
    if(result.paymentUrl) window.open(result.paymentUrl,"_blank","noopener,noreferrer");
    notify("Link pembayaran berhasil dibuat."); await loadData();
  }

  const content = useMemo(() => {
    const actions=(resource:Resource)=>({onAdd:()=>setEditor({resource}),onEdit:(row:Row)=>setEditor({resource,row}),onDelete:(row:Row)=>void deleteRecord(resource,row)});
    switch (page) {
      case "dashboard": return <Overview data={data} />;
      case "santri": return <StudentsPage rows={data.students} {...actions("students")} onCard={setCardStudent} />;
      case "tahfidz": return <TahfidzPage rows={data.tahfidz} {...actions("tahfidz")} />;
      case "mutabaah": return <MutabaahPage />;
      case "kesehatan": return <HealthPage rows={data.health} {...actions("health")} />;
      case "keuangan": return <FinancePage rows={data.transactions} bills={data.bills} onAdd={()=>setEditor({resource:"transactions"})} onBill={()=>setEditor({resource:"bills"})} onNotify={()=>setShowNotification(true)} onPayment={row=>void openPayment(row)} />;
      case "karakter": return <CharacterPage onAdd={()=>setEditor({resource:"characters"})} />;
      case "inventaris": return <InventoryPage rows={data.inventory} {...actions("inventory")} />;
      case "pengumuman": return <AnnouncementsPage rows={data.announcements} {...actions("announcements")} onNotify={()=>setShowNotification(true)} />;
      case "laporan": return <ReportsPage />;
      case "absensi": return <AttendancePage data={data} edit={(resource,row)=>setEditor({resource,row})} remove={(resource,row)=>void deleteRecord(resource,row)} />;
      case "jadwal": return <SchedulePage data={data} edit={(resource,row)=>setEditor({resource,row})} remove={(resource,row)=>void deleteRecord(resource,row)} />;
      case "penerimaan": return <AdmissionsPage rows={data.admissions} edit={(resource,row)=>setEditor({resource,row})} remove={(resource,row)=>void deleteRecord(resource,row)} />;
      case "konseling": return <CounselingPage rows={data.counseling} edit={(resource,row)=>setEditor({resource,row})} remove={(resource,row)=>void deleteRecord(resource,row)} />;
      case "pengguna": return <UsersPage data={data} edit={(resource,row)=>setEditor({resource,row})} remove={(resource,row)=>void deleteRecord(resource,row)} />;
      case "integrasi": return <IntegrationsPage onImported={loadData} notify={notify} />;
      case "portalwali": return <GuardianPortal data={data} onNotify={()=>setShowNotification(true)} onCard={setCardStudent} />;
    }
  }, [page,data]);

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
            <div className="profile-wrap"><button className="profile-button" onClick={()=>setProfileOpen(!profileOpen)}><span>{(data.user?.name||"Ahmad Hidayat").split(" ").map(x=>x[0]).slice(0,2).join("").toUpperCase()}</span><div><strong>{data.user?.name||"Ahmad Hidayat"}</strong><small>{role}</small></div><i>⌄</i></button>
              {profileOpen&&<div className="profile-menu"><button onClick={()=>{setShowLogin(true);setProfileOpen(false)}}>⇄ Ganti peran demo</button><button onClick={()=>notify("Profil pengguna dibuka.")}>♙ Profil saya</button><button onClick={()=>notify("Pengaturan dibuka.")}>⚙ Pengaturan</button></div>}
            </div>
          </div>
        </header>

        <main>
          <div className="page-heading"><div><p>Beranda <span>/</span> {page==="dashboard"?"Ringkasan":title.title}</p><h1>{page==="dashboard"&&data.user?.name?`Assalamu’alaikum, ${data.user.name} 👋`:title.title}</h1><span>{title.subtitle}</span></div><div className="heading-actions"><button className="secondary-button" onClick={()=>void loadData()}>↻ Perbarui</button><button className="primary-button" onClick={()=>selectPage("laporan")}>▥ Buat Laporan</button></div></div>
          {loading&&<div className="sync-banner">Menyinkronkan data SINURMAN…</div>}
          {loadError&&<div className="sync-banner error">Data online belum tersedia: {loadError} <button onClick={()=>void loadData()}>Coba lagi</button></div>}
          {content}
          <footer className="page-footer"><span>© 2026 Pondok Pesantren Nurul Iman</span><div><button>Kebijakan Privasi</button><button>Bantuan</button></div></footer>
        </main>
      </div>
      <nav className="mobile-nav">
        {[navGroups[0].items[0],navGroups[1].items[0],navGroups[1].items[1],navGroups[2].items[1]].map(item=><button key={item.key} className={page===item.key?"active":""} onClick={()=>selectPage(item.key)}><i>{item.icon}</i><span>{item.label}</span></button>)}
        <button onClick={()=>setSidebarOpen(true)}><i>•••</i><span>Lainnya</span></button>
      </nav>
      {editor&&<RecordModal key={`${editor.resource}-${editor.row?.id??"new"}`} editor={editor} students={data.students} onClose={()=>setEditor(null)} onSave={saveRecord} />}
      {cardStudent&&<StudentCardModal student={cardStudent} onClose={()=>setCardStudent(null)} />}
      {showNotification&&<NotificationModal students={data.students} onClose={()=>setShowNotification(false)} onSent={notify} />}
      {showLogin&&<LoginModal onClose={()=>setShowLogin(false)} onLogin={r=>{setRole(r);setShowLogin(false);if(r==="Wali Santri")setPage("portalwali");notify(`Mode tampilan ${r} aktif.`)}} />}
      {toast&&<div className="toast"><span>✓</span>{toast}</div>}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { QURAN_SURAHS, quranRangeAmount } from "./quran-data";

type Role = "Admin" | "Kepala Asrama" | "Musyrif" | "Ustadz" | "Wali Santri";
type Resource = "students" | "tahfidz" | "mutabaah" | "health" | "transactions" | "characters" | "inventory" | "announcements" | "attendance" | "permits" | "schedules" | "rooms" | "admissions" | "counseling" | "bills" | "users" | "subjects" | "grades";
type Row = Record<string, string | number | null>;
type AppData = {
  user?: { name: string; email: string; role: Role; roomScope?: string };
  warning?: string;
  students: Row[];
  tahfidz: Row[];
  mutabaah: Row[];
  health: Row[];
  transactions: Row[];
  characters: Row[];
  inventory: Row[];
  announcements: Row[];
  notifications: Row[];
  attendance: Row[];
  subjects: Row[];
  grades: Row[];
  permits: Row[];
  schedules: Row[];
  rooms: Row[];
  admissions: Row[];
  admissionDocuments: Row[];
  counseling: Row[];
  bills: Row[];
  users: Row[];
  audit: Row[];
  guardianMessages: Row[];
  guardianRequests: Row[];
  walletAccounts: Row[];
  walletEntries: Row[];
  walletTopups: Row[];
  canteenProducts: Row[];
  canteenSales: Row[];
  canteenSaleItems: Row[];
};
type EditorState = { resource: Resource; row?: Row } | null;
type SearchResult = {
  id: string;
  title: string;
  subtitle: string;
  page: PageKey;
  icon: string;
  keywords: string;
};

const emptyData: AppData = {
  students: [], tahfidz: [], mutabaah: [], health: [], transactions: [], characters: [],
  inventory: [], announcements: [], notifications: [],
  attendance: [], subjects: [], grades: [], permits: [], schedules: [], rooms: [], admissions: [], admissionDocuments: [],
  counseling: [], bills: [], users: [], audit: [], guardianMessages: [], guardianRequests: [],
  walletAccounts: [], walletEntries: [], walletTopups: [], canteenProducts: [], canteenSales: [], canteenSaleItems: [],
};
type PageKey =
  | "dashboard"
  | "santri"
  | "tahfidz"
  | "akademik"
  | "mutabaah"
  | "kesehatan"
  | "keuangan"
  | "sinurpay"
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
      { key: "dashboard", icon: "fi-rr-apps", label: "Dashboard" },
      { key: "santri", icon: "fi-rr-users", label: "Data Santri" },
    ],
  },
  {
    label: "AKADEMIK & PEMBINAAN",
    items: [
      { key: "tahfidz", icon: "fi-rr-book-quran", label: "Tahfidz" },
      { key: "akademik", icon: "fi-rr-graduation-cap", label: "Akademik & Rapor" },
      { key: "mutabaah", icon: "fi-rr-praying-hands", label: "Mutaba’ah" },
      { key: "karakter", icon: "fi-rr-shield-check", label: "Rapor Karakter" },
      { key: "absensi", icon: "fi-rr-clipboard-check", label: "Absensi & Izin" },
      { key: "jadwal", icon: "fi-rr-calendar", label: "Jadwal & Kamar" },
    ],
  },
  {
    label: "LAYANAN SANTRI",
    items: [
      { key: "kesehatan", icon: "fi-rr-stethoscope", label: "Kesehatan" },
      { key: "keuangan", icon: "fi-rr-wallet", label: "Keuangan" },
      { key: "sinurpay", icon: "fi-rr-cash-register", label: "SINURPAY" },
      { key: "inventaris", icon: "fi-rr-boxes", label: "Inventaris" },
      { key: "konseling", icon: "fi-rr-comments", label: "Konseling" },
    ],
  },
  {
    label: "INFORMASI",
    items: [
      { key: "pengumuman", icon: "fi-rr-megaphone", label: "Pengumuman" },
      { key: "laporan", icon: "fi-rr-file-chart-line", label: "Laporan" },
      { key: "penerimaan", icon: "fi-rr-user-add", label: "Penerimaan Santri" },
      { key: "portalwali", icon: "fi-rr-home-heart", label: "Portal Wali" },
    ],
  },
  {
    label: "SISTEM",
    items: [
      { key: "pengguna", icon: "fi-rr-user-gear", label: "Pengguna & Audit" },
      { key: "integrasi", icon: "fi-rr-settings-sliders", label: "Integrasi & Backup" },
    ],
  },
];

const pageTitles: Record<PageKey, { title: string; subtitle: string }> = {
  dashboard: { title: "Assalamu’alaikum, Ahmad 👋", subtitle: "Berikut ringkasan perkembangan pesantren hari ini." },
  santri: { title: "Data Santri", subtitle: "Kelola profil, kelas, kamar, dan status seluruh santri." },
  tahfidz: { title: "Tahfidz & Hafalan", subtitle: "Pantau target, setoran, dan capaian hafalan santri." },
  akademik: { title: "Akademik & Rapor", subtitle: "Kelola mata pelajaran dan nilai rapor SMP–SMK." },
  mutabaah: { title: "Mutaba’ah Ibadah", subtitle: "Rekap pelaksanaan ibadah dan kegiatan harian." },
  kesehatan: { title: "Kesehatan Santri", subtitle: "Catatan pemeriksaan, keluhan, dan tindak lanjut kesehatan." },
  keuangan: { title: "Keuangan", subtitle: "Kelola SPP, uang saku, dan riwayat transaksi." },
  sinurpay: { title: "SINURPAY", subtitle: "Buku tabungan santri dan kasir kantin tanpa uang tunai." },
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

const normalizeSearch = (value: unknown) =>
  String(value ?? "").toLocaleLowerCase("id-ID").normalize("NFD").replace(/[\u0300-\u036f]/g, "");

function tahfidzRange(row:Row) {
  const legacyVerses=String(row.verses??"").match(/\d+/g)??[];
  const surahFrom=String(row.surah_from||row.surah||"Surat belum diisi");
  const surahTo=String(row.surah_to||row.surah||surahFrom);
  const verseFrom=Number(row.verse_from||legacyVerses[0]||0);
  const verseTo=Number(row.verse_to||legacyVerses[1]||legacyVerses[0]||0);
  return surahFrom.toLocaleLowerCase("id-ID")===surahTo.toLocaleLowerCase("id-ID")
    ? `${surahFrom}, ayat ${verseFrom}-${verseTo}`
    : `${surahFrom} ayat ${verseFrom} s.d. ${surahTo} ayat ${verseTo}`;
}

const students = [
  { name: "Muhammad Fikri", nis: "SN-240181", class: "VIII A", room: "Ibnu Sina 03", status: "Aktif", avatar: "MF" },
  { name: "Ahmad Fauzan", nis: "SN-240182", class: "VIII A", room: "Ibnu Sina 03", status: "Aktif", avatar: "AF" },
  { name: "Rizky Maulana", nis: "SN-240194", class: "VIII B", room: "Al-Farabi 02", status: "Aktif", avatar: "RM" },
  { name: "Nabil Hidayat", nis: "SN-240207", class: "VII C", room: "Al-Khawarizmi 01", status: "Izin", avatar: "NH" },
  { name: "Faris Abdullah", nis: "SN-240212", class: "IX A", room: "Ibnu Khaldun 02", status: "Aktif", avatar: "FA" },
];

const money = new Intl.NumberFormat("id-ID");

const legacyToolIcons: Record<string, string> = {
  "⌂":"fi-rr-apps", "♙":"fi-rr-student", "◫":"fi-rr-book-quran", "✓":"fi-rr-check",
  "Rp":"fi-rr-wallet", "✚":"fi-rr-stethoscope", "!":"fi-rr-triangle-warning",
  "A":"fi-rr-graduation-cap", "▦":"fi-rr-calendar", "◷":"fi-rr-clock", "☆":"fi-rr-star",
  "◇":"fi-rr-boxes", "◉":"fi-rr-megaphone", "▥":"fi-rr-file-chart-line",
  "+":"fi-rr-user-add", "♧":"fi-rr-comments", "⚙":"fi-rr-settings", "↗":"fi-rr-plug",
  "WA":"fi-rr-comments", "⇧":"fi-rr-cloud-upload", "⇩":"fi-rr-cloud-download",
  "QR":"fi-rr-qr-scan", "C":"fi-rr-clipboard-check", "N":"fi-rr-chart-histogram",
  "T":"fi-rr-wallet",
};

function ToolIcon({ name }: { name: string }) {
  const icon = name.startsWith("fi-") ? name : legacyToolIcons[name] || "fi-rr-apps";
  return <i className={`fi ${icon}`} aria-hidden="true" />;
}

function MiniIcon({ children, tone = "blue" }: { children: React.ReactNode; tone?: string }) {
  return <span className={`mini-icon ${tone}`}>{typeof children === "string" ? <ToolIcon name={children} /> : children}</span>;
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

function Metric({ title, value, icon, tone }: { title:string; value:number|string; icon:string; tone:string }) {
  return <article className="metric-card"><MiniIcon tone={tone}>{icon}</MiniIcon><div><span>{title}</span><strong>{value}</strong><small>Data PPDB terkini</small></div></article>;
}

function Overview({ data }: { data: AppData }) {
  const [classFilter,setClassFilter]=useState("Semua");
  const [roomFilter,setRoomFilter]=useState("Semua");
  const [periodFilter,setPeriodFilter]=useState("30");
  const [referenceTime]=useState(()=>Date.now());
  const classes=[...new Set(data.students.map(row=>String(row.class_name)).filter(Boolean))].sort();
  const rooms=[...new Set(data.students.map(row=>String(row.room)).filter(Boolean))].sort();
  const filteredStudents=data.students.filter(row=>(classFilter==="Semua"||row.class_name===classFilter)&&(roomFilter==="Semua"||row.room===roomFilter));
  const studentIds=new Set(filteredStudents.map(row=>String(row.id)));
  const cutoff=periodFilter==="all"?0:referenceTime-Number(periodFilter)*86400000;
  const inPeriod=(value:unknown)=>!cutoff||new Date(String(value)).getTime()>=cutoff;
  const tahfidz=data.tahfidz.filter(row=>studentIds.has(String(row.student_id))&&inPeriod(row.recorded_at));
  const attendance=data.attendance.filter(row=>studentIds.has(String(row.student_id))&&inPeriod(row.record_date));
  const grades=data.grades.filter(row=>studentIds.has(String(row.student_id))&&inPeriod(row.recorded_at));
  const transactions=data.transactions.filter(row=>studentIds.has(String(row.student_id))&&inPeriod(row.recorded_at));
  const paid = transactions.filter((x) => x.type === "Masuk").reduce((sum, x) => sum + Number(x.amount || 0), 0);
  const attendanceRate=attendance.length?Math.round(attendance.filter(row=>row.status==="Hadir").length/attendance.length*100):0;
  const gradeAverage=grades.length?Math.round(grades.reduce((sum,row)=>sum+Number(row.final_score||0),0)/grades.length):0;
  const classStats=classes.map(label=>({label,value:data.students.filter(row=>row.class_name===label&&(roomFilter==="Semua"||row.room===roomFilter)).length})).filter(item=>item.value);
  const roomStats=rooms.map(label=>({label,value:data.students.filter(row=>row.room===label&&(classFilter==="Semua"||row.class_name===classFilter)).length})).filter(item=>item.value);
  const maxBar=Math.max(1,...classStats.map(item=>item.value),...roomStats.map(item=>item.value));
  return (
    <>
      <section className="card analytics-toolbar"><div><strong>Analitik Operasional</strong><small>Grafik dan angka mengikuti kelas, kamar, serta periode yang dipilih.</small></div><label>Kelas<select value={classFilter} onChange={event=>setClassFilter(event.target.value)}><option>Semua</option>{classes.map(item=><option key={item}>{item}</option>)}</select></label><label>Kamar<select value={roomFilter} onChange={event=>setRoomFilter(event.target.value)}><option>Semua</option>{rooms.map(item=><option key={item}>{item}</option>)}</select></label><label>Periode<select value={periodFilter} onChange={event=>setPeriodFilter(event.target.value)}><option value="7">7 hari</option><option value="30">30 hari</option><option value="90">90 hari</option><option value="365">1 tahun</option><option value="all">Semua</option></select></label></section>
      <section className="stats-grid">
        <article className="stat-card">
          <div className="stat-copy"><span>Santri Terpilih</span><strong>{filteredStudents.length}</strong><small className="up">Filter <b>kelas & kamar aktif</b></small></div>
          <MiniIcon tone="blue">♙</MiniIcon><Sparkline values={[32, 44, 38, 58, 51, 68, 72, 83]} />
        </article>
        <article className="stat-card">
          <div className="stat-copy"><span>Total Setoran</span><strong>{tahfidz.length}</strong><small className="up">Periode <b>yang dipilih</b></small></div>
          <MiniIcon tone="green">◫</MiniIcon><Sparkline color="green" values={[48, 31, 58, 45, 70, 62, 75, 88]} />
        </article>
        <article className="stat-card">
          <div className="stat-copy"><span>Kehadiran</span><strong>{attendanceRate}%</strong><small><b>{attendance.length} catatan</b> presensi</small></div>
          <MiniIcon tone="amber">✓</MiniIcon><Sparkline color="amber" values={[82, 75, 90, 84, 78, 92, 86, 80]} />
        </article>
        <article className="stat-card">
          <div className="stat-copy"><span>Rata-rata Nilai</span><strong>{gradeAverage||"-"}</strong><small className="up"><b>{grades.length} nilai</b> akademik</small></div>
          <MiniIcon tone="violet">Rp</MiniIcon><Sparkline color="violet" values={[24, 40, 35, 56, 48, 68, 62, 78]} />
        </article>
      </section>

      <section className="dashboard-grid">
        <article className="card analytics-card"><header className="card-header"><div><h3>Distribusi per Kelas</h3><p>Jumlah santri sesuai filter kamar</p></div></header><div className="horizontal-bars">{classStats.map(item=><div key={item.label}><span>{item.label}</span><i><b style={{width:`${item.value/maxBar*100}%`}} /></i><strong>{item.value}</strong></div>)}{!classStats.length&&<p className="muted">Belum ada data kelas.</p>}</div></article>
        <article className="card analytics-card"><header className="card-header"><div><h3>Distribusi per Kamar</h3><p>Jumlah santri sesuai filter kelas</p></div></header><div className="horizontal-bars room-bars">{roomStats.map(item=><div key={item.label}><span>{item.label}</span><i><b style={{width:`${item.value/maxBar*100}%`}} /></i><strong>{item.value}</strong></div>)}{!roomStats.length&&<p className="muted">Belum ada data kamar.</p>}</div></article>
      </section>

      <section className="dashboard-grid lower">
        <article className="card compact-list">
          <header className="card-header"><div><h3>Ringkasan Periode</h3><p>Aktivitas pada cakupan yang dipilih</p></div></header>
          {[["Ayat disetorkan",tahfidz.reduce((sum,row)=>sum+Number(row.amount||0),0),"green"],["Catatan kehadiran",attendance.length,"blue"],["Nilai akademik",grades.length,"amber"],["Transaksi masuk",`Rp${money.format(paid)}`,"violet"]].map(([label,value,tone])=><div className="analytics-summary" key={String(label)}><MiniIcon tone={String(tone)}>{String(label).slice(0,1)}</MiniIcon><span>{label}</span><strong>{value}</strong></div>)}
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
          <tbody>{rows.map((r,i)=><tr key={String(r.id)}><td><div className="person"><span>{String(r.student_name).split(" ").map(x=>x[0]).slice(0,2).join("")}</span><strong>{r.student_name}</strong></div></td><td><strong className="tahfidz-range">{tahfidzRange(r)}</strong></td><td>{r.amount} ayat</td><td><Status tone={i===2?"amber":"green"}>{r.grade}</Status></td><td className="muted">{new Date(String(r.recorded_at)).toLocaleDateString("id-ID")}</td><td><div className="row-actions"><button onClick={()=>onEdit(r)}>Ubah</button><button className="danger-link" onClick={()=>onDelete(r)}>Hapus</button></div></td></tr>)}</tbody>
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

function MutabaahPage({ rows, onAdd, onEdit, onDelete }: { rows:Row[]; onAdd:()=>void; onEdit:(row:Row)=>void; onDelete:(row:Row)=>void }) {
  const habits = [["Sholat Subuh Berjamaah",96],["Dzikir Pagi",89],["Sholat Dhuha",84],["Tilawah Harian",92],["Kajian Ba’da Maghrib",94],["Qiyamul Lail",71]];
  return (
    <>
      <section className="summary-banner"><div><span>Rekap Hari Ini</span><strong>92,6%</strong><p>450 dari 486 santri telah mengisi mutaba’ah</p></div><div className="donut"><span>93<small>%</small></span></div></section>
      <section className="dashboard-grid">
        <article className="card compact-list"><header className="card-header"><div><h3>Capaian Kegiatan</h3><p>Rekap kegiatan dan ibadah harian</p></div><button className="primary-button" onClick={onAdd}>+ Catat Kegiatan</button></header>
          {habits.map(([h,v],i)=><div className="progress-row habit" key={String(h)}><div><strong>{h}</strong><small>{Math.round(Number(v)*4.86)} santri</small></div><Progress value={Number(v)} tone={i===5?"amber":"green"} /><b>{v}%</b></div>)}
        </article>
        <article className="card"><header className="card-header"><div><h3>Perlu Perhatian</h3><p>Santri dengan capaian di bawah 70%</p></div></header>
          <div className="attention-list">{students.slice(2).map((s,i)=><div key={s.nis}><span className="avatar">{s.avatar}</span><div><strong>{s.name}</strong><small>{s.class} · {62+i*3}% tercapai</small></div><button>Hubungi</button></div>)}</div>
        </article>
      </section><section className="card data-card"><header className="card-header"><div><h3>Catatan Mutaba’ah Santri</h3><p>{rows.length} catatan tersimpan</p></div></header><div className="table-wrap"><table><thead><tr><th>Santri</th><th>Kegiatan</th><th>Tanggal</th><th>Status</th><th /></tr></thead><tbody>{rows.map(row=><tr key={String(row.id)}><td><strong>{row.student_name}</strong></td><td>{row.activity}</td><td>{row.record_date}</td><td><Status tone={Number(row.completed)?"green":"amber"}>{Number(row.completed)?"Selesai":"Belum"}</Status></td><td><DataActions row={row} onEdit={onEdit} onDelete={onDelete}/></td></tr>)}</tbody></table></div></section>
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

type SinurpayPayload = {
  accounts:Row[];
  entries:Row[];
  topups:Row[];
  products:Row[];
  sales:Row[];
  saleItems:Row[];
  stats:{totalBalance:number;todayRevenue:number;todayTransactions:number;lowStock:number};
};

function SinurpayPage({ notify }: { notify:(message:string)=>void }) {
  const [data,setData]=useState<SinurpayPayload>({accounts:[],entries:[],topups:[],products:[],sales:[],saleItems:[],stats:{totalBalance:0,todayRevenue:0,todayTransactions:0,lowStock:0}});
  const [tab,setTab]=useState<"cashier"|"savings"|"products"|"reports">("cashier");
  const [loading,setLoading]=useState(true);
  const [working,setWorking]=useState(false);
  const [scan,setScan]=useState("");
  const [cart,setCart]=useState<Record<string,number>>({});
  const [adjustment,setAdjustment]=useState({studentId:"",direction:"deposit",amount:"",note:""});
  const [product,setProduct]=useState({id:"",sku:"",name:"",category:"Makanan",price:"",stock:"",status:"Aktif"});

  const load=useCallback(async()=>{
    setLoading(true);
    try {
      const response=await fetch("/api/sinurpay",{cache:"no-store"});
      const result=await response.json() as SinurpayPayload&{error?:string};
      if(!response.ok) throw new Error(result.error||"SINURPAY tidak dapat dimuat.");
      setData(result);
      setAdjustment(current=>({...current,studentId:current.studentId||String(result.accounts[0]?.student_id??"")}));
    } catch(error) { notify(error instanceof Error?error.message:"SINURPAY tidak dapat dimuat."); }
    finally { setLoading(false); }
  },[notify]);
  useEffect(()=>{void load();},[load]);

  const scannedAccount=useMemo(()=>{
    const raw=scan.trim();
    if(!raw) return undefined;
    let token=raw,id="",nis=raw;
    try {
      const parsed=JSON.parse(raw) as {walletToken?:string;id?:number;nis?:string};
      token=String(parsed.walletToken||""); id=String(parsed.id||""); nis=String(parsed.nis||"");
    } catch { /* scanner may provide a raw card token or NIS */ }
    return data.accounts.find(account=>String(account.card_token)===token||String(account.student_id)===id||String(account.nis).toLowerCase()===nis.toLowerCase());
  },[scan,data.accounts]);
  const cartLines=data.products.filter(item=>cart[String(item.id)]).map(item=>({...item,quantity:cart[String(item.id)]}));
  const cartTotal=cartLines.reduce((sum,item)=>sum+Number(item.price)*item.quantity,0);

  function changeQuantity(id:unknown,delta:number) {
    const key=String(id);
    const item=data.products.find(row=>String(row.id)===key);
    setCart(current=>{
      const quantity=Math.max(0,Math.min(Number(item?.stock||0),Number(current[key]||0)+delta));
      const next={...current};
      if(quantity) next[key]=quantity; else delete next[key];
      return next;
    });
  }

  async function post(payload:Record<string,unknown>) {
    setWorking(true);
    try {
      const response=await fetch("/api/sinurpay",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload)});
      const result=await response.json() as {error?:string;receipt?:{receiptNo:string;balanceAfter:number}};
      if(!response.ok) throw new Error(result.error||"Tindakan SINURPAY gagal.");
      return result;
    } finally { setWorking(false); }
  }

  async function checkout() {
    try {
      const result=await post({action:"checkout",scan,cart:cartLines.map(item=>({productId:Number(item.id),quantity:item.quantity}))});
      notify(`Pembayaran berhasil · ${result.receipt?.receiptNo} · saldo Rp${money.format(Number(result.receipt?.balanceAfter||0))}.`);
      setCart({});setScan("");await load();
    } catch(error) { notify(error instanceof Error?error.message:"Pembayaran gagal."); }
  }

  async function adjustWallet(event:React.FormEvent) {
    event.preventDefault();
    try {
      await post({action:"wallet-adjust",studentId:Number(adjustment.studentId),direction:adjustment.direction,amount:Number(adjustment.amount),note:adjustment.note});
      notify(adjustment.direction==="deposit"?"Setoran berhasil dicatat.":"Penarikan berhasil dicatat.");
      setAdjustment(current=>({...current,amount:"",note:""}));await load();
    } catch(error) { notify(error instanceof Error?error.message:"Perubahan saldo gagal."); }
  }

  async function updateAccount(account:Row) {
    const limit=window.prompt(`Limit belanja harian ${account.student_name}:`,String(account.daily_limit||50000));
    if(limit===null) return;
    const block=window.confirm(`Klik OK untuk ${account.status==="Aktif"?"memblokir":"mengaktifkan"} kartu ${account.student_name}. Klik Batal untuk hanya mengubah limit.`);
    const status=block?(account.status==="Aktif"?"Diblokir":"Aktif"):String(account.status);
    try {
      await post({action:"update-account",studentId:Number(account.student_id),dailyLimit:Number(limit),status});
      notify(`Rekening ${account.student_name} diperbarui.`);await load();
    } catch(error) { notify(error instanceof Error?error.message:"Rekening gagal diperbarui."); }
  }

  async function saveProduct(event:React.FormEvent) {
    event.preventDefault();
    try {
      await post({action:"product-save",product:{...product,id:Number(product.id||0),price:Number(product.price),stock:Number(product.stock)}});
      notify("Produk kantin berhasil disimpan.");
      setProduct({id:"",sku:"",name:"",category:"Makanan",price:"",stock:"",status:"Aktif"});await load();
    } catch(error) { notify(error instanceof Error?error.message:"Produk gagal disimpan."); }
  }

  async function reverseSale(sale:Row) {
    if(!window.confirm(`Batalkan transaksi ${sale.receipt_no}? Saldo dan stok akan dikembalikan.`)) return;
    try { await post({action:"reverse-sale",saleId:Number(sale.id)});notify("Transaksi dibatalkan dan dana dikembalikan.");await load(); }
    catch(error) { notify(error instanceof Error?error.message:"Pembatalan gagal."); }
  }

  async function verifyTopup(topup:Row) {
    if(!window.confirm(`Verifikasi transfer ${topup.topup_no} sebesar Rp${money.format(Number(topup.amount))}?`)) return;
    setWorking(true);
    try {
      const response=await fetch("/api/sinurpay/topup",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"verify",topupId:Number(topup.id)})});
      const result=await response.json() as {error?:string};
      if(!response.ok) throw new Error(result.error||"Verifikasi gagal.");
      notify("Top-up terverifikasi dan saldo santri bertambah.");await load();
    } catch(error) { notify(error instanceof Error?error.message:"Verifikasi gagal."); }
    finally { setWorking(false); }
  }

  return <div className="sinurpay-page">
    <section className="sinurpay-hero">
      <div><span>SINURPAY · KANTIN CASHLESS</span><h2>Belanja aman tanpa uang tunai.</h2><p>Scan kartu santri, proses pembayaran, dan pantau buku tabungan dalam satu sistem.</p></div>
      <div className="sinurpay-live"><i /><span>Sistem kasir</span><strong>{loading?"Menyinkronkan":"Siap digunakan"}</strong></div>
    </section>
    <section className="stats-grid four">
      <article className="metric-card"><MiniIcon tone="blue">Rp</MiniIcon><div><span>Total Saldo Santri</span><strong>Rp{money.format(data.stats.totalBalance)}</strong><small>{data.accounts.length} rekening aktif</small></div></article>
      <article className="metric-card"><MiniIcon tone="green">✓</MiniIcon><div><span>Omzet Hari Ini</span><strong>Rp{money.format(data.stats.todayRevenue)}</strong><small>{data.stats.todayTransactions} transaksi berhasil</small></div></article>
      <article className="metric-card"><MiniIcon tone="violet">QR</MiniIcon><div><span>Kartu Aktif</span><strong>{data.accounts.filter(row=>row.status==="Aktif").length}</strong><small>Barcode siap dipindai</small></div></article>
      <article className="metric-card"><MiniIcon tone="amber">!</MiniIcon><div><span>Stok Menipis</span><strong>{data.stats.lowStock}</strong><small>Produk perlu ditambah</small></div></article>
    </section>
    <nav className="sinurpay-tabs" aria-label="Menu SINURPAY">
      {([["cashier","Kasir Kantin","fi-rr-cash-register"],["savings","Buku Tabungan","fi-rr-money-check-edit"],["products","Produk & Stok","fi-rr-boxes"],["reports","Transaksi & Laporan","fi-rr-receipt"]] as const).map(item=><button key={item[0]} className={tab===item[0]?"active":""} onClick={()=>setTab(item[0])}><ToolIcon name={item[2]}/><span>{item[1]}</span></button>)}
    </nav>

    {tab==="cashier"&&<section className="sinurpay-pos">
      <div className="card pos-catalog">
        <header><div><span>LANGKAH 1</span><h3>Scan kartu santri</h3><p>Fokus otomatis cocok untuk scanner USB; QR kartu juga dapat ditempel dari hasil pemindaian kamera.</p></div><ToolIcon name="fi-rr-qr-scan"/></header>
        <div className={`card-scanner ${scannedAccount?"verified":""}`}>
          <ToolIcon name={scannedAccount?"fi-rr-badge-check":"fi-rr-credit-card"}/>
          <input autoFocus value={scan} onChange={event=>setScan(event.target.value)} placeholder="Scan kartu atau masukkan NIS…" aria-label="Scan kartu santri"/>
          {scan&&<button type="button" onClick={()=>setScan("")}>×</button>}
        </div>
        {scannedAccount?<div className="scanned-student"><span>{String(scannedAccount.student_name).split(" ").map(value=>value[0]).slice(0,2).join("")}</span><div><strong>{scannedAccount.student_name}</strong><small>{scannedAccount.nis} · {scannedAccount.class_name} · {scannedAccount.room}</small></div><div><small>Saldo tersedia</small><strong>Rp{money.format(Number(scannedAccount.balance))}</strong><Status tone={scannedAccount.status==="Aktif"?"green":"red"}>{scannedAccount.status}</Status></div></div>:<div className="scan-helper">Kartu belum dipindai. Kasir tetap dapat menyiapkan keranjang.</div>}
        <header className="product-heading"><div><span>LANGKAH 2</span><h3>Pilih produk</h3></div><small>{data.products.filter(row=>row.status==="Aktif").length} produk tersedia</small></header>
        <div className="product-grid">{data.products.filter(row=>row.status==="Aktif").map((item,index)=><button key={String(item.id)} disabled={Number(item.stock)<1} onClick={()=>changeQuantity(item.id,1)}>
          <span className={`product-symbol tone-${index%4}`}><ToolIcon name={item.category==="Minuman"?"fi-rr-drink-alt":item.category==="Alat Tulis"?"fi-rr-pencil":"fi-rr-hamburger"}/></span>
          <strong>{item.name}</strong><small>{item.category} · stok {item.stock}</small><b>Rp{money.format(Number(item.price))}</b>{cart[String(item.id)]&&<em>{cart[String(item.id)]}</em>}
        </button>)}</div>
      </div>
      <aside className="card pos-cart">
        <header><div><span>LANGKAH 3</span><h3>Keranjang Belanja</h3></div><b>{cartLines.reduce((sum,item)=>sum+item.quantity,0)} item</b></header>
        <div className="cart-lines">{cartLines.length?cartLines.map(item=><article key={String(item.id)}><div><strong>{item.name}</strong><small>Rp{money.format(Number(item.price))} × {item.quantity}</small></div><div className="quantity-control"><button onClick={()=>changeQuantity(item.id,-1)}>−</button><span>{item.quantity}</span><button onClick={()=>changeQuantity(item.id,1)}>+</button></div><b>Rp{money.format(Number(item.price)*item.quantity)}</b></article>):<div className="cart-empty"><ToolIcon name="fi-rr-shopping-basket"/><strong>Keranjang masih kosong</strong><span>Pilih produk dari katalog kantin.</span></div>}</div>
        <dl><div><dt>Subtotal</dt><dd>Rp{money.format(cartTotal)}</dd></div><div><dt>Biaya layanan</dt><dd>Rp0</dd></div><div><dt>Total</dt><dd>Rp{money.format(cartTotal)}</dd></div></dl>
        <button className="checkout-button" disabled={working||!scannedAccount||!cartLines.length||scannedAccount.status!=="Aktif"} onClick={()=>void checkout()}><ToolIcon name="fi-rr-shield-check"/>{working?"Memproses transaksi…":"Bayar dengan Saldo"}</button>
        <small className="checkout-note">Transaksi tercatat otomatis dan notifikasi WhatsApp dikirim kepada wali.</small>
      </aside>
    </section>}

    {tab==="savings"&&<section className="sinurpay-management">
      <form className="card wallet-adjust" onSubmit={adjustWallet}><span className="section-kicker">BUKU TABUNGAN</span><h3>Setoran atau penarikan</h3><p>Saldo hanya berubah melalui transaksi yang tercatat di buku besar.</p>
        <label>Santri<select required value={adjustment.studentId} onChange={event=>setAdjustment({...adjustment,studentId:event.target.value})}>{data.accounts.map(account=><option key={String(account.student_id)} value={String(account.student_id)}>{account.student_name} · {account.nis}</option>)}</select></label>
        <div className="direction-switch"><button type="button" className={adjustment.direction==="deposit"?"active":""} onClick={()=>setAdjustment({...adjustment,direction:"deposit"})}>Setoran</button><button type="button" className={adjustment.direction==="withdraw"?"active":""} onClick={()=>setAdjustment({...adjustment,direction:"withdraw"})}>Penarikan</button></div>
        <label>Nominal<input required min="1000" step="1000" type="number" value={adjustment.amount} onChange={event=>setAdjustment({...adjustment,amount:event.target.value})} placeholder="Contoh: 100000"/></label>
        <label>Catatan<input required value={adjustment.note} onChange={event=>setAdjustment({...adjustment,note:event.target.value})} placeholder="Sumber setoran atau keperluan penarikan"/></label>
        <button disabled={working} className="primary-button">{working?"Menyimpan…":"Simpan Transaksi"}</button>
      </form>
      <article className="card data-card wallet-accounts"><header className="card-header"><div><h3>Rekening Santri</h3><p>Saldo, limit harian, dan status kartu</p></div></header><div className="table-wrap"><table><thead><tr><th>Santri</th><th>Saldo</th><th>Limit Harian</th><th>Kartu</th><th /></tr></thead><tbody>{data.accounts.map(account=><tr key={String(account.id)}><td><strong>{account.student_name}</strong><small className="cell-note">{account.nis} · {account.class_name}</small></td><td><strong>Rp{money.format(Number(account.balance))}</strong></td><td>Rp{money.format(Number(account.daily_limit))}</td><td><Status tone={account.status==="Aktif"?"green":"red"}>{account.status}</Status></td><td><button className="text-button" onClick={()=>void updateAccount(account)}>Atur</button></td></tr>)}</tbody></table></div></article>
      <article className="card data-card wallet-ledger"><header className="card-header"><div><h3>Mutasi Terbaru</h3><p>Jejak saldo yang tidak dapat diedit langsung</p></div></header><div className="portal-list">{data.entries.slice(0,12).map(entry=><div key={String(entry.id)}><div><strong>{entry.student_name} · {entry.entry_type}</strong><small>{entry.reference} · {String(entry.created_at).slice(0,16).replace("T"," ")}<br/>{entry.note}</small></div><b className={Number(entry.amount)>=0?"amount-in":"amount-out"}>{Number(entry.amount)>=0?"+":"−"}Rp{money.format(Math.abs(Number(entry.amount)))}</b><small>Saldo Rp{money.format(Number(entry.balance_after))}</small></div>)}</div></article>
      <article className="card data-card wallet-ledger"><header className="card-header"><div><h3>Top-up Wali Santri</h3><p>QRIS terverifikasi otomatis; transfer bank dapat dikonfirmasi Admin</p></div></header><div className="table-wrap"><table><thead><tr><th>Referensi</th><th>Santri</th><th>Metode</th><th>Nominal</th><th>Status</th><th /></tr></thead><tbody>{data.topups.map(topup=><tr key={String(topup.id)}><td className="muted">{topup.topup_no}</td><td><strong>{topup.student_name}</strong></td><td>{topup.provider||topup.method}</td><td>Rp{money.format(Number(topup.amount))}</td><td><Status tone={topup.status==="Berhasil"?"green":"amber"}>{topup.status}</Status></td><td>{topup.status==="Menunggu Verifikasi"&&<button className="text-button" disabled={working} onClick={()=>void verifyTopup(topup)}>Verifikasi</button>}</td></tr>)}</tbody></table></div></article>
    </section>}

    {tab==="products"&&<section className="sinurpay-management">
      <form className="card product-form" onSubmit={saveProduct}><span className="section-kicker">KATALOG KANTIN</span><h3>{product.id?"Ubah produk":"Tambah produk"}</h3><p>Stok otomatis berkurang setelah pembayaran berhasil.</p>
        <div className="form-grid"><label>SKU<input required value={product.sku} onChange={event=>setProduct({...product,sku:event.target.value})}/></label><label>Nama produk<input required value={product.name} onChange={event=>setProduct({...product,name:event.target.value})}/></label><label>Kategori<select value={product.category} onChange={event=>setProduct({...product,category:event.target.value})}><option>Makanan</option><option>Minuman</option><option>Alat Tulis</option><option>Kebutuhan Harian</option></select></label><label>Harga<input required min="1" type="number" value={product.price} onChange={event=>setProduct({...product,price:event.target.value})}/></label><label>Stok<input required min="0" type="number" value={product.stock} onChange={event=>setProduct({...product,stock:event.target.value})}/></label><label>Status<select value={product.status} onChange={event=>setProduct({...product,status:event.target.value})}><option>Aktif</option><option>Nonaktif</option></select></label></div>
        <div className="header-actions">{product.id&&<button type="button" className="secondary-button" onClick={()=>setProduct({id:"",sku:"",name:"",category:"Makanan",price:"",stock:"",status:"Aktif"})}>Batal</button>}<button disabled={working} className="primary-button">Simpan Produk</button></div>
      </form>
      <article className="card data-card product-table"><header className="card-header"><div><h3>Produk & Stok</h3><p>{data.products.length} produk terdaftar</p></div></header><div className="table-wrap"><table><thead><tr><th>SKU</th><th>Produk</th><th>Harga</th><th>Stok</th><th>Status</th><th /></tr></thead><tbody>{data.products.map(item=><tr key={String(item.id)}><td className="muted">{item.sku}</td><td><strong>{item.name}</strong><small className="cell-note">{item.category}</small></td><td>Rp{money.format(Number(item.price))}</td><td><Status tone={Number(item.stock)<=10?"amber":"green"}>{item.stock} unit</Status></td><td>{item.status}</td><td><button className="text-button" onClick={()=>setProduct({id:String(item.id),sku:String(item.sku),name:String(item.name),category:String(item.category),price:String(item.price),stock:String(item.stock),status:String(item.status)})}>Ubah</button></td></tr>)}</tbody></table></div></article>
    </section>}

    {tab==="reports"&&<section className="card data-card sinurpay-sales"><header className="card-header"><div><h3>Transaksi Kantin</h3><p>Riwayat pembayaran, pembatalan, kasir, dan referensi</p></div><a className="secondary-button link-button" href="/api/sinurpay?format=csv">Ekspor CSV</a></header><div className="table-wrap"><table><thead><tr><th>Referensi</th><th>Santri</th><th>Waktu</th><th>Belanja</th><th>Total</th><th>Status</th><th /></tr></thead><tbody>{data.sales.map(sale=>{const items=data.saleItems.filter(item=>Number(item.sale_id)===Number(sale.id));return <tr key={String(sale.id)}><td className="muted">{sale.receipt_no}</td><td><strong>{sale.student_name}</strong><small className="cell-note">{sale.nis}</small></td><td>{String(sale.created_at).slice(0,16).replace("T"," ")}</td><td>{items.map(item=>`${item.product_name} ×${item.quantity}`).join(", ")||"-"}</td><td><strong>Rp{money.format(Number(sale.total))}</strong></td><td><Status tone={sale.status==="Berhasil"?"green":"red"}>{sale.status}</Status></td><td>{sale.status==="Berhasil"&&<button className="danger-link" onClick={()=>void reverseSale(sale)}>Batalkan</button>}</td></tr>})}{!data.sales.length&&<tr><td colSpan={7} className="muted">Belum ada transaksi kantin.</td></tr>}</tbody></table></div></section>}
  </div>;
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
      </section><section className="card data-card"><header className="card-header"><div><h3>Tagihan Santri</h3><p>QRIS, rekonsiliasi otomatis, dan kuitansi digital</p></div><button className="primary-button" onClick={onBill}>+ Buat Tagihan</button></header><div className="table-wrap"><table><thead><tr><th>Invoice</th><th>Santri</th><th>Kategori</th><th>Nominal</th><th>Jatuh Tempo</th><th>Status</th><th /></tr></thead><tbody>{bills.map(x=><tr key={String(x.id)}><td className="muted">{x.invoice_no}</td><td><strong>{x.student_name}</strong></td><td>{x.category}</td><td>Rp {money.format(Number(x.amount))}</td><td>{x.due_date}</td><td><Status tone={x.status==="Lunas"?"green":"amber"}>{x.status}</Status></td><td>{x.status!=="Lunas"?<button className="text-button" onClick={()=>onPayment(x)}>QR Bayar</button>:<a className="text-button link-button" href={`/api/receipt?id=${x.id}`}>Kuitansi</a>}</td></tr>)}</tbody></table></div></section>
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

function AcademicPage({ data, role, edit, remove }: { data:AppData; role:Role; edit:(r:Resource,row?:Row)=>void; remove:(r:Resource,row:Row)=>void }) {
  const average=data.grades.length?Math.round(data.grades.reduce((sum,row)=>sum+Number(row.final_score||0),0)/data.grades.length):0;
  const passed=data.grades.filter(row=>Number(row.final_score)>=Number(row.minimum_score||75)).length;
  return <><section className="stats-grid three"><article className="metric-card"><MiniIcon tone="blue">A</MiniIcon><div><span>Rata-rata Nilai</span><strong>{average||"-"}</strong><small>Bobot 30% tugas, 30% PTS, 40% PAS</small></div></article><article className="metric-card"><MiniIcon tone="green">✓</MiniIcon><div><span>Tuntas</span><strong>{passed}</strong><small>dari {data.grades.length} nilai</small></div></article><article className="metric-card"><MiniIcon tone="violet">▦</MiniIcon><div><span>Mata Pelajaran</span><strong>{data.subjects.length}</strong><small>SMP dan SMK</small></div></article></section>
    <section className="dashboard-grid operations-grid"><article className="card data-card"><header className="card-header"><div><h3>Nilai Akademik</h3><p>Nilai akhir dan predikat dihitung otomatis</p></div><button className="primary-button" onClick={()=>edit("grades")}>+ Input Nilai</button></header><div className="table-wrap"><table><thead><tr><th>Santri</th><th>Mata Pelajaran</th><th>Tugas</th><th>PTS</th><th>PAS</th><th>Nilai Akhir</th><th /></tr></thead><tbody>{data.grades.map(row=><tr key={String(row.id)}><td><strong>{row.student_name}</strong></td><td>{row.subject_name}<small className="cell-note">{row.semester} · {row.academic_year}</small></td><td>{row.assignment_score}</td><td>{row.midterm_score}</td><td>{row.exam_score}</td><td><Status tone={Number(row.final_score)>=Number(row.minimum_score||75)?"green":"amber"}>{row.final_score} · {row.predicate}</Status></td><td><DataActions row={row} onEdit={item=>edit("grades",item)} onDelete={item=>remove("grades",item)}/></td></tr>)}{!data.grades.length&&<tr><td colSpan={7} className="muted">Belum ada nilai akademik.</td></tr>}</tbody></table></div></article>
    <article className="card data-card"><header className="card-header"><div><h3>Master Mata Pelajaran</h3><p>Kurikulum SMP–SMK per kelas</p></div>{role==="Admin"&&<button className="primary-button" onClick={()=>edit("subjects")}>+ Mata Pelajaran</button>}</header><div className="table-wrap"><table><thead><tr><th>Kode</th><th>Mata Pelajaran</th><th>Kelas</th><th>Guru</th><th>KKM</th><th /></tr></thead><tbody>{data.subjects.map(row=><tr key={String(row.id)}><td className="muted">{row.code}</td><td><strong>{row.name}</strong></td><td>{row.education_level} · {row.class_name}</td><td>{row.teacher}</td><td>{row.minimum_score}</td><td>{role==="Admin"&&<DataActions row={row} onEdit={item=>edit("subjects",item)} onDelete={item=>remove("subjects",item)}/>}</td></tr>)}</tbody></table></div></article></section></>;
}

function AttendancePage({ data, edit, remove, reload, notify }: { data:AppData; edit:(r:Resource,row?:Row)=>void; remove:(r:Resource,row:Row)=>void; reload:()=>Promise<void>; notify:(message:string)=>void }) {
  const [token,setToken]=useState("");
  const [checking,setChecking]=useState(false);
  const [attendanceToken,setAttendanceToken]=useState("");
  const [attendanceStatus,setAttendanceStatus]=useState("Hadir");
  const [scanning,setScanning]=useState(false);
  async function scanAttendance() {
    setScanning(true);
    const response=await fetch("/api/attendance-qr",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({token:attendanceToken,status:attendanceStatus})});
    const result=await response.json() as {error?:string;student?:{name?:string};updated?:boolean};
    setScanning(false);
    if(!response.ok){notify(result.error||"Presensi QR gagal.");return;}
    setAttendanceToken("");notify(`${result.student?.name||"Santri"} ${result.updated?"diperbarui":"tercatat"}: ${attendanceStatus}.`);await reload();
  }
  async function processRequest(row:Row|undefined,action:"approve"|"reject"|"use") {
    setChecking(true);
    const response=await fetch("/api/guardian-requests",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify(row?{id:Number(row.id),action}:{token,action})});
    const result=await response.json() as {error?:string};
    setChecking(false);
    if(!response.ok){notify(result.error||"Permintaan gagal diproses.");return;}
    setToken(""); notify(action==="approve"?"Permintaan disetujui dan QR diterbitkan.":action==="reject"?"Permintaan ditolak.":"QR valid dan sudah ditandai digunakan."); await reload();
  }
  return <><section className="stats-grid three"><article className="metric-card"><MiniIcon tone="green">✓</MiniIcon><div><span>Hadir Hari Ini</span><strong>{data.attendance.filter(x=>x.status==="Hadir").length}</strong><small>Catatan tersinkron</small></div></article><article className="metric-card"><MiniIcon tone="amber">◷</MiniIcon><div><span>Izin Aktif</span><strong>{data.permits.filter(x=>x.status==="Disetujui").length}</strong><small>Perlu dipantau</small></div></article><article className="metric-card"><MiniIcon tone="red">!</MiniIcon><div><span>Tanpa Keterangan</span><strong>{data.attendance.filter(x=>x.status==="Alpa").length}</strong><small>Hari ini</small></div></article></section>
  <section className="card qr-attendance"><MiniIcon tone="blue">QR</MiniIcon><div><h3>Presensi Kartu Santri</h3><p>Scan QR kartu dengan kamera/perangkat pemindai, lalu tempel hasilnya. Satu santri hanya memiliki satu catatan per hari.</p></div><select value={attendanceStatus} onChange={event=>setAttendanceStatus(event.target.value)}><option>Hadir</option><option>Terlambat</option><option>Sakit</option><option>Izin</option><option>Alpa</option></select><input value={attendanceToken} onChange={event=>setAttendanceToken(event.target.value)} placeholder='Hasil scan QR kartu santri' /><button className="primary-button" disabled={scanning||!attendanceToken.trim()} onClick={()=>void scanAttendance()}>{scanning?"Memproses…":"Catat Presensi"}</button></section>
  <section className="dashboard-grid operations-grid"><article className="card data-card"><header className="card-header"><div><h3>Absensi Santri</h3><p>Rekap kehadiran terbaru</p></div><button className="primary-button" onClick={()=>edit("attendance")}>+ Catat Absensi</button></header><div className="table-wrap"><table><thead><tr><th>Santri</th><th>Tanggal</th><th>Status</th><th>Catatan</th><th /></tr></thead><tbody>{data.attendance.map(x=><tr key={String(x.id)}><td><strong>{x.student_name}</strong></td><td>{x.record_date}</td><td><Status tone={x.status==="Hadir"?"green":x.status==="Alpa"?"red":"amber"}>{x.status}</Status></td><td>{x.note}</td><td><DataActions row={x} onEdit={r=>edit("attendance",r)} onDelete={r=>remove("attendance",r)} /></td></tr>)}</tbody></table></div></article>
  <article className="card data-card"><header className="card-header"><div><h3>Perizinan</h3><p>Izin pulang, sakit, dan keperluan keluarga</p></div><button className="primary-button" onClick={()=>edit("permits")}>+ Ajukan Izin</button></header><div className="table-wrap"><table><thead><tr><th>Santri</th><th>Periode</th><th>Status</th><th /></tr></thead><tbody>{data.permits.map(x=><tr key={String(x.id)}><td><strong>{x.student_name}</strong><small className="cell-note">{x.reason}</small></td><td>{x.start_date} – {x.end_date}</td><td><Status tone={x.status==="Disetujui"?"green":"amber"}>{x.status}</Status></td><td><DataActions row={x} onEdit={r=>edit("permits",r)} onDelete={r=>remove("permits",r)} /></td></tr>)}</tbody></table></div></article></section>
  <section className="card data-card guardian-request-admin"><header className="card-header responsive"><div><h3>Kunjungan & Penjemputan</h3><p>Setujui permintaan dan validasi QR sekali pakai di gerbang</p></div><div className="gate-validator"><input value={token} onChange={e=>setToken(e.target.value)} placeholder="Tempel token hasil scan QR" /><button disabled={checking||!token.trim()} className="primary-button" onClick={()=>void processRequest(undefined,"use")}>Validasi QR</button></div></header><div className="table-wrap"><table><thead><tr><th>Santri</th><th>Jenis & Jadwal</th><th>Penjemput/Pengunjung</th><th>Status</th><th /></tr></thead><tbody>{data.guardianRequests.map(x=><tr key={String(x.id)}><td><strong>{x.student_name}</strong><small className="cell-note">{x.nis}</small></td><td><strong>{x.type}</strong><small className="cell-note">{x.visit_date} · {x.start_time}–{x.end_time}<br/>{x.purpose}</small></td><td>{x.visitor_name}<small className="cell-note">{x.visitor_phone}</small></td><td><Status tone={x.status==="Disetujui"?"green":x.status==="Ditolak"?"red":x.status==="Digunakan"?"blue":"amber"}>{x.status}</Status></td><td><div className="row-actions">{x.status==="Diajukan"&&<><button onClick={()=>void processRequest(x,"approve")}>Setujui</button><button className="danger-link" onClick={()=>void processRequest(x,"reject")}>Tolak</button></>}{x.status==="Disetujui"&&<button onClick={()=>void processRequest(x,"use")}>Tandai Masuk</button>}</div></td></tr>)}{!data.guardianRequests.length&&<tr><td colSpan={5} className="muted">Belum ada permintaan kunjungan atau penjemputan.</td></tr>}</tbody></table></div></section></>;
}

function SchedulePage({ data, edit, remove }: { data:AppData; edit:(r:Resource,row?:Row)=>void; remove:(r:Resource,row:Row)=>void }) {
  const [level,setLevel]=useState("SMP");
  const classes=Array.from(new Set(data.schedules.filter(x=>x.education_level===level).map(x=>String(x.class_name)))).sort();
  const [selectedClass,setSelectedClass]=useState("VII A");
  const [day,setDay]=useState("Senin");
  const activeClass=classes.includes(selectedClass)?selectedClass:(classes[0]??selectedClass);
  const filtered=data.schedules.filter(x=>x.education_level===level&&x.class_name===activeClass&&x.day_name===day);
  return <><section className="schedule-toolbar card"><div className="level-tabs"><button className={level==="SMP"?"active":""} onClick={()=>setLevel("SMP")}>SMP</button><button className={level==="SMK"?"active":""} onClick={()=>setLevel("SMK")}>SMK</button></div><label>Kelas<select value={activeClass} onChange={e=>setSelectedClass(e.target.value)}>{classes.map(x=><option key={x}>{x}</option>)}</select></label><label>Hari<select value={day} onChange={e=>setDay(e.target.value)}>{["Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"].map(x=><option key={x}>{x}</option>)}</select></label><button className="primary-button" onClick={()=>edit("schedules",{education_level:level,class_name:activeClass,day_name:day})}>+ Tambah Pelajaran</button></section><section className="dashboard-grid operations-grid"><article className="card data-card"><header className="card-header"><div><h3>Jadwal Harian {activeClass}</h3><p>{day} · {level} · {filtered.length} jam pelajaran</p></div><Status tone={level==="SMP"?"blue":"violet"}>{level}</Status></header><div className="daily-timetable">{filtered.length?filtered.map((x,i)=><div key={String(x.id)}><span className="period-number">{i+1}</span><span className={`schedule-time tone-${i%4}`}>{x.start_time}<small>{x.end_time}</small></span><div><Status tone={x.category==="Produktif"?"violet":x.category==="Tahfidz"?"green":"blue"}>{x.category}</Status><strong>{x.title}</strong><small>{x.teacher} · {x.location}</small></div><DataActions row={x} onEdit={r=>edit("schedules",r)} onDelete={r=>remove("schedules",r)} /></div>):<div className="empty-schedule">Belum ada jadwal untuk kelas dan hari ini.</div>}</div></article>
  <article className="card data-card"><header className="card-header"><div><h3>Kamar & Hunian</h3><p>Kapasitas dan pembina asrama</p></div><button className="primary-button" onClick={()=>edit("rooms")}>+ Kamar</button></header><div className="room-grid">{data.rooms.map(x=><div className="room-card" key={String(x.id)}><span>◇</span><div><strong>{x.name}</strong><small>{x.supervisor}</small><p>Kapasitas {x.capacity} santri</p></div><Status>{x.status}</Status><DataActions row={x} onEdit={r=>edit("rooms",r)} onDelete={r=>remove("rooms",r)} /></div>)}</div></article></section></>;
}

const ppdbDocumentTypes = ["Kartu Keluarga","Akta Kelahiran","Rapor Terakhir","Pas Foto","KIP / SKTM"];
const ppdbStatuses = ["Pendaftaran","Verifikasi Dokumen","Perlu Perbaikan","Terverifikasi","Tes","Lulus","Tidak Lulus"];

function ppdbTone(status: unknown) {
  if (["Lulus","Terverifikasi","Valid"].includes(String(status))) return "green";
  if (["Perlu Perbaikan","Ditolak","Tidak Lulus"].includes(String(status))) return "red";
  if (["Pendaftaran","Menunggu"].includes(String(status))) return "amber";
  return "blue";
}

function PpdbApplicationModal({ onClose, onSaved, notify }: { onClose:()=>void; onSaved:()=>Promise<void>; notify:(message:string)=>void }) {
  const [form,setForm]=useState({name:"",nisn:"",birth_place:"",birth_date:"",gender:"Laki-laki",desired_level:"SMP",guardian_name:"",guardian_phone:"",previous_school:"",address:""});
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");
  async function submit(event:React.FormEvent) {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const response=await fetch("/api/admissions",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(form)});
      const result=await response.json() as {error?:string;message?:string;registrationNo?:string};
      if(!response.ok) throw new Error(result.error||"Pendaftaran gagal disimpan.");
      await onSaved(); notify(`${result.message} Nomor: ${result.registrationNo}`); onClose();
    } catch(e) { setError(e instanceof Error?e.message:"Pendaftaran gagal disimpan."); setSaving(false); }
  }
  const field=(key:keyof typeof form,value:string)=>setForm(current=>({...current,[key]:value}));
  return <div className="modal-backdrop" onMouseDown={onClose}><form className="record-modal ppdb-form-modal" onSubmit={submit} onMouseDown={e=>e.stopPropagation()}>
    <button type="button" className="modal-close" onClick={onClose}>×</button><span className="modal-eyebrow">PPDB ONLINE 2026/2027</span><h2>Formulir calon santri</h2><p>Nomor pendaftaran dibuat otomatis. Pastikan data sesuai dokumen resmi.</p>
    <div className="form-grid">
      <label>Nama lengkap<input required value={form.name} onChange={e=>field("name",e.target.value)}/></label>
      <label>NISN<input required inputMode="numeric" value={form.nisn} onChange={e=>field("nisn",e.target.value)}/></label>
      <label>Tempat lahir<input required value={form.birth_place} onChange={e=>field("birth_place",e.target.value)}/></label>
      <label>Tanggal lahir<input required type="date" value={form.birth_date} onChange={e=>field("birth_date",e.target.value)}/></label>
      <label>Jenis kelamin<select required value={form.gender} onChange={e=>field("gender",e.target.value)}><option>Laki-laki</option><option>Perempuan</option></select></label>
      <label>Jenjang tujuan<select required value={form.desired_level} onChange={e=>field("desired_level",e.target.value)}><option>SMP</option><option>SMK</option></select></label>
      <label>Asal sekolah<input required value={form.previous_school} onChange={e=>field("previous_school",e.target.value)}/></label>
      <label>Nama wali<input required value={form.guardian_name} onChange={e=>field("guardian_name",e.target.value)}/></label>
      <label>WhatsApp wali<input required type="tel" placeholder="08xxxxxxxxxx" value={form.guardian_phone} onChange={e=>field("guardian_phone",e.target.value)}/></label>
      <label className="wide">Alamat lengkap<textarea required value={form.address} onChange={e=>field("address",e.target.value)}/></label>
    </div>
    {error&&<div className="form-error">{error}</div>}<div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Batal</button><button className="primary-button" disabled={saving}>{saving?"Menyimpan…":"Kirim Pendaftaran →"}</button></div>
  </form></div>;
}

function PpdbDocumentsModal({ admission, documents, role, onClose, onUpdated, notify }: { admission:Row; documents:Row[]; role:Role; onClose:()=>void; onUpdated:()=>Promise<void>; notify:(message:string)=>void }) {
  const [uploading,setUploading]=useState("");
  const [error,setError]=useState("");
  const relevant=documents.filter(x=>Number(x.admission_id)===Number(admission.id));
  async function upload(docType:string,file:File) {
    setUploading(docType); setError("");
    try {
      const body=new FormData(); body.set("admissionId",String(admission.id)); body.set("docType",docType); body.set("file",file);
      const response=await fetch("/api/admissions/documents",{method:"POST",body});
      const result=await response.json() as {error?:string;message?:string};
      if(!response.ok) throw new Error(result.error||"Unggah dokumen gagal.");
      await onUpdated(); notify(result.message||"Dokumen berhasil diunggah.");
    } catch(e) { setError(e instanceof Error?e.message:"Unggah dokumen gagal."); }
    finally { setUploading(""); }
  }
  async function verify(document:Row,status:"Valid"|"Ditolak") {
    const note=status==="Ditolak"?window.prompt("Tuliskan alasan penolakan dokumen:","Dokumen kurang jelas atau tidak sesuai."):"";
    if(status==="Ditolak"&&!note?.trim()) return;
    const response=await fetch("/api/admissions/documents",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({id:document.id,status,verification_note:note||""})});
    const result=await response.json() as {error?:string;message?:string};
    if(!response.ok){notify(result.error||"Verifikasi dokumen gagal.");return;}
    await onUpdated(); notify(result.message||"Status dokumen diperbarui.");
  }
  async function remove(document:Row) {
    if(!window.confirm(`Hapus ${document.file_name}?`)) return;
    const response=await fetch(`/api/admissions/documents?id=${document.id}`,{method:"DELETE"});
    const result=await response.json() as {error?:string;message?:string};
    if(!response.ok){notify(result.error||"Dokumen gagal dihapus.");return;}
    await onUpdated(); notify(result.message||"Dokumen dihapus.");
  }
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="record-modal ppdb-documents-modal" onMouseDown={e=>e.stopPropagation()}>
    <button type="button" className="modal-close" onClick={onClose}>×</button><span className="modal-eyebrow">BERKAS PPDB</span><h2>{admission.name}</h2><p>{admission.registration_no} · PDF/JPG/PNG, maksimal 5 MB per berkas.</p>
    <div className="document-checklist">{ppdbDocumentTypes.map(docType=>{
      const entries=relevant.filter(x=>x.doc_type===docType);
      const latest=entries[0];
      return <article key={docType}><div className="document-main"><span className={`document-icon ${latest?"ready":""}`}>{latest?"✓":"＋"}</span><div><strong>{docType}{docType==="KIP / SKTM"&&<em>Opsional</em>}</strong>{latest?<><a href={`/api/admissions/documents?id=${latest.id}`} target="_blank" rel="noreferrer">{latest.file_name}</a><small>{(Number(latest.size_bytes)/1024/1024).toFixed(2)} MB · {latest.uploaded_at?new Date(String(latest.uploaded_at)).toLocaleDateString("id-ID"):""}</small>{latest.verification_note&&<p>{latest.verification_note}</p>}</>:<small>Belum ada dokumen</small>}</div></div><div className="document-actions">{latest&&<Status tone={ppdbTone(latest.status)}>{latest.status}</Status>}{role==="Admin"&&latest?<><button onClick={()=>void verify(latest,"Valid")}>Valid</button><button className="danger-link" onClick={()=>void verify(latest,"Ditolak")}>Tolak</button></>:<label className="upload-button">{uploading===docType?"Mengunggah…":latest?.status==="Ditolak"?"Unggah Ulang":"Pilih Berkas"}<input type="file" accept=".pdf,.jpg,.jpeg,.png" disabled={!!uploading} onChange={e=>e.target.files?.[0]&&void upload(docType,e.target.files[0])}/></label>}{latest&&latest.status!=="Valid"&&<button className="danger-link" onClick={()=>void remove(latest)}>Hapus</button>}</div></article>;
    })}</div>
    {error&&<div className="form-error">{error}</div>}<div className="modal-actions"><button className="primary-button" onClick={onClose}>Selesai</button></div>
  </div></div>;
}

function PpdbVerifyModal({ admission, onClose, onUpdated, notify }: { admission:Row; onClose:()=>void; onUpdated:()=>Promise<void>; notify:(message:string)=>void }) {
  const [status,setStatus]=useState(String(admission.status||"Verifikasi Dokumen"));
  const [score,setScore]=useState(String(admission.score||0));
  const [note,setNote]=useState(String(admission.verification_note||""));
  const [saving,setSaving]=useState(false);
  async function save() {
    setSaving(true);
    const response=await fetch("/api/admissions",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({id:admission.id,status,score:Number(score),verification_note:note})});
    const result=await response.json() as {error?:string;message?:string};
    if(!response.ok){notify(result.error||"Verifikasi gagal.");setSaving(false);return;}
    await onUpdated(); notify(result.message||"Status pendaftaran diperbarui."); onClose();
  }
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="record-modal ppdb-verify-modal" onMouseDown={e=>e.stopPropagation()}>
    <button type="button" className="modal-close" onClick={onClose}>×</button><span className="modal-eyebrow">VERIFIKASI ADMIN</span><h2>{admission.name}</h2><p>{admission.registration_no} · Perubahan status akan tercatat dan disiapkan sebagai notifikasi WhatsApp.</p>
    <div className="form-grid"><label>Status<select value={status} onChange={e=>setStatus(e.target.value)}>{ppdbStatuses.map(x=><option key={x}>{x}</option>)}</select></label><label>Nilai tes<input type="number" min="0" max="100" value={score} onChange={e=>setScore(e.target.value)}/></label><label className="wide">Catatan verifikator<textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Catatan yang dapat dilihat calon wali santri"/></label></div>
    <div className="modal-actions"><button className="secondary-button" onClick={onClose}>Batal</button><button className="primary-button" disabled={saving} onClick={()=>void save()}>{saving?"Menyimpan…":"Simpan Verifikasi"}</button></div>
  </div></div>;
}

function AdmissionsPage({ data, role, reload, notify, remove }: { data:AppData; role:Role; reload:()=>Promise<void>; notify:(message:string)=>void; remove:(r:Resource,row:Row)=>void }) {
  const [showForm,setShowForm]=useState(false);
  const [documentsFor,setDocumentsFor]=useState<Row|null>(null);
  const [verifyFor,setVerifyFor]=useState<Row|null>(null);
  const rows=data.admissions;
  const verified=rows.filter(x=>["Terverifikasi","Tes","Lulus"].includes(String(x.status))).length;
  const needsFix=rows.filter(x=>x.status==="Perlu Perbaikan").length;
  if(role==="Wali Santri") return <><section className="summary-banner admission-banner"><div><span>PPDB ONLINE 2026/2027</span><strong>{rows.length?`${rows.length} Pendaftaran`:"Daftar Sekarang"}</strong><p>Isi formulir, unggah dokumen, dan pantau hasil verifikasi secara online.</p></div><button className="light-button" onClick={()=>setShowForm(true)}>+ Formulir Baru</button></section>
    <section className="ppdb-steps">{["Isi Formulir","Unggah Dokumen","Verifikasi Admin","Tes & Kelulusan"].map((x,i)=><article className="card" key={x}><span>{i+1}</span><strong>{x}</strong><small>{i===0?"Data calon santri":i===1?"PDF/JPG/PNG maks. 5 MB":i===2?"Pantau catatan perbaikan":"Hasil diumumkan di portal"}</small></article>)}</section>
    <section className="ppdb-applications">{rows.map(row=>{const docs=data.admissionDocuments.filter(x=>Number(x.admission_id)===Number(row.id));const valid=docs.filter(x=>x.status==="Valid").length;return <article className="card ppdb-application-card" key={String(row.id)}><header><div><span>{row.registration_no}</span><h3>{row.name}</h3><p>{row.desired_level} · {row.previous_school}</p></div><Status tone={ppdbTone(row.status)}>{row.status}</Status></header><div className="ppdb-progress"><span><i style={{width:`${Math.min(100,Math.max(15,ppdbStatuses.indexOf(String(row.status))*18+15))}%`}}/></span><small>{valid} dokumen valid · {docs.length} berkas diunggah</small></div>{row.verification_note&&<div className="verification-note"><strong>Catatan verifikator</strong><p>{row.verification_note}</p></div>}<footer><button className="primary-button" onClick={()=>setDocumentsFor(row)}>Kelola Dokumen</button><small>Dibuat {new Date(String(row.created_at)).toLocaleDateString("id-ID")}</small></footer></article>})}{!rows.length&&<article className="card ppdb-empty"><span>＋</span><h3>Belum ada pendaftaran</h3><p>Mulai pendaftaran calon santri SMP atau SMK Nurul Iman.</p><button className="primary-button" onClick={()=>setShowForm(true)}>Isi Formulir PPDB</button></article>}</section>
    {showForm&&<PpdbApplicationModal onClose={()=>setShowForm(false)} onSaved={reload} notify={notify}/>}
    {documentsFor&&<PpdbDocumentsModal admission={documentsFor} documents={data.admissionDocuments} role={role} onClose={()=>setDocumentsFor(null)} onUpdated={reload} notify={notify}/>}</>;

  return <><section className="summary-banner admission-banner"><div><span>PPDB 2026/2027</span><strong>{rows.length} Pendaftar</strong><p>Formulir, berkas, verifikasi, tes, dan kelulusan dalam satu tempat.</p></div><button className="light-button" onClick={()=>setShowForm(true)}>+ Pendaftar Baru</button></section><section className="stats-grid three ppdb-stats"><Metric title="Terverifikasi" value={verified} icon="✓" tone="green"/><Metric title="Perlu Perbaikan" value={needsFix} icon="!" tone="red"/><Metric title="Menunggu Proses" value={Math.max(0,rows.length-verified-needsFix)} icon="⌛" tone="blue"/></section><section className="card data-card"><header className="card-header"><div><h3>Daftar Calon Santri</h3><p>Penerimaan santri baru dan status pemeriksaan dokumen</p></div><button className="primary-button" onClick={()=>setShowForm(true)}>Tambah Pendaftar</button></header><div className="table-wrap"><table><thead><tr><th>No. Pendaftaran</th><th>Calon Santri</th><th>Jenjang</th><th>Dokumen</th><th>Nilai</th><th>Tahap</th><th /></tr></thead><tbody>{rows.map(x=>{const docs=data.admissionDocuments.filter(d=>Number(d.admission_id)===Number(x.id));return <tr key={String(x.id)}><td className="muted">{x.registration_no}</td><td><strong>{x.name}</strong><small className="cell-note">{x.guardian_name} · {x.guardian_phone}</small></td><td>{x.desired_level||"—"}<small className="cell-note">{x.previous_school}</small></td><td><button className="text-button" onClick={()=>setDocumentsFor(x)}>{docs.length} berkas · Periksa</button></td><td>{x.score||0}</td><td><Status tone={ppdbTone(x.status)}>{x.status}</Status></td><td><div className="row-actions"><button onClick={()=>setVerifyFor(x)} aria-label="Verifikasi">✓</button><button onClick={()=>setDocumentsFor(x)} aria-label="Dokumen">▤</button><button onClick={()=>remove("admissions",x)} aria-label="Hapus">×</button></div></td></tr>})}{!rows.length&&<tr><td colSpan={7} className="muted">Belum ada pendaftar.</td></tr>}</tbody></table></div></section>
  {showForm&&<PpdbApplicationModal onClose={()=>setShowForm(false)} onSaved={reload} notify={notify}/>}
  {documentsFor&&<PpdbDocumentsModal admission={documentsFor} documents={data.admissionDocuments} role={role} onClose={()=>setDocumentsFor(null)} onUpdated={reload} notify={notify}/>}
  {verifyFor&&<PpdbVerifyModal admission={verifyFor} onClose={()=>setVerifyFor(null)} onUpdated={reload} notify={notify}/>}</>;
}

function CounselingPage({ rows, edit, remove }: { rows:Row[]; edit:(r:Resource,row?:Row)=>void; remove:(r:Resource,row:Row)=>void }) {
  return <section className="card data-card"><header className="card-header"><div><h3>Catatan Konseling & Pembinaan</h3><p>Data bersifat terbatas untuk pengurus berwenang</p></div><button className="primary-button" onClick={()=>edit("counseling")}>+ Catatan Baru</button></header><div className="table-wrap"><table><thead><tr><th>Santri</th><th>Jenis</th><th>Kategori</th><th>Catatan</th><th>Poin</th><th>Status</th><th /></tr></thead><tbody>{rows.map(x=><tr key={String(x.id)}><td><strong>{x.student_name}</strong></td><td><Status tone={x.type==="Prestasi"?"green":x.type==="Pelanggaran"?"red":"blue"}>{x.type}</Status></td><td>{x.category}</td><td>{x.description}</td><td>{x.points}</td><td>{x.status}</td><td><DataActions row={x} onEdit={r=>edit("counseling",r)} onDelete={r=>remove("counseling",r)} /></td></tr>)}</tbody></table></div></section>;
}

function UsersPage({ data, edit, remove, reply }: { data:AppData; edit:(r:Resource,row?:Row)=>void; remove:(r:Resource,row:Row)=>void; reply:(row:Row)=>void }) {
  return <><section className="dashboard-grid operations-grid"><article className="card data-card"><header className="card-header"><div><h3>Manajemen Pengguna</h3><p>Hak akses server-side</p></div><button className="primary-button" onClick={()=>edit("users")}>+ Pengguna</button></header><div className="table-wrap"><table><thead><tr><th>Pengguna</th><th>Peran</th><th /></tr></thead><tbody>{data.users.map(x=><tr key={String(x.id)}><td><strong>{x.name}</strong><small className="cell-note">{x.email}</small></td><td><Status tone={x.role==="Admin"?"violet":x.role==="Ustadz"?"blue":"green"}>{x.role}</Status></td><td><DataActions row={x} onEdit={r=>edit("users",r)} onDelete={r=>remove("users",r)} /></td></tr>)}</tbody></table></div></article><article className="card data-card"><header className="card-header"><div><h3>Audit Aktivitas</h3><p>Jejak perubahan terbaru</p></div></header><div className="audit-list">{data.audit.map(x=><div key={String(x.id)}><MiniIcon tone={x.action==="Hapus"?"red":x.action==="Tambah"?"green":"blue"}>{String(x.action).slice(0,1)}</MiniIcon><div><strong>{x.action} · {x.resource}</strong><p>{x.detail}</p><small>{x.user_email} · {new Date(String(x.created_at)).toLocaleString("id-ID")}</small></div></div>)}</div></article></section>
  <section className="card data-card guardian-inbox"><header className="card-header"><div><h3>Pesan dari Wali Santri</h3><p>Pertanyaan dari Portal Wali yang menunggu tindak lanjut</p></div><Status tone={data.guardianMessages.some(x=>x.status==="Baru")?"amber":"green"}>{data.guardianMessages.filter(x=>x.status==="Baru").length} baru</Status></header><div className="table-wrap"><table><thead><tr><th>Santri</th><th>Subjek & Pesan</th><th>Pengirim</th><th>Status</th><th /></tr></thead><tbody>{data.guardianMessages.map(x=><tr key={String(x.id)}><td><strong>{x.student_name}</strong></td><td><strong>{x.subject}</strong><small className="cell-note">{x.message}{x.reply?` · Balasan: ${x.reply}`:""}</small></td><td className="muted">{x.sender_email}</td><td><Status tone={x.status==="Dibalas"?"green":"amber"}>{x.status}</Status></td><td><button className="text-button" onClick={()=>reply(x)}>{x.status==="Dibalas"?"Balas lagi":"Balas"}</button></td></tr>)}{!data.guardianMessages.length&&<tr><td colSpan={5} className="muted">Belum ada pesan dari wali santri.</td></tr>}</tbody></table></div></section></>;
}

function PaymentQrModal({ bill, onClose, onUpdated, notify }: { bill:Row; onClose:()=>void; onUpdated:()=>Promise<void>; notify:(message:string)=>void }) {
  const [qr,setQr]=useState("");
  const [paymentUrl,setPaymentUrl]=useState(String(bill.payment_url||""));
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  useEffect(()=>{void (async()=>{
    try {
      let response=await fetch(`/api/payment-qr?id=${bill.id}`);
      let result=await response.json() as {error?:string;qr?:string;paymentUrl?:string;needsLink?:boolean;qrDataUrl?:string};
      if(response.status===409&&result.needsLink) {
        response=await fetch("/api/integrations",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"payment-link",billId:Number(bill.id)})});
        result=await response.json() as typeof result;
      }
      if(!response.ok) throw new Error(result.error||"QR pembayaran gagal dibuat.");
      setQr(result.qr||result.qrDataUrl||""); setPaymentUrl(result.paymentUrl||String(bill.payment_url||"")); await onUpdated();
    } catch(e) { setError(e instanceof Error?e.message:"QR pembayaran gagal dibuat."); }
    finally { setLoading(false); }
  })();},[bill.id,bill.payment_url,onUpdated]);
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="record-modal payment-qr-modal" onMouseDown={e=>e.stopPropagation()}>
    <button type="button" className="modal-close" onClick={onClose}>×</button><span className="modal-eyebrow">PEMBAYARAN AMAN</span><h2>Bayar {bill.category}</h2><p>{bill.invoice_no} · Rp{money.format(Number(bill.amount))}. Pindai QR atau buka kanal pembayaran untuk memilih QRIS.</p>
    {loading?<div className="qr-placeholder">Menyiapkan QR pembayaran…</div>:error?<div className="form-error">{error}</div>:<div className="payment-qr-content"><img src={qr} alt={`QR pembayaran ${bill.invoice_no}`} /><div><Status tone="amber">Menunggu pembayaran</Status><strong>Rp{money.format(Number(bill.amount))}</strong><small>Rekonsiliasi dilakukan otomatis setelah gateway mengirim konfirmasi.</small></div></div>}
    <div className="modal-actions"><button className="secondary-button" onClick={()=>{void onUpdated();notify("Status pembayaran diperbarui.");}}>Perbarui Status</button>{paymentUrl&&<a className="primary-button link-button" href={paymentUrl} target="_blank" rel="noreferrer">Buka Pembayaran →</a>}</div>
  </div></div>;
}

function GuardianRequestModal({ student, onClose, onDone }: { student:Row; onClose:()=>void; onDone:(message:string)=>Promise<void> }) {
  const today=new Date().toISOString().slice(0,10);
  const [form,setForm]=useState({type:"Kunjungan",visitDate:today,startTime:"09:00",endTime:"11:00",purpose:"",visitorName:"",visitorPhone:""});
  const [saving,setSaving]=useState(false); const [error,setError]=useState("");
  async function submit(event:React.FormEvent) {
    event.preventDefault();setSaving(true);setError("");
    const response=await fetch("/api/guardian-requests",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({...form,studentId:Number(student.id)})});
    const result=await response.json() as {error?:string};
    if(!response.ok){setError(result.error||"Permintaan gagal dikirim.");setSaving(false);return;}
    await onDone("Permintaan berhasil dikirim dan menunggu persetujuan.");onClose();
  }
  return <div className="modal-backdrop" onMouseDown={onClose}><form className="record-modal" onSubmit={submit} onMouseDown={e=>e.stopPropagation()}>
    <button type="button" className="modal-close" onClick={onClose}>×</button><span className="modal-eyebrow">AKSES PESANTREN</span><h2>Ajukan Kunjungan / Penjemputan</h2><p>QR sekali pakai akan tersedia setelah pengurus menyetujui permintaan.</p>
    <div className="form-grid"><label>Jenis<select value={form.type} onChange={e=>setForm({...form,type:e.target.value})}><option>Kunjungan</option><option>Penjemputan</option></select></label><label>Tanggal<input required type="date" min={today} value={form.visitDate} onChange={e=>setForm({...form,visitDate:e.target.value})}/></label><label>Jam mulai<input required type="time" value={form.startTime} onChange={e=>setForm({...form,startTime:e.target.value})}/></label><label>Jam selesai<input required type="time" value={form.endTime} onChange={e=>setForm({...form,endTime:e.target.value})}/></label><label>Nama pengunjung/penjemput<input required value={form.visitorName} onChange={e=>setForm({...form,visitorName:e.target.value})}/></label><label>Nomor WhatsApp<input required type="tel" value={form.visitorPhone} onChange={e=>setForm({...form,visitorPhone:e.target.value})}/></label><label className="wide">Keperluan<textarea required value={form.purpose} onChange={e=>setForm({...form,purpose:e.target.value})}/></label></div>
    {error&&<div className="form-error">{error}</div>}<div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Batal</button><button disabled={saving} className="primary-button">{saving?"Mengirim…":"Kirim Permintaan"}</button></div>
  </form></div>;
}

function GuardianRequestQrModal({ request, onClose }: { request:Row; onClose:()=>void }) {
  const [result,setResult]=useState<{qr?:string;token?:string;error?:string}>({});
  useEffect(()=>{void (async()=>{const response=await fetch(`/api/guardian-requests/qr?id=${request.id}`);const data=await response.json() as typeof result;setResult(response.ok?data:{error:data.error||"QR gagal dimuat."});})();},[request.id]);
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="record-modal request-qr-modal" onMouseDown={e=>e.stopPropagation()}><button type="button" className="modal-close" onClick={onClose}>×</button><span className="modal-eyebrow">QR SEKALI PAKAI</span><h2>{request.type} · {request.student_name}</h2><p>{request.visit_date} · {request.start_time}–{request.end_time}. Tunjukkan QR ini kepada petugas gerbang.</p>{result.error?<div className="form-error">{result.error}</div>:result.qr?<div className="request-qr-content"><img src={result.qr} alt={`QR ${request.type}`} /><code>{result.token}</code><small>QR tidak dapat digunakan kembali setelah divalidasi petugas.</small></div>:<div className="qr-placeholder">Menyiapkan QR akses…</div>}</div></div>;
}

function GuardianActionModal({ type, student, onClose, onDone }: { type:"contact"|"permit"; student:Row; onClose:()=>void; onDone:(message:string)=>Promise<void> }) {
  const today=new Date().toISOString().slice(0,10);
  const [form,setForm]=useState({subject:"Informasi santri",message:"",startDate:today,endDate:today,reason:""});
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");
  async function submit(event:React.FormEvent) {
    event.preventDefault(); setSaving(true); setError("");
    const payload=type==="contact"
      ? {action:"contact",studentId:Number(student.id),subject:form.subject,message:form.message}
      : {action:"permit",studentId:Number(student.id),startDate:form.startDate,endDate:form.endDate,reason:form.reason};
    try {
      const response=await fetch("/api/portal",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload)});
      const result=await response.json() as {error?:string};
      if(!response.ok) throw new Error(result.error||"Permintaan gagal dikirim.");
      await onDone(type==="contact"?"Pesan berhasil dikirim ke pengurus.":"Pengajuan izin berhasil dikirim.");
      onClose();
    } catch(e) { setError(e instanceof Error?e.message:"Permintaan gagal dikirim."); setSaving(false); }
  }
  return <div className="modal-backdrop" onMouseDown={onClose}><form className="record-modal portal-action-modal" onSubmit={submit} onMouseDown={e=>e.stopPropagation()}>
    <button type="button" className="modal-close" onClick={onClose}>×</button>
    <span className="modal-eyebrow">PORTAL WALI SANTRI</span>
    <h2>{type==="contact"?"Hubungi Pesantren":"Ajukan Izin Santri"}</h2>
    <p>{student.name} · {student.class_name}. Permintaan akan tersimpan dan dapat ditindaklanjuti pengurus.</p>
    {type==="contact"?<div className="form-grid">
      <label>Subjek<input required value={form.subject} onChange={e=>setForm({...form,subject:e.target.value})} /></label>
      <label className="wide">Pesan<textarea required value={form.message} placeholder="Tuliskan pertanyaan atau informasi untuk pengurus…" onChange={e=>setForm({...form,message:e.target.value})} /></label>
    </div>:<div className="form-grid">
      <label>Tanggal mulai<input required type="date" value={form.startDate} onChange={e=>setForm({...form,startDate:e.target.value})} /></label>
      <label>Tanggal selesai<input required type="date" min={form.startDate} value={form.endDate} onChange={e=>setForm({...form,endDate:e.target.value})} /></label>
      <label className="wide">Alasan izin<textarea required value={form.reason} placeholder="Jelaskan alasan dan kebutuhan izin…" onChange={e=>setForm({...form,reason:e.target.value})} /></label>
    </div>}
    {error&&<div className="form-error">{error}</div>}
    <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Batal</button><button disabled={saving} className="primary-button">{saving?"Mengirim…":"Kirim Permintaan"}</button></div>
  </form></div>;
}

function WalletTopupModal({ student, onClose, onDone }: { student:Row; onClose:()=>void; onDone:(message:string)=>Promise<void> }) {
  const [amount,setAmount]=useState("50000");
  const [method,setMethod]=useState("QRIS");
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");
  const [payment,setPayment]=useState<{topupNo:string;amount:number;provider:string;status:string;paymentUrl?:string;qrDataUrl?:string;bank?:{name:string;number:string;holder:string}|null}|null>(null);
  async function submit(event:React.FormEvent) {
    event.preventDefault();setSaving(true);setError("");
    try {
      const response=await fetch("/api/sinurpay/topup",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({studentId:Number(student.id),amount:Number(amount),method})});
      const result=await response.json() as NonNullable<typeof payment>&{error?:string};
      if(!response.ok) throw new Error(result.error||"Top-up gagal dibuat.");
      setPayment(result);await onDone("Permintaan top-up berhasil dibuat.");
    } catch(caught) { setError(caught instanceof Error?caught.message:"Top-up gagal dibuat."); }
    finally { setSaving(false); }
  }
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="record-modal topup-modal" role="dialog" aria-modal="true" onMouseDown={event=>event.stopPropagation()}><button type="button" className="modal-close" onClick={onClose}>×</button><span className="modal-eyebrow">TOP-UP SINURPAY</span><h2>Tambah saldo {student.name}</h2><p>Saldo hanya bertambah setelah pembayaran diterima dan diverifikasi.</p>
    {!payment?<form onSubmit={submit}><div className="form-grid"><label>Nominal top-up<input required min="10000" max="5000000" step="1000" type="number" value={amount} onChange={event=>setAmount(event.target.value)}/></label><label>Metode pembayaran<select value={method} onChange={event=>setMethod(event.target.value)}><option>QRIS</option><option>Transfer Bank</option></select></label></div>{error&&<div className="form-error">{error}</div>}<div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Batal</button><button disabled={saving} className="primary-button">{saving?"Menyiapkan…":"Buat Top-up"}</button></div></form>
    :<div className="topup-payment"><Status tone="amber">{payment.status}</Status><h3>Rp{money.format(payment.amount)}</h3><code>{payment.topupNo}</code>{payment.qrDataUrl&&<img src={payment.qrDataUrl} alt={`QRIS ${payment.topupNo}`}/>} {payment.bank&&<dl><div><dt>Bank</dt><dd>{payment.bank.name}</dd></div><div><dt>Nomor rekening</dt><dd>{payment.bank.number}</dd></div><div><dt>Atas nama</dt><dd>{payment.bank.holder}</dd></div></dl>}<p>{payment.paymentUrl?"Scan QR atau buka halaman pembayaran. Saldo masuk otomatis setelah webhook terverifikasi.":"Transfer sesuai nominal, lalu tunggu verifikasi Admin."}</p><div className="modal-actions">{payment.paymentUrl&&<a className="primary-button link-button" href={payment.paymentUrl} target="_blank" rel="noreferrer">Buka Pembayaran</a>}<button className="secondary-button" onClick={onClose}>Tutup</button></div></div>}
  </div></div>;
}

function GuardianPortal({ data, onCard, onPayment, reload, notify }: { data:AppData; onCard:(row:Row)=>void; onPayment:(row:Row)=>void; reload:()=>Promise<void>; notify:(message:string)=>void }) {
  const [selectedId,setSelectedId]=useState(String(data.students[0]?.id??""));
  const [day,setDay]=useState(()=>{const current=new Intl.DateTimeFormat("id-ID",{weekday:"long"}).format(new Date());return current==="Minggu"?"Senin":current;});
  const [action,setAction]=useState<"contact"|"permit"|null>(null);
  const [requestOpen,setRequestOpen]=useState(false);
  const [topupOpen,setTopupOpen]=useState(false);
  const [qrRequest,setQrRequest]=useState<Row|null>(null);
  const student=data.students.find(x=>String(x.id)===selectedId)??data.students[0];
  if(!student) return <div className="empty-state guardian-empty"><b>Belum ada santri yang terhubung</b><span>Minta Admin mengisi “Email akun wali” pada data santri menggunakan email akun Anda: {data.user?.email}</span></div>;

  const byStudent=(rows:Row[])=>rows.filter(x=>Number(x.student_id)===Number(student.id));
  const bills=byStudent(data.bills), attendance=byStudent(data.attendance), tahfidz=byStudent(data.tahfidz), grades=byStudent(data.grades);
  const health=byStudent(data.health), characters=byStudent(data.characters), permits=byStudent(data.permits);
  const transactions=byStudent(data.transactions), mutabaah=byStudent(data.mutabaah), messages=byStudent(data.guardianMessages), requests=byStudent(data.guardianRequests);
  const wallet=data.walletAccounts.find(x=>Number(x.student_id)===Number(student.id));
  const walletEntries=byStudent(data.walletEntries), canteenSales=byStudent(data.canteenSales);
  const balance=Number(wallet?.balance??transactions.filter(x=>x.category==="Uang Saku").reduce((total,x)=>total+(x.type==="Keluar"?-1:1)*Number(x.amount||0),0));
  const attendanceRate=attendance.length?Math.round(attendance.filter(x=>x.status==="Hadir").length/attendance.length*100):0;
  const schedule=data.schedules.filter(x=>x.class_name===student.class_name&&x.day_name===day);
  const days=["Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
  const announcements=data.announcements.filter(x=>x.audience==="Semua"||x.audience==="Wali Santri").slice(0,4);
  async function done(message:string) { notify(message); await reload(); }

  return <div className="guardian-portal">
    {data.students.length>1&&<section className="student-switcher card"><span>Pilih santri</span>{data.students.map(x=><button key={String(x.id)} className={String(x.id)===String(student.id)?"active":""} onClick={()=>setSelectedId(String(x.id))}>{x.name}<small>{x.class_name}</small></button>)}</section>}
    <section className="guardian-hero"><div className="large-avatar">{String(student.name).split(" ").map(x=>x[0]).slice(0,2).join("")}</div><div><span>PORTAL WALI SANTRI · DATA TERLINDUNGI</span><h2>{student.name}</h2><p>{student.nis} · {student.class_name} · {student.room}</p></div><div className="header-actions"><button className="primary-button" onClick={()=>setTopupOpen(true)}>+ Top Up Saldo</button><button className="secondary-button" onClick={()=>onCard(student)}>Kartu QR</button><button className="secondary-button" onClick={()=>setAction("permit")}>Ajukan Izin</button><button className="secondary-button" onClick={()=>setRequestOpen(true)}>Kunjungan / Jemput</button><button className="secondary-button" onClick={()=>setAction("contact")}>Hubungi Pesantren</button></div></section>
    <section className="stats-grid four guardian-stats">
      <article className="metric-card"><MiniIcon tone="green">✓</MiniIcon><div><span>Kehadiran</span><strong>{attendanceRate}%</strong><small>{attendance.filter(x=>x.status==="Hadir").length} dari {attendance.length} catatan</small></div></article>
      <article className="metric-card"><MiniIcon tone="blue">◫</MiniIcon><div><span>Setoran Tahfidz</span><strong>{tahfidz.length}</strong><small>{tahfidz[0]?`Terakhir ${tahfidzRange(tahfidz[0])}`:"Belum ada setoran"}</small></div></article>
      <article className="metric-card"><MiniIcon tone="violet">Rp</MiniIcon><div><span>Saldo SINURPAY</span><strong>Rp{money.format(balance)}</strong><small>Limit harian Rp{money.format(Number(wallet?.daily_limit||0))}</small></div></article>
      <article className="metric-card"><MiniIcon tone="amber">!</MiniIcon><div><span>Tagihan Aktif</span><strong>{bills.filter(x=>x.status!=="Lunas").length}</strong><small>Perlu ditindaklanjuti</small></div></article>
    </section>

    <section className="guardian-grid">
      <article className="card portal-card span-two"><header className="card-header"><div><h3>Jadwal Pelajaran Harian</h3><p>{student.class_name} · pilih hari untuk melihat pelajaran</p></div><select value={day} onChange={e=>setDay(e.target.value)}>{days.map(x=><option key={x}>{x}</option>)}</select></header><div className="portal-schedule">{schedule.length?schedule.map((x,i)=><div key={String(x.id)}><span className={`schedule-time tone-${i%4}`}>{x.start_time}<small>{x.end_time}</small></span><div><Status tone={x.category==="Produktif"?"violet":x.category==="Tahfidz"?"green":"blue"}>{x.category}</Status><strong>{x.title}</strong><small>{x.teacher} · {x.location}</small></div></div>):<div className="portal-empty">Belum ada jadwal pada {day}.</div>}</div></article>
      <article className="card portal-card"><header className="card-header"><div><h3>Tagihan & Pembayaran QRIS</h3><p>Rekonsiliasi otomatis dan kuitansi digital</p></div></header><div className="portal-list">{bills.length?bills.map(x=><div key={String(x.id)}><div><strong>{x.category}</strong><small>{x.invoice_no} · jatuh tempo {x.due_date}{x.paid_at?` · lunas ${x.paid_at}`:""}</small></div><b>Rp{money.format(Number(x.amount))}</b><Status tone={x.status==="Lunas"?"green":"amber"}>{x.status}</Status>{x.status!=="Lunas"?<button className="text-button" onClick={()=>onPayment(x)}>Tampilkan QR</button>:<a className="text-button link-button" href={`/api/receipt?id=${x.id}`}>Kuitansi</a>}</div>):<div className="portal-empty">Tidak ada tagihan.</div>}</div></article>
      <article className="card portal-card span-two guardian-wallet-card"><header className="card-header"><div><h3>Buku Tabungan & Belanja Kantin</h3><p>Saldo cashless, limit harian, dan mutasi SINURPAY</p></div><div className="guardian-wallet-balance"><small>Saldo tersedia</small><strong>Rp{money.format(balance)}</strong><Status tone={wallet?.status==="Diblokir"?"red":"green"}>{wallet?.status||"Aktif"}</Status></div></header><div className="guardian-wallet-grid"><div><span>MUTASI TERBARU</span>{walletEntries.slice(0,6).map(entry=><article key={String(entry.id)}><div><strong>{entry.entry_type}</strong><small>{entry.reference} · {String(entry.created_at).slice(0,10)}<br/>{entry.note}</small></div><b className={Number(entry.amount)>=0?"amount-in":"amount-out"}>{Number(entry.amount)>=0?"+":"−"}Rp{money.format(Math.abs(Number(entry.amount)))}</b></article>)}{!walletEntries.length&&<div className="portal-empty">Belum ada mutasi tabungan.</div>}</div><div><span>BELANJA KANTIN</span>{canteenSales.slice(0,6).map(sale=><article key={String(sale.id)}><div><strong>{sale.receipt_no}</strong><small>{String(sale.created_at).slice(0,16).replace("T"," ")} · {sale.cashier_email}</small></div><b>Rp{money.format(Number(sale.total))}</b><Status tone={sale.status==="Berhasil"?"green":"red"}>{sale.status}</Status></article>)}{!canteenSales.length&&<div className="portal-empty">Belum ada transaksi kantin.</div>}</div></div></article>
      <article className="card portal-card"><header className="card-header"><div><h3>Tahfidz & Mutaba’ah</h3><p>Perkembangan hafalan dan ibadah</p></div></header><div className="portal-list">{tahfidz.slice(0,4).map(x=><div key={`t-${x.id}`}><div><strong>{tahfidzRange(x)}</strong><small>{x.amount} ayat · {x.teacher} · {x.recorded_at}</small></div><Status tone="green">{x.grade}</Status></div>)}{mutabaah.slice(0,3).map(x=><div key={`m-${x.id}`}><div><strong>{x.activity}</strong><small>{x.record_date}</small></div><Status tone={Number(x.completed)?"green":"amber"}>{Number(x.completed)?"Selesai":"Belum"}</Status></div>)}{!tahfidz.length&&!mutabaah.length&&<div className="portal-empty">Belum ada catatan perkembangan.</div>}</div></article>
      <article className="card portal-card"><header className="card-header"><div><h3>Rapor Akademik</h3><p>Nilai SMP–SMK terbaru</p></div></header><div className="portal-list">{grades.length?grades.slice(0,8).map(x=><div key={String(x.id)}><div><strong>{x.subject_name}</strong><small>{x.semester} · {x.academic_year} · {x.note||"Tanpa catatan"}</small></div><Status tone={Number(x.final_score)>=Number(x.minimum_score||75)?"green":"amber"}>{x.final_score} · {x.predicate}</Status></div>):<div className="portal-empty">Belum ada nilai akademik.</div>}</div></article>
      <article className="card portal-card"><header className="card-header"><div><h3>Rapor Karakter</h3><p>Penilaian pembina terbaru</p></div></header><div className="portal-list">{characters.length?characters.slice(0,5).map(x=><div key={String(x.id)}><div><strong>{x.category}</strong><small>{x.note} · {x.semester}</small></div><b>{x.score}/100</b></div>):<div className="portal-empty">Belum ada rapor karakter.</div>}</div></article>
      <article className="card portal-card"><header className="card-header"><div><h3>Kesehatan Santri</h3><p>Catatan pemeriksaan dan tindak lanjut</p></div></header><div className="portal-list">{health.length?health.slice(0,5).map(x=><div key={String(x.id)}><div><strong>{x.complaint}</strong><small>{x.diagnosis} · {x.treatment}</small></div><Status tone={x.status==="Selesai"||x.status==="Membaik"?"green":"amber"}>{x.status}</Status></div>):<div className="portal-empty">Tidak ada catatan kesehatan.</div>}</div></article>
      <article className="card portal-card"><header className="card-header"><div><h3>Absensi & Perizinan</h3><p>Status kehadiran dan permohonan izin</p></div><button className="text-button" onClick={()=>setAction("permit")}>+ Ajukan izin</button></header><div className="portal-list">{permits.slice(0,4).map(x=><div key={`p-${x.id}`}><div><strong>{x.reason}</strong><small>{x.start_date} – {x.end_date}</small></div><Status tone={x.status==="Disetujui"?"green":x.status==="Ditolak"?"red":"amber"}>{x.status}</Status></div>)}{attendance.slice(0,4).map(x=><div key={`a-${x.id}`}><div><strong>Absensi {x.record_date}</strong><small>{x.note||"Tanpa catatan"}</small></div><Status tone={x.status==="Hadir"?"green":x.status==="Alpa"?"red":"amber"}>{x.status}</Status></div>)}{!permits.length&&!attendance.length&&<div className="portal-empty">Belum ada data absensi.</div>}</div></article>
      <article className="card portal-card"><header className="card-header"><div><h3>Pengumuman</h3><p>Informasi resmi untuk wali santri</p></div></header><div className="portal-list">{announcements.length?announcements.map(x=><div key={String(x.id)}><div><strong>{x.title}</strong><small>{x.content}</small></div><Status tone="blue">{x.category}</Status></div>):<div className="portal-empty">Belum ada pengumuman.</div>}</div></article>
      <article className="card portal-card"><header className="card-header"><div><h3>Pesan ke Pesantren</h3><p>Riwayat pertanyaan dan balasan pengurus</p></div><button className="text-button" onClick={()=>setAction("contact")}>+ Pesan</button></header><div className="portal-list">{messages.length?messages.slice(0,5).map(x=><div key={String(x.id)}><div><strong>{x.subject}</strong><small>{x.message}{x.reply?` · Balasan: ${x.reply}`:""}</small></div><Status tone={x.status==="Dibalas"?"green":"amber"}>{x.status}</Status></div>):<div className="portal-empty">Belum ada pesan.</div>}</div></article>
      <article className="card portal-card span-two"><header className="card-header"><div><h3>Kunjungan & Penjemputan QR</h3><p>QR akses sekali pakai setelah disetujui pengurus</p></div><button className="text-button" onClick={()=>setRequestOpen(true)}>+ Ajukan</button></header><div className="portal-list request-list">{requests.length?requests.slice(0,6).map(x=><div key={String(x.id)}><div><strong>{x.type} · {x.visit_date}</strong><small>{x.start_time}–{x.end_time} · {x.visitor_name} · {x.purpose}</small></div><Status tone={x.status==="Disetujui"?"green":x.status==="Ditolak"?"red":x.status==="Digunakan"?"blue":"amber"}>{x.status}</Status>{x.status==="Disetujui"&&<button className="text-button" onClick={()=>setQrRequest(x)}>Lihat QR</button>}</div>):<div className="portal-empty">Belum ada permintaan kunjungan atau penjemputan.</div>}</div></article>
    </section>
    {action&&<GuardianActionModal type={action} student={student} onClose={()=>setAction(null)} onDone={done} />}
    {requestOpen&&<GuardianRequestModal student={student} onClose={()=>setRequestOpen(false)} onDone={done}/>}
    {qrRequest&&<GuardianRequestQrModal request={qrRequest} onClose={()=>setQrRequest(null)}/>}
    {topupOpen&&<WalletTopupModal student={student} onClose={()=>setTopupOpen(false)} onDone={done}/>}
  </div>;
}

function IntegrationsPage({ data, onImported, notify }: { data:AppData; onImported:()=>Promise<void>; notify:(s:string)=>void }) {
  const [status,setStatus]=useState<{midtrans?:boolean;xendit?:boolean;whatsapp?:boolean}>({});
  const [uploading,setUploading]=useState(false);
  const [reminding,setReminding]=useState(false);
  useEffect(()=>{void (async()=>{try{const response=await fetch("/api/integrations");setStatus(await response.json() as {midtrans?:boolean;xendit?:boolean;whatsapp?:boolean});}catch{setStatus({});}})();},[]);
  async function upload(file:File) { setUploading(true); const form=new FormData(); form.append("file",file); const response=await fetch("/api/import",{method:"POST",body:form}); const result=await response.json() as {error?:string;imported?:number}; setUploading(false); if(!response.ok){notify(result.error||"Impor gagal.");return;} notify(`${result.imported} santri berhasil diimpor.`); await onImported(); }
  async function runReminders(){setReminding(true);const response=await fetch("/api/reminders",{method:"POST"});const result=await response.json() as {error?:string;sent?:number;processed?:number};setReminding(false);if(!response.ok){notify(result.error||"Pengingat gagal dijalankan.");return;}notify(`${result.sent} pengingat dikirim dari ${result.processed} tagihan terjadwal.`);await onImported();}
  return <><section className="integration-grid">{[["Midtrans / QRIS","Pembayaran, webhook, rekonsiliasi, dan kuitansi",status.midtrans],["Xendit / QRIS","Alternatif kanal pembayaran dan webhook",status.xendit],["WhatsApp Cloud API","Notifikasi otomatis saat data berubah",status.whatsapp]].map((x,i)=><article className="card integration-card" key={String(x[0])}><MiniIcon tone={["blue","violet","green"][i]}>{i===2?"WA":"↗"}</MiniIcon><div><h3>{x[0]}</h3><p>{x[1]}</p></div><Status tone={x[2]?"green":"amber"}>{x[2]?"Terhubung":"Perlu kredensial"}</Status></article>)}</section><section className="card automation-rules"><header className="card-header"><div><h3>Notifikasi WhatsApp Otomatis</h3><p>Wali menerima pembaruan tanpa input pesan manual ketika data berikut berubah.</p></div><Status tone={status.whatsapp?"green":"amber"}>{status.whatsapp?"Aktif":"Mode tautan WhatsApp"}</Status></header><div>{[["Absensi","Sakit, izin, terlambat, atau alpa"],["Tahfidz","Rentang surat, ayat, jumlah, dan nilai setoran"],["Akademik","Nilai akhir dan predikat rapor"],["Karakter","Kategori dan nilai karakter"],["Kesehatan","Keluhan serta status tindak lanjut"],["Pembinaan","Pelanggaran atau prestasi"],["Keuangan","Tagihan baru dan pengingat jatuh tempo"]].map(item=><article key={item[0]}><span>WA</span><div><strong>{item[0]}</strong><small>{item[1]}</small></div><b>Otomatis</b></article>)}</div></section><section className="dashboard-grid operations-grid"><article className="card utility-card reminder-utility"><div><MiniIcon tone="green">WA</MiniIcon><h3>Pengingat Tagihan Otomatis</h3><p>Mengirim pengingat tagihan yang jatuh tempo dalam tujuh hari. Sistem mencegah pengiriman ganda pada hari yang sama.</p><button className="primary-button" disabled={reminding} onClick={()=>void runReminders()}>{reminding?"Mengirim…":"Jalankan Pengingat"}</button></div></article><article className="card utility-card"><div><MiniIcon tone="blue">⇧</MiniIcon><h3>Impor Excel/CSV</h3><p>Kolom: nama, nis, kelas, kamar, nama_wali, whatsapp, email_wali. Maksimal 500 baris.</p><label className="upload-button">{uploading?"Mengimpor...":"Pilih Berkas"}<input type="file" accept=".xlsx,.xls,.csv" disabled={uploading} onChange={e=>e.target.files?.[0]&&void upload(e.target.files[0])} /></label></div></article></section><section className="dashboard-grid operations-grid"><article className="card data-card"><header className="card-header"><div><h3>Riwayat Notifikasi</h3><p>Status pengiriman WhatsApp terbaru</p></div></header><div className="portal-list">{data.notifications.slice(0,8).map(x=><div key={String(x.id)}><div><strong>{x.recipient}</strong><small>{x.message}</small></div><Status tone={x.status==="Terkirim"?"green":x.status==="Gagal"?"red":"amber"}>{x.status}</Status></div>)}</div></article><article className="card utility-card"><div><MiniIcon tone="green">⇩</MiniIcon><h3>Backup Lengkap</h3><p>Unduh seluruh data operasional termasuk pembayaran dan QR akses untuk arsip.</p><a className="primary-button link-button" href="/api/backup">Unduh Backup</a></div></article></section></>;
}

function StudentCardModal({ student, onClose }: { student:Row; onClose:()=>void }) {
  const [qr,setQr]=useState(""); useEffect(()=>{void (async()=>{const response=await fetch(`/api/student-card?id=${student.id}`);const result=await response.json() as {qr?:string};setQr(result.qr||"");})();},[student.id]);
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="student-card-modal" onMouseDown={e=>e.stopPropagation()}><button className="modal-close no-print" onClick={onClose}>×</button><div className="student-id-card"><header><span className="brand-mark">ن</span><div><strong>SINURMAN</strong><small>Pondok Pesantren Nurul Iman</small></div></header><div className="student-card-body"><div><span className="student-photo">{String(student.name).split(" ").map(x=>x[0]).slice(0,2).join("")}</span><h3>{student.name}</h3><p>{student.nis}</p><dl><dt>Kelas</dt><dd>{student.class_name}</dd><dt>Kamar</dt><dd>{student.room}</dd><dt>Status</dt><dd>{student.status}</dd></dl></div>{qr?<img src={qr} alt={`QR ${student.name}`} />:<span className="qr-loading">Memuat QR…</span>}</div><footer>Kartu Santri Digital · Tahun Ajaran 2026/2027</footer></div><button className="primary-button print-card no-print" onClick={()=>window.print()}>Cetak Kartu</button></div></div>;
}

function ReportsPage({ role }: { role:Role }) {
  const today=new Date().toISOString().slice(0,10);
  const [from,setFrom]=useState(`${today.slice(0,4)}-01-01`);
  const [to,setTo]=useState(today);
  const allReports=[
    {key:"students",title:"Laporan Data Santri",copy:"Profil, kelas, kamar, wali, dan status",tone:"blue",admin:false},
    {key:"tahfidz",title:"Rekap Setoran Tahfidz",copy:"Hafalan dan penilaian per santri",tone:"green",admin:false},
    {key:"mutabaah",title:"Rekap Mutaba’ah",copy:"Kegiatan ibadah harian santri",tone:"violet",admin:false},
    {key:"attendance",title:"Laporan Absensi",copy:"Kehadiran, izin, sakit, dan alpa",tone:"amber",admin:false},
    {key:"academics",title:"Rapor Akademik SMP–SMK",copy:"Nilai tugas, PTS, PAS, akhir, dan predikat",tone:"green",admin:false},
    {key:"characters",title:"Rapor Karakter",copy:"Nilai karakter dan catatan pembina",tone:"blue",admin:false},
    {key:"health",title:"Rekap Kesehatan",copy:"Keluhan, diagnosis, dan tindak lanjut",tone:"green",admin:false},
    {key:"counseling",title:"Laporan Pembinaan",copy:"Konseling, prestasi, dan pelanggaran",tone:"violet",admin:false},
    {key:"schedules",title:"Jadwal Pelajaran",copy:"Jadwal harian SMP dan SMK",tone:"amber",admin:false},
    {key:"finance",title:"Laporan Keuangan",copy:"SPP, uang saku, dan transaksi",tone:"blue",admin:true},
    {key:"sinurpay",title:"Laporan SINURPAY",copy:"Tabungan, belanja kartu, omzet, dan kasir kantin",tone:"green",admin:true},
    {key:"inventory",title:"Laporan Inventaris",copy:"Aset, jumlah, lokasi, dan kondisi",tone:"green",admin:true},
    {key:"admissions",title:"Laporan PPDB",copy:"Pendaftar dan status verifikasi",tone:"violet",admin:true},
  ];
  const reports=allReports.filter(report=>role==="Admin"||!report.admin);
  const query=(key:string,format:string)=>`/api/export?type=${key}&format=${format}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
  return <><section className="report-hero"><div><span>PUSAT DATA SINURMAN</span><h2>Laporan pesantren, siap cetak langsung.</h2><p>Pilih periode, cetak dalam format A4 dengan kop dan tanda tangan, atau unduh PDF serta Excel/CSV.</p></div><a className="light-button link-button" target="_blank" rel="noreferrer" href={`/cetak?type=students&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&auto=1`}>Cetak Laporan Utama →</a></section>
    <section className="card report-toolbar"><div><strong>Periode laporan</strong><small>Filter berlaku pada laporan yang memiliki tanggal transaksi atau kegiatan.</small></div><label>Dari<input type="date" value={from} max={to} onChange={event=>setFrom(event.target.value)}/></label><label>Sampai<input type="date" value={to} min={from} max={today} onChange={event=>setTo(event.target.value)}/></label></section>
    <section className="report-grid">{reports.map((report)=><article className="card report-card" key={report.key}><MiniIcon tone={report.tone}>▥</MiniIcon><div><h3>{report.title}</h3><p>{report.copy}</p><span>A4 siap cetak · PDF · Excel/CSV</span></div><div className="export-actions"><a className="print-action" target="_blank" rel="noreferrer" href={`/cetak?type=${report.key}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&auto=1`}>Cetak</a><a href={query(report.key,"pdf")}>PDF</a><a href={query(report.key,"csv")}>CSV</a></div></article>)}</section></>;
}

const formFields: Record<Resource, { key: string; label: string; type?: string; options?: string[] }[]> = {
  students: [
    { key:"name",label:"Nama lengkap" },{ key:"nis",label:"NIS" },{ key:"class_name",label:"Kelas" },
    { key:"room",label:"Kamar" },{ key:"guardian_name",label:"Nama wali" },{ key:"guardian_phone",label:"Nomor WhatsApp wali",type:"tel" },
    { key:"guardian_email",label:"Email akun wali",type:"email" },
    { key:"status",label:"Status",options:["Aktif","Izin","Nonaktif"] },
  ],
  tahfidz: [
    { key:"student_id",label:"Santri",type:"student" },
    { key:"surah_from",label:"Surat awal",options:QURAN_SURAHS.map(item=>item.name) },{ key:"verse_from",label:"Ayat awal",type:"number" },
    { key:"surah_to",label:"Surat akhir",options:QURAN_SURAHS.map(item=>item.name) },{ key:"verse_to",label:"Ayat akhir",type:"number" },
    { key:"amount",label:"Jumlah ayat disetor",type:"number" },{ key:"grade",label:"Penilaian",options:["Mumtaz","Jayyid Jiddan","Jayyid","Mengulang"] },
  ],
  subjects: [
    {key:"code",label:"Kode mata pelajaran"},{key:"name",label:"Nama mata pelajaran"},{key:"education_level",label:"Jenjang",options:["SMP","SMK"]},{key:"class_name",label:"Kelas",options:["VII A","VIII A","IX A","X RPL","XI RPL","XII RPL","X TKJ","XI TKJ","XII TKJ"]},{key:"teacher",label:"Guru/Ustadz"},{key:"semester",label:"Semester",options:["Ganjil","Genap"]},{key:"academic_year",label:"Tahun ajaran"},{key:"minimum_score",label:"KKM",type:"number"},
  ],
  grades: [
    {key:"student_id",label:"Santri",type:"student"},{key:"subject_id",label:"Mata pelajaran",type:"subject"},{key:"assignment_score",label:"Nilai tugas",type:"number"},{key:"midterm_score",label:"Nilai PTS",type:"number"},{key:"exam_score",label:"Nilai PAS",type:"number"},{key:"semester",label:"Semester",options:["Ganjil","Genap"]},{key:"academic_year",label:"Tahun ajaran"},{key:"note",label:"Catatan rapor",type:"textarea"},
  ],
  mutabaah: [
    {key:"student_id",label:"Santri",type:"student"},{key:"activity",label:"Kegiatan/ibadah"},{key:"completed",label:"Status",options:["1","0"]},{key:"record_date",label:"Tanggal",type:"date"},
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
    {key:"student_id",label:"Santri",type:"student"},{key:"record_date",label:"Tanggal",type:"date"},{key:"status",label:"Status",options:["Hadir","Terlambat","Sakit","Izin","Alpa"]},{key:"note",label:"Catatan"},
  ],
  permits: [
    {key:"student_id",label:"Santri",type:"student"},{key:"start_date",label:"Tanggal mulai",type:"date"},{key:"end_date",label:"Tanggal selesai",type:"date"},{key:"reason",label:"Alasan",type:"textarea"},{key:"status",label:"Status",options:["Diajukan","Disetujui","Ditolak","Selesai"]},
  ],
  schedules: [
    {key:"education_level",label:"Jenjang",options:["SMP","SMK"]},{key:"class_name",label:"Kelas",options:["VII A","VIII A","IX A","X RPL","XI RPL","XII RPL","X TKJ","XI TKJ","XII TKJ"]},{key:"title",label:"Mata pelajaran/kegiatan"},{key:"category",label:"Kategori",options:["Pelajaran Umum","Produktif","Tahfidz","Ibadah","Kegiatan"]},{key:"teacher",label:"Ustadz/Guru"},{key:"location",label:"Ruang"},{key:"day_name",label:"Hari",options:["Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"]},{key:"start_time",label:"Mulai",type:"time"},{key:"end_time",label:"Selesai",type:"time"},
  ],
  rooms: [
    {key:"name",label:"Nama kamar"},{key:"capacity",label:"Kapasitas",type:"number"},{key:"supervisor",label:"Musyrif/Pembina"},{key:"status",label:"Status",options:["Aktif","Perawatan","Penuh"]},
  ],
  admissions: [
    {key:"registration_no",label:"Nomor pendaftaran"},{key:"name",label:"Nama calon santri"},{key:"guardian_name",label:"Nama wali"},{key:"guardian_phone",label:"WhatsApp wali",type:"tel"},{key:"previous_school",label:"Asal sekolah"},{key:"status",label:"Tahap",options:ppdbStatuses},{key:"score",label:"Nilai tes",type:"number"},
  ],
  counseling: [
    {key:"student_id",label:"Santri",type:"student"},{key:"type",label:"Jenis",options:["Konseling","Pembinaan","Pelanggaran","Prestasi"]},{key:"category",label:"Kategori"},{key:"description",label:"Catatan kejadian",type:"textarea"},{key:"points",label:"Poin",type:"number"},{key:"status",label:"Status",options:["Baru","Ditindaklanjuti","Selesai"]},
  ],
  bills: [
    {key:"student_id",label:"Santri",type:"student"},{key:"invoice_no",label:"Nomor tagihan"},{key:"category",label:"Kategori",options:["SPP","Daftar Ulang","Kegiatan","Seragam","Lainnya"]},{key:"amount",label:"Nominal",type:"number"},{key:"due_date",label:"Jatuh tempo",type:"date"},{key:"status",label:"Status",options:["Belum Dibayar","Tertunda","Lunas"]},
  ],
  users: [
    {key:"name",label:"Nama pengguna"},{key:"email",label:"Email",type:"email"},{key:"role",label:"Peran",options:["Admin","Kepala Asrama","Musyrif","Ustadz","Wali Santri"]},{key:"room_scope",label:"Kamar/asrama penugasan"},
  ],
};

const resourceNames: Record<Resource,string> = {
  students:"santri",tahfidz:"setoran tahfidz",mutabaah:"kegiatan mutaba’ah",health:"pemeriksaan",transactions:"transaksi",
  characters:"nilai karakter",inventory:"barang",announcements:"pengumuman",
  attendance:"absensi",permits:"izin",schedules:"jadwal",rooms:"kamar",admissions:"pendaftar",
  counseling:"catatan konseling",bills:"tagihan",users:"pengguna",
  subjects:"mata pelajaran",grades:"nilai akademik",
};

function RecordModal({ editor, students, subjects, onClose, onSave }: { editor: NonNullable<EditorState>; students: Row[]; subjects:Row[]; onClose: () => void; onSave: (resource: Resource, row: Row | undefined, data: Record<string, unknown>) => Promise<void> }) {
  const [form, setForm] = useState<Record<string, string>>(() => {
    const values: Record<string,string> = {};
    for (const field of formFields[editor.resource]) values[field.key] = String(editor.row?.[field.key] ?? "");
    return values;
  });
  const [saving,setSaving] = useState(false);
  const [error,setError] = useState("");
  function updateFormField(key:string,value:string) {
    setForm(current=>{
      const next={...current,[key]:value};
      if(editor.resource==="tahfidz"&&["surah_from","surah_to","verse_from","verse_to"].includes(key)) {
        const verseFrom=Number(next.verse_from);
        const verseTo=Number(next.verse_to);
        if(next.surah_from&&next.surah_to&&verseFrom>0&&verseTo>0) try{next.amount=String(next.surah_from===next.surah_to?verseTo-verseFrom+1:quranRangeAmount(next.surah_from,verseFrom,next.surah_to,verseTo));}catch{/* server displays the validation message on save */}
      }
      return next;
    });
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const data: Record<string,unknown> = {};
      for (const [key,value] of Object.entries(form)) data[key] = ["amount","quantity","score","student_id","subject_id","points","capacity","completed","verse_from","verse_to","minimum_score","assignment_score","midterm_score","exam_score"].includes(key) ? Number(value) : value;
      await onSave(editor.resource,editor.row,data);
    } catch (e) { setError(e instanceof Error?e.message:"Gagal menyimpan."); setSaving(false); }
  }
  return <div className="modal-backdrop" onMouseDown={onClose}><form className="record-modal" onSubmit={submit} onMouseDown={e=>e.stopPropagation()}>
    <button type="button" className="modal-close" onClick={onClose}>×</button>
    <span className="modal-eyebrow">DATA SINURMAN</span>
    <h2>{editor.row?"Ubah":"Tambah"} {resourceNames[editor.resource]}</h2>
    <p>Data akan tersimpan permanen dan langsung memperbarui dashboard.</p>
    <div className="form-grid">{formFields[editor.resource].map(field=><label key={field.key} className={field.type==="textarea"?"wide":""}>{field.label}
      {field.type==="student"?<select required value={form[field.key]} onChange={e=>updateFormField(field.key,e.target.value)}><option value="">Pilih santri</option>{students.map(s=><option key={String(s.id)} value={String(s.id)}>{s.name} · {s.nis}</option>)}</select>
      :field.type==="subject"?<select required value={form[field.key]} onChange={e=>updateFormField(field.key,e.target.value)}><option value="">Pilih mata pelajaran</option>{subjects.map(s=><option key={String(s.id)} value={String(s.id)}>{s.name} · {s.class_name}</option>)}</select>
      :field.options?<select required value={form[field.key]} onChange={e=>updateFormField(field.key,e.target.value)}><option value="">Pilih</option>{field.options.map(o=><option key={o}>{o}</option>)}</select>
      :field.type==="textarea"?<textarea required value={form[field.key]} onChange={e=>updateFormField(field.key,e.target.value)} />
      :<input required={!["status","note","room_scope"].includes(field.key)} readOnly={editor.resource==="tahfidz"&&field.key==="amount"} min={["verse_from","verse_to","amount"].includes(field.key)?1:undefined} max={["minimum_score","assignment_score","midterm_score","exam_score"].includes(field.key)?100:undefined} type={field.type||"text"} value={form[field.key]} onChange={e=>updateFormField(field.key,e.target.value)} />}
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

function HelpModal({ role, onClose, onNavigate, onRefresh }: { role:Role; onClose:()=>void; onNavigate:(page:PageKey)=>void; onRefresh:()=>Promise<void> }) {
  const closeButtonRef=useRef<HTMLButtonElement>(null);
  const guides:{title:string;copy:string;page:PageKey;label:string}[]=role==="Wali Santri"
    ? [
      {title:"Pembayaran",copy:"Buka tagihan anak, lalu tekan Tampilkan QR untuk melanjutkan pembayaran.",page:"portalwali",label:"Buka Portal Wali"},
      {title:"Izin & Kunjungan",copy:"Ajukan izin, kunjungan, atau penjemputan dari profil santri.",page:"portalwali",label:"Buka layanan wali"},
      {title:"Data anak",copy:"Pastikan email akun wali sama dengan email yang tersimpan pada Data Santri.",page:"portalwali",label:"Periksa data anak"},
    ]
    : role==="Admin"
      ? [
        {title:"Data santri",copy:"Kelola identitas, kelas, kamar, serta hubungan akun wali.",page:"santri",label:"Buka Data Santri"},
        {title:"Integrasi",copy:"Periksa WhatsApp, pembayaran, impor data, dan backup sistem.",page:"integrasi",label:"Buka Integrasi"},
        {title:"QR gerbang",copy:"Validasi token kunjungan dan penjemputan melalui Absensi & Perizinan.",page:"absensi",label:"Buka Absensi"},
      ]
      : [
        {title:"Santri binaan",copy:"Lihat santri yang sesuai dengan kamar atau penugasan Anda.",page:"santri",label:"Buka Data Santri"},
        {title:"Nilai & kegiatan",copy:"Perbarui tahfidz, mutaba’ah, karakter, dan kegiatan santri.",page:"tahfidz",label:"Buka Tahfidz"},
        {title:"Izin & kehadiran",copy:"Catat absensi serta tindak lanjuti perizinan santri binaan.",page:"absensi",label:"Buka Absensi"},
      ];
  useEffect(()=>{
    closeButtonRef.current?.focus();
    const closeOnEscape=(event:KeyboardEvent)=>{if(event.key==="Escape") onClose();};
    window.addEventListener("keydown",closeOnEscape);
    return()=>window.removeEventListener("keydown",closeOnEscape);
  },[onClose]);
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="record-modal help-modal" role="dialog" aria-modal="true" aria-labelledby="help-modal-title" onMouseDown={e=>e.stopPropagation()}>
    <button ref={closeButtonRef} type="button" className="modal-close" aria-label="Tutup pusat bantuan" onClick={onClose}>×</button>
    <span className="modal-eyebrow">PUSAT BANTUAN SINURMAN</span><h2 id="help-modal-title">Ada yang bisa dibantu?</h2><p>Panduan cepat sesuai peran Anda sebagai {role}.</p>
    <div className="help-guide-list">{guides.map((guide,index)=><article key={guide.title}><span>{index+1}</span><div><strong>{guide.title}</strong><p>{guide.copy}</p><button type="button" onClick={()=>{onNavigate(guide.page);onClose();}}>{guide.label} →</button></div></article>)}</div>
    <div className="help-contact"><span>Butuh bantuan lanjutan?</span><strong>Tim SINURMAN siap membantu pengurus dan wali santri.</strong><a href="mailto:support@sinurman.id?subject=Bantuan%20SINURMAN">Kirim email ke support@sinurman.id</a></div>
    <div className="modal-actions"><button type="button" className="secondary-button" onClick={()=>void onRefresh()}>↻ Sinkronkan Data</button>{role==="Admin"&&<button type="button" className="secondary-button" onClick={()=>{onNavigate("integrasi");onClose();}}>Periksa Integrasi</button>}<button type="button" className="primary-button" onClick={onClose}>Selesai</button></div>
  </div></div>;
}

function AccountModal({ user, role, onClose }: { user:AppData["user"]; role:Role; onClose:()=>void }) {
  const closeButtonRef=useRef<HTMLButtonElement>(null);
  useEffect(()=>{
    closeButtonRef.current?.focus();
    const closeOnEscape=(event:KeyboardEvent)=>{if(event.key==="Escape") onClose();};
    window.addEventListener("keydown",closeOnEscape);
    return()=>window.removeEventListener("keydown",closeOnEscape);
  },[onClose]);
  const initials=(user?.name||"Pengguna").split(" ").map(value=>value[0]).slice(0,2).join("").toUpperCase();
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="record-modal account-modal" role="dialog" aria-modal="true" aria-labelledby="account-modal-title" onMouseDown={event=>event.stopPropagation()}>
    <button ref={closeButtonRef} type="button" className="modal-close" aria-label="Tutup profil akun" onClick={onClose}>×</button>
    <span className="modal-eyebrow">AKUN SINURMAN</span><h2 id="account-modal-title">Profil pengguna</h2><p>Identitas ini berasal dari akun ChatGPT yang sedang masuk.</p>
    <div className="account-summary"><span>{initials}</span><div><strong>{user?.name||"Pengguna SINURMAN"}</strong><small>{user?.email||"Email belum tersedia"}</small></div></div>
    <dl className="account-details"><div><dt>Peran</dt><dd>{role}</dd></div><div><dt>Penugasan kamar</dt><dd>{user?.roomScope||"Tidak dibatasi"}</dd></div><div><dt>Status akun</dt><dd><Status tone="green">Aktif</Status></dd></div></dl>
    <div className="modal-actions"><a className="secondary-button link-button" href="/signout-with-chatgpt?return_to=%2F">Keluar dari akun</a><button type="button" className="primary-button" onClick={onClose}>Selesai</button></div>
  </div></div>;
}

function SettingsModal({ dark, onDarkChange, onHelp, onClose }: { dark:boolean; onDarkChange:(value:boolean)=>void; onHelp:()=>void; onClose:()=>void }) {
  const closeButtonRef=useRef<HTMLButtonElement>(null);
  useEffect(()=>{
    closeButtonRef.current?.focus();
    const closeOnEscape=(event:KeyboardEvent)=>{if(event.key==="Escape") onClose();};
    window.addEventListener("keydown",closeOnEscape);
    return()=>window.removeEventListener("keydown",closeOnEscape);
  },[onClose]);
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="record-modal settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-modal-title" onMouseDown={event=>event.stopPropagation()}>
    <button ref={closeButtonRef} type="button" className="modal-close" aria-label="Tutup pengaturan" onClick={onClose}>×</button>
    <span className="modal-eyebrow">PENGATURAN TAMPILAN</span><h2 id="settings-modal-title">Sesuaikan dashboard</h2><p>Pilihan tampilan disimpan pada perangkat ini.</p>
    <div className="theme-options"><button type="button" className={!dark?"active":""} aria-pressed={!dark} onClick={()=>onDarkChange(false)}><span>☀</span><strong>Terang</strong><small>Nyaman untuk penggunaan siang hari</small></button><button type="button" className={dark?"active":""} aria-pressed={dark} onClick={()=>onDarkChange(true)}><span>☾</span><strong>Gelap</strong><small>Mengurangi silau pada malam hari</small></button></div>
    <div className="settings-help"><div><strong>Kesulitan menggunakan SINURMAN?</strong><small>Buka panduan sesuai dengan peran akun Anda.</small></div><button type="button" onClick={()=>{onClose();onHelp();}}>Buka Bantuan</button></div>
    <div className="modal-actions"><button type="button" className="primary-button" onClick={onClose}>Simpan & Tutup</button></div>
  </div></div>;
}

export default function DashboardClient() {
  const [page, setPage] = useState<PageKey>("dashboard");
  const [role, setRole] = useState<Role>("Admin");
  const [data, setData] = useState<AppData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [editor, setEditor] = useState<EditorState>(null);
  const [cardStudent, setCardStudent] = useState<Row | null>(null);
  const [showNotification, setShowNotification] = useState(false);
  const [paymentBill,setPaymentBill]=useState<Row|null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showHelp,setShowHelp]=useState(false);
  const [showAccount,setShowAccount]=useState(false);
  const [showSettings,setShowSettings]=useState(false);
  const [dark, setDark] = useState(false);
  const [topbarPanel,setTopbarPanel]=useState<"notifications"|"profile"|null>(null);
  const [notificationsRead,setNotificationsRead]=useState(false);
  const [toast, setToast] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchActiveIndex, setSearchActiveIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const title = pageTitles[page];
  const topNotices=useMemo(()=>[
    ...data.guardianMessages.filter(row=>row.status==="Baru").map(row=>({id:`message-${row.id}`,title:`Pesan baru dari ${row.sender_email||"wali santri"}`,copy:String(row.subject||row.message||"Pesan wali menunggu balasan."),meta:"Pesan Wali"})),
    ...data.notifications.map(row=>({id:`notification-${row.id}`,title:String(row.recipient||"Notifikasi sistem"),copy:String(row.message||"Pembaruan notifikasi SINURMAN."),meta:String(row.status||"Notifikasi")})),
    ...data.announcements.map(row=>({id:`announcement-${row.id}`,title:String(row.title||"Pengumuman"),copy:String(row.content||"Informasi terbaru pesantren."),meta:String(row.category||"Pengumuman")})),
  ].slice(0,5),[data]);
  const visibleNavGroups = useMemo(() => {
    const allowed = role === "Wali Santri"
      ? new Set<PageKey>(["portalwali"])
      : role === "Musyrif"
        ? new Set<PageKey>(["dashboard","santri","tahfidz","akademik","mutabaah","karakter","absensi","kesehatan","pengumuman","konseling"])
        : role === "Kepala Asrama"
          ? new Set<PageKey>(["dashboard","santri","tahfidz","akademik","mutabaah","karakter","absensi","jadwal","kesehatan","pengumuman","laporan","konseling"])
      : role === "Ustadz"
        ? new Set<PageKey>(["dashboard","santri","tahfidz","akademik","mutabaah","karakter","absensi","jadwal","kesehatan","pengumuman","laporan","konseling"])
        : null;
    return navGroups.map(group => ({...group,items:allowed?group.items.filter(item=>allowed.has(item.key)):group.items})).filter(group=>group.items.length);
  },[role]);

  const loadData = useCallback(async () => {
    setLoading(true); setLoadError("");
    try {
      const response = await fetch("/api/bootstrap", { cache:"no-store" });
      const result = await response.json() as AppData & { error?:string };
      if (!response.ok) throw new Error(result.error || "Data tidak dapat dimuat.");
      setData(result);
      if(result.user?.role) {
        setRole(result.user.role);
        if(result.user.role==="Wali Santri") setPage("portalwali");
      }
    } catch (error) {
      setLoadError(error instanceof Error?error.message:"Data tidak dapat dimuat.");
      setRole("Admin");
      setPage("dashboard");
      setData(current=>({...current,user:current.user??{name:"Administrator",email:"",role:"Admin"}}));
    } finally { setLoading(false); }
  },[]);

  useEffect(()=>{ const timer=window.setTimeout(()=>void loadData(),0); return ()=>window.clearTimeout(timer); },[loadData]);

  useEffect(()=>{
    const savedTheme=window.localStorage.getItem("sinurman-theme");
    const timer=window.setTimeout(()=>setDark(savedTheme?savedTheme==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches),0);
    return()=>window.clearTimeout(timer);
  },[]);

  useEffect(() => {
    function openSearch(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
        window.setTimeout(() => searchInputRef.current?.focus(), 0);
      }
      if (event.key === "Escape") {
        setSearchOpen(false);
        setTopbarPanel(null);
        searchInputRef.current?.blur();
      }
    }
    window.addEventListener("keydown", openSearch);
    return () => window.removeEventListener("keydown", openSearch);
  }, []);

  const searchIndex = useMemo<SearchResult[]>(() => {
    const result = (id: string, title: unknown, subtitle: unknown, page: PageKey, icon: string, keywords: unknown = ""): SearchResult => ({
      id,
      title: String(title || pageTitles[page].title),
      subtitle: String(subtitle || pageTitles[page].subtitle),
      page,
      icon,
      keywords: String(keywords || ""),
    });
    const menu = visibleNavGroups.flatMap(group => group.items.map(item =>
      result(`menu:${item.key}`, item.label, pageTitles[item.key].subtitle, item.key, item.icon, `${group.label} menu halaman modul`)
    ));
    const items = [
      ...menu,
      ...data.students.map(row => result(`student:${row.id}`, row.name, `${row.nis || "Tanpa NIS"} · ${row.class_name || "Tanpa kelas"} · ${row.room || "Tanpa kamar"}`, "santri", "♙", `${row.guardian_name} ${row.status}`)),
      ...data.schedules.map(row => result(`schedule:${row.id}`, row.title, `${row.class_name || ""} · ${row.day_name || ""} ${row.start_time || ""}–${row.end_time || ""} · ${row.teacher || ""}`, "jadwal", "▦", `${row.education_level} ${row.location} pelajaran mapel jadwal`)),
      ...data.tahfidz.map(row => result(`tahfidz:${row.id}`, row.student_name, tahfidzRange(row), "tahfidz", "◫", `${row.surah_from} ${row.surah_to} ${row.verse_from} ${row.verse_to} ${row.grade} ${row.status} hafalan setoran`)),
      ...data.grades.map(row => result(`grade:${row.id}`, row.student_name, `${row.subject_name} · ${row.final_score} (${row.predicate})`, "akademik", "A", `${row.semester} ${row.academic_year} rapor nilai akademik`)),
      ...data.health.map(row => result(`health:${row.id}`, row.student_name, `${row.complaint || row.diagnosis || "Catatan kesehatan"} · ${row.date || ""}`, "kesehatan", "✚", `${row.treatment} ${row.status}`)),
      ...data.transactions.map(row => result(`transaction:${row.id}`, row.student_name || row.description, `${row.type || "Transaksi"} · Rp${money.format(Number(row.amount || 0))}`, "keuangan", "Rp", `${row.category} ${row.date} uang saku transaksi`)),
      ...data.walletEntries.map(row => result(`wallet:${row.id}`, row.student_name, `${row.entry_type} · Rp${money.format(Math.abs(Number(row.amount || 0)))} · saldo Rp${money.format(Number(row.balance_after || 0))}`, "sinurpay", "fi-rr-cash-register", `${row.reference} ${row.note} tabungan kantin cashless`)),
      ...data.canteenSales.map(row => result(`canteen:${row.id}`, row.student_name, `${row.receipt_no} · Rp${money.format(Number(row.total || 0))} · ${row.status}`, "sinurpay", "fi-rr-receipt", "kantin belanja kasir barcode")),
      ...data.bills.map(row => result(`bill:${row.id}`, row.student_name || row.invoice_no, `${row.category || "Tagihan"} · Rp${money.format(Number(row.amount || 0))} · ${row.status || ""}`, "keuangan", "Rp", `${row.invoice_no} ${row.due_date} spp pembayaran tagihan`)),
      ...data.inventory.map(row => result(`inventory:${row.id}`, row.name, `${row.location || "Lokasi belum diisi"} · ${row.condition || row.status || ""}`, "inventaris", "◇", `${row.category} ${row.quantity} stok aset`)),
      ...data.announcements.map(row => result(`announcement:${row.id}`, row.title, `${row.category || "Pengumuman"} · ${row.date || ""}`, "pengumuman", "◉", `${row.content} informasi berita`)),
      ...data.attendance.map(row => result(`attendance:${row.id}`, row.student_name, `${row.record_date || ""} · ${row.status || "Kehadiran"}`, "absensi", "◷", `${row.note} izin absensi`)),
      ...data.admissions.map(row => result(`admission:${row.id}`, row.name, `${row.registration_no || "Pendaftar"} · ${row.status || ""}`, "penerimaan", "+", `${row.previous_school} calon santri`)),
      ...data.counseling.map(row => result(`counseling:${row.id}`, row.student_name, `${row.category || "Konseling"} · ${row.recorded_at || ""}`, "konseling", "♧", `${row.description} pembinaan pelanggaran`)),
    ];
    const allowed=new Set(visibleNavGroups.flatMap(group=>group.items.map(item=>item.key)));
    return items.filter(item=>allowed.has(item.page));
  }, [data, visibleNavGroups, role]);

  const searchResults = useMemo(() => {
    const query = normalizeSearch(searchQuery).trim();
    if (!query) return searchIndex.filter(item => item.id.startsWith("menu:")).slice(0, 6);
    const tokens = query.split(/\s+/);
    return searchIndex.filter(item => {
      const haystack = normalizeSearch(`${item.title} ${item.subtitle} ${item.keywords} ${pageTitles[item.page].title}`);
      return tokens.every(token => haystack.includes(token));
    }).slice(0, 9);
  }, [searchIndex, searchQuery]);

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

  function openPayment(row:Row) { setPaymentBill(row); }

  async function replyGuardianMessage(row:Row) {
    const reply=window.prompt(`Balasan untuk ${row.student_name}:`,String(row.reply||""));
    if(!reply?.trim()) return;
    const response=await fetch("/api/portal",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"reply",messageId:Number(row.id),reply:reply.trim()})});
    const result=await response.json() as {error?:string};
    if(!response.ok){notify(result.error||"Balasan gagal dikirim.");return;}
    notify("Balasan berhasil dikirim ke Portal Wali."); await loadData();
  }

  const content = useMemo(() => {
    const actions=(resource:Resource)=>({onAdd:()=>setEditor({resource}),onEdit:(row:Row)=>setEditor({resource,row}),onDelete:(row:Row)=>void deleteRecord(resource,row)});
    switch (page) {
      case "dashboard": return <Overview data={data} />;
      case "santri": return <StudentsPage rows={data.students} {...actions("students")} onCard={setCardStudent} />;
      case "tahfidz": return <TahfidzPage rows={data.tahfidz} {...actions("tahfidz")} />;
      case "akademik": return <AcademicPage data={data} role={role} edit={(resource,row)=>setEditor({resource,row})} remove={(resource,row)=>void deleteRecord(resource,row)} />;
      case "mutabaah": return <MutabaahPage rows={data.mutabaah} {...actions("mutabaah")} />;
      case "kesehatan": return <HealthPage rows={data.health} {...actions("health")} />;
      case "keuangan": return <FinancePage rows={data.transactions} bills={data.bills} onAdd={()=>setEditor({resource:"transactions"})} onBill={()=>setEditor({resource:"bills"})} onNotify={()=>setShowNotification(true)} onPayment={row=>void openPayment(row)} />;
      case "sinurpay": return <SinurpayPage notify={notify} />;
      case "karakter": return <CharacterPage onAdd={()=>setEditor({resource:"characters"})} />;
      case "inventaris": return <InventoryPage rows={data.inventory} {...actions("inventory")} />;
      case "pengumuman": return <AnnouncementsPage rows={data.announcements} {...actions("announcements")} onNotify={()=>setShowNotification(true)} />;
      case "laporan": return <ReportsPage role={role} />;
      case "absensi": return <AttendancePage data={data} edit={(resource,row)=>setEditor({resource,row})} remove={(resource,row)=>void deleteRecord(resource,row)} reload={loadData} notify={notify} />;
      case "jadwal": return <SchedulePage data={data} edit={(resource,row)=>setEditor({resource,row})} remove={(resource,row)=>void deleteRecord(resource,row)} />;
      case "penerimaan": return <AdmissionsPage data={data} role={role} reload={loadData} notify={notify} remove={(resource,row)=>void deleteRecord(resource,row)} />;
      case "konseling": return <CounselingPage rows={data.counseling} edit={(resource,row)=>setEditor({resource,row})} remove={(resource,row)=>void deleteRecord(resource,row)} />;
      case "pengguna": return <UsersPage data={data} edit={(resource,row)=>setEditor({resource,row})} remove={(resource,row)=>void deleteRecord(resource,row)} reply={row=>void replyGuardianMessage(row)} />;
      case "integrasi": return <IntegrationsPage data={data} onImported={loadData} notify={notify} />;
      case "portalwali": return <GuardianPortal data={data} onCard={setCardStudent} onPayment={row=>void openPayment(row)} reload={loadData} notify={notify} />;
    }
  }, [page,data]);

  function selectPage(key: PageKey) {
    setPage(key);
    setSidebarOpen(false);
  }

  function selectSearchResult(item: SearchResult) {
    selectPage(item.page);
    setSearchQuery("");
    setSearchOpen(false);
    searchInputRef.current?.blur();
    notify(`${item.title} dibuka di ${pageTitles[item.page].title}.`);
  }

  function handleSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSearchActiveIndex(index => Math.min(index + 1, Math.max(searchResults.length - 1, 0)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setSearchActiveIndex(index => Math.max(index - 1, 0));
    } else if (event.key === "Enter" && searchResults[searchActiveIndex]) {
      event.preventDefault();
      selectSearchResult(searchResults[searchActiveIndex]);
    } else if (event.key === "Escape") {
      setSearchOpen(false);
      searchInputRef.current?.blur();
    }
  }

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  }

  function changeTheme(nextDark:boolean) {
    setDark(nextDark);
    window.localStorage.setItem("sinurman-theme",nextDark?"dark":"light");
    notify(nextDark?"Mode gelap diaktifkan.":"Mode terang diaktifkan.");
  }

  return (
    <div className={`app-shell ${dark ? "dark" : ""}`}>
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="brand"><button className="brand-home" aria-label={role==="Wali Santri"?"Kembali ke Portal Wali":"Kembali ke dashboard"} onClick={()=>selectPage(role==="Wali Santri"?"portalwali":"dashboard")}><span className="brand-mark">ن</span><span><strong>SINURMAN</strong><small>Nurul Iman</small></span></button><button className="close-sidebar" onClick={()=>setSidebarOpen(false)}>×</button></div>
        <nav>{visibleNavGroups.map(group=><div className="nav-group" key={group.label}><span className="nav-label">{group.label}</span>{group.items.map(item=><button key={item.key} className={page===item.key?"active":""} onClick={()=>selectPage(item.key)}><ToolIcon name={item.icon} /><span>{item.label}</span>{item.key==="pengumuman"&&<b>3</b>}</button>)}</div>)}</nav>
        <button type="button" className="sidebar-help" aria-haspopup="dialog" onClick={()=>{setShowHelp(true);setSidebarOpen(false);}}><span>?</span><span><strong>Butuh bantuan?</strong><small>Buka pusat bantuan</small></span></button>
        <div className="sidebar-footer"><span>© 2026 SINURMAN</span><button type="button" onClick={()=>{setShowHelp(true);setSidebarOpen(false);}}>Bantuan · v1.3</button></div>
      </aside>
      {sidebarOpen && <button className="mobile-overlay" aria-label="Tutup menu" onClick={()=>setSidebarOpen(false)} />}
      {topbarPanel&&<button type="button" className="topbar-dismiss" aria-label="Tutup menu kanan atas" onClick={()=>setTopbarPanel(null)} />}

      <div className="main-area">
        <header className="topbar">
          <button className="menu-button" onClick={()=>setSidebarOpen(true)} aria-label="Buka menu">☰</button>
          <div className={`top-search ${searchOpen ? "is-open" : ""}`}>
            <span className="search-symbol">⌕</span>
            <input
              ref={searchInputRef}
              value={searchQuery}
              placeholder="Cari santri, jadwal, tagihan, atau menu..."
              onFocus={() => setSearchOpen(true)}
              onBlur={() => window.setTimeout(() => setSearchOpen(false), 120)}
              onChange={event => { setSearchQuery(event.target.value); setSearchActiveIndex(0); }}
              onKeyDown={handleSearchKeyDown}
              role="combobox"
              aria-label="Pencarian global"
              aria-expanded={searchOpen}
              aria-controls="global-search-results"
              aria-autocomplete="list"
              aria-activedescendant={searchResults[searchActiveIndex] ? `search-option-${searchActiveIndex}` : undefined}
            />
            {searchQuery
              ? <button className="search-clear" type="button" aria-label="Hapus pencarian" onMouseDown={event => event.preventDefault()} onClick={() => { setSearchQuery(""); searchInputRef.current?.focus(); }}>×</button>
              : <kbd>⌘ K</kbd>}
            {searchOpen && <div id="global-search-results" className="search-panel" role="listbox">
              <div className="search-panel-header">
                <span>{searchQuery ? "HASIL PENCARIAN" : "AKSES CEPAT"}</span>
                {searchQuery && <small>{searchResults.length} ditemukan</small>}
              </div>
              <div className="search-results">
                {searchResults.map((item, index) => <button
                  type="button"
                  role="option"
                  aria-selected={index === searchActiveIndex}
                  id={`search-option-${index}`}
                  className={index === searchActiveIndex ? "active" : ""}
                  key={item.id}
                  onMouseEnter={() => setSearchActiveIndex(index)}
                  onMouseDown={event => { event.preventDefault(); selectSearchResult(item); }}
                >
                  <ToolIcon name={item.icon} />
                  <span><strong>{item.title}</strong><small>{item.subtitle}</small></span>
                  <em>{pageTitles[item.page].title}</em>
                </button>)}
                {!searchResults.length && <div className="search-empty"><b>⌕</b><strong>Tidak ada hasil</strong><span>Coba nama santri, kelas, mata pelajaran, tagihan, atau nama menu.</span></div>}
              </div>
              {!!searchResults.length && <div className="search-panel-footer"><span>↑↓ Pilih</span><span>Enter Buka</span><span>Esc Tutup</span></div>}
            </div>}
          </div>
          <div className="top-actions">
            <button type="button" className="theme-toggle" onClick={()=>changeTheme(!dark)} aria-label={dark?"Aktifkan mode terang":"Aktifkan mode gelap"} title={dark?"Mode terang":"Mode gelap"}>{dark?"☀":"☾"}</button>
            <div className="notification-wrap">
              <button type="button" className={`notification ${topbarPanel==="notifications"?"active":""}`} onClick={()=>{setTopbarPanel(current=>current==="notifications"?null:"notifications");setNotificationsRead(true);}} aria-label={`Notifikasi${topNotices.length?` (${topNotices.length})`:""}`} aria-haspopup="menu" aria-expanded={topbarPanel==="notifications"} title="Notifikasi">♢{!notificationsRead&&topNotices.length>0&&<i />}</button>
              {topbarPanel==="notifications"&&<div className="topbar-popover notification-menu" role="menu"><header><div><strong>Notifikasi</strong><small>{topNotices.length?`${topNotices.length} pembaruan terbaru`:"Semua sudah dibaca"}</small></div><button type="button" onClick={()=>setTopbarPanel(null)} aria-label="Tutup notifikasi">×</button></header><div className="notification-list">{topNotices.length?topNotices.map(notice=><article key={notice.id}><span>•</span><div><strong>{notice.title}</strong><p>{notice.copy}</p><small>{notice.meta}</small></div></article>):<div className="notification-empty"><b>✓</b><strong>Belum ada notifikasi</strong><span>Pembaruan pesantren akan muncul di sini.</span></div>}</div><button type="button" className="popover-action" onClick={()=>{selectPage(role==="Admin"?"integrasi":role==="Wali Santri"?"portalwali":"pengumuman");setTopbarPanel(null);}}>Lihat pusat informasi →</button></div>}
            </div>
            <span className="divider" />
            <div className="profile-wrap"><button type="button" className={`profile-button ${topbarPanel==="profile"?"active":""}`} onClick={()=>setTopbarPanel(current=>current==="profile"?null:"profile")} aria-haspopup="menu" aria-expanded={topbarPanel==="profile"}><span>{(data.user?.name||"Pengguna").split(" ").map(x=>x[0]).slice(0,2).join("").toUpperCase()}</span><div><strong>{data.user?.name||"Pengguna SINURMAN"}</strong><small>{role}</small></div><i>{topbarPanel==="profile"?"⌃":"⌄"}</i></button>
              {topbarPanel==="profile"&&<div className="topbar-popover profile-menu" role="menu"><div className="profile-menu-head"><span>{(data.user?.name||"Pengguna").split(" ").map(x=>x[0]).slice(0,2).join("").toUpperCase()}</span><div><strong>{data.user?.name||"Pengguna SINURMAN"}</strong><small>{data.user?.email||role}</small></div></div><div className="profile-role"><span>✓</span><div><strong>{role} aktif</strong><small>{data.user?.roomScope?`Kamar ${data.user.roomScope}`:"Akses sesuai penugasan akun"}</small></div></div><button type="button" onClick={()=>{setTopbarPanel(null);setShowAccount(true);}}>♙ <span>Profil akun</span></button><button type="button" onClick={()=>{setTopbarPanel(null);setShowSettings(true);}}>⚙ <span>Pengaturan tampilan</span></button><button type="button" onClick={()=>{setTopbarPanel(null);setShowHelp(true);}}>? <span>Pusat bantuan</span></button><a href="/signout-with-chatgpt?return_to=%2F">↪ <span>Keluar</span></a></div>}
            </div>
          </div>
        </header>

        <main>
          <div className="page-heading"><div><p>Beranda <span>/</span> {page==="dashboard"?"Ringkasan":title.title}</p><h1>{page==="dashboard"&&data.user?.name?`Assalamu’alaikum, ${data.user.name} 👋`:title.title}</h1><span>{title.subtitle}</span></div><div className="heading-actions"><button className="secondary-button" onClick={()=>void loadData()}>↻ Perbarui</button>{role!=="Wali Santri"&&<button className="primary-button" onClick={()=>selectPage("laporan")}>▥ Buat Laporan</button>}</div></div>
          {loading&&<div className="sync-banner">Menyinkronkan data SINURMAN…</div>}
          {loadError&&<div className="sync-banner error">Data online belum tersedia: {loadError} <button onClick={()=>void loadData()}>Coba lagi</button></div>}
          {content}
          <footer className="page-footer"><span>© 2026 Pondok Pesantren Nurul Iman · <a href="https://www.flaticon.com/uicons" target="_blank" rel="noreferrer">UIcons by Flaticon</a></span><div><button type="button" onClick={()=>notify("Data akun dan operasional hanya digunakan untuk layanan SINURMAN.")}>Kebijakan Privasi</button><button type="button" onClick={()=>setShowHelp(true)}>Bantuan</button></div></footer>
        </main>
      </div>
      <nav className={`mobile-nav ${role==="Wali Santri"?"guardian-mobile-nav":""}`}>
        {(role==="Wali Santri"?[{key:"portalwali" as PageKey,icon:"fi-rr-home-heart",label:"Portal Wali"}]:[navGroups[0].items[0],navGroups[1].items[0],navGroups[1].items[1],navGroups[2].items[1]]).map(item=><button key={item.key} className={page===item.key?"active":""} onClick={()=>selectPage(item.key)}><ToolIcon name={item.icon} /><span>{item.label}</span></button>)}
        <button onClick={()=>setSidebarOpen(true)}><i>•••</i><span>Lainnya</span></button>
      </nav>
      {editor&&<RecordModal key={`${editor.resource}-${editor.row?.id??"new"}`} editor={editor} students={data.students} subjects={data.subjects} onClose={()=>setEditor(null)} onSave={saveRecord} />}
      {cardStudent&&<StudentCardModal student={cardStudent} onClose={()=>setCardStudent(null)} />}
      {showNotification&&<NotificationModal students={data.students} onClose={()=>setShowNotification(false)} onSent={notify} />}
      {paymentBill&&<PaymentQrModal bill={paymentBill} onClose={()=>setPaymentBill(null)} onUpdated={loadData} notify={notify}/>}
      {showHelp&&<HelpModal role={role} onClose={()=>setShowHelp(false)} onNavigate={selectPage} onRefresh={async()=>{await loadData();notify("Data berhasil disinkronkan.");}}/>}
      {showAccount&&<AccountModal user={data.user} role={role} onClose={()=>setShowAccount(false)}/>}
      {showSettings&&<SettingsModal dark={dark} onDarkChange={changeTheme} onHelp={()=>setShowHelp(true)} onClose={()=>setShowSettings(false)}/>}
      {toast&&<div className="toast"><span>✓</span>{toast}</div>}
    </div>
  );
}

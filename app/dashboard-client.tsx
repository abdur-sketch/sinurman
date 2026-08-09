"use client";
/* QR dan kartu memakai data URL dinamis sehingga elemen img biasa diperlukan. */
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EmailAuthProvider, multiFactor, reauthenticateWithCredential, signInWithEmailAndPassword, TotpMultiFactorGenerator, type TotpSecret, updatePassword } from "firebase/auth";
import BrandMark from "./brand-mark";
import { QURAN_SURAHS, quranRangeAmount } from "./quran-data";
import { firebaseClient } from "../lib/firebase/client";

type Role = "Admin" | "Kepala Asrama" | "Musyrif" | "Ustadz" | "Wali Santri";
type Resource = "students" | "employees" | "classes" | "tahfidz" | "tahsin" | "mutabaah" | "health" | "transactions" | "characters" | "inventory" | "announcements" | "attendance" | "permits" | "schedules" | "rooms" | "admissions" | "counseling" | "bills" | "users" | "subjects" | "grades";
type Row = Record<string, string | number | null>;
type AppData = {
  user?: { name: string; email: string; role: Role; roomScope?: string; guardianPhone?: string; authProvider?: "firebase"|"chatgpt"|"guardian" };
  warning?: string;
  students: Row[];
  employees: Row[];
  classes: Row[];
  promotionHistory: Row[];
  tahfidz: Row[];
  tahsin: Row[];
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
  guardianAccounts: Row[];
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
  students: [], employees: [], classes: [], promotionHistory: [], tahfidz: [], tahsin: [], mutabaah: [], health: [], transactions: [], characters: [],
  inventory: [], announcements: [], notifications: [],
  attendance: [], subjects: [], grades: [], permits: [], schedules: [], rooms: [], admissions: [], admissionDocuments: [],
  counseling: [], bills: [], users: [], audit: [], guardianMessages: [], guardianRequests: [],
  walletAccounts: [], walletEntries: [], walletTopups: [], canteenProducts: [], canteenSales: [], canteenSaleItems: [], guardianAccounts: [],
};
type PageKey =
  | "dashboard"
  | "santri"
  | "pegawai"
  | "kelas"
  | "tahfidz"
  | "tahsin"
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
    label: "RINGKASAN",
    items: [
      { key: "dashboard", icon: "fi-rr-apps", label: "Dashboard" },
    ],
  },
  {
    label: "DATA INDUK",
    items: [
      { key: "santri", icon: "fi-rr-users", label: "Profil Santri 360°" },
      { key: "pegawai", icon: "fi-rr-id-badge", label: "Data Pegawai" },
      { key: "kelas", icon: "fi-rr-chalkboard-user", label: "Kelas & Kenaikan" },
      { key: "jadwal", icon: "fi-rr-building", label: "Asrama & Jadwal" },
    ],
  },
  {
    label: "AKADEMIK",
    items: [
      { key: "akademik", icon: "fi-rr-graduation-cap", label: "Akademik & Rapor" },
    ],
  },
  {
    label: "KEPESANTRENAN",
    items: [
      { key: "tahfidz", icon: "fi-rr-book-quran", label: "Tahfidz" },
      { key: "tahsin", icon: "fi-rr-book-open-cover", label: "Tahsin" },
      { key: "mutabaah", icon: "fi-rr-praying-hands", label: "Mutaba’ah" },
      { key: "karakter", icon: "fi-rr-shield-check", label: "Rapor Karakter" },
      { key: "absensi", icon: "fi-rr-clipboard-check", label: "Absensi & Izin" },
      { key: "konseling", icon: "fi-rr-comments", label: "Pembinaan & Poin" },
    ],
  },
  {
    label: "KEUANGAN",
    items: [
      { key: "keuangan", icon: "fi-rr-wallet", label: "Tagihan & Pembayaran" },
      { key: "sinurpay", icon: "fi-rr-cash-register", label: "SINURPAY" },
    ],
  },
  {
    label: "OPERASIONAL",
    items: [
      { key: "kesehatan", icon: "fi-rr-stethoscope", label: "Kesehatan" },
      { key: "inventaris", icon: "fi-rr-boxes", label: "Inventaris" },
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
  pegawai: { title: "Data Pegawai", subtitle: "Kelola identitas, jabatan, unit kerja, dan status pegawai pesantren." },
  kelas: { title: "Kelas & Kenaikan", subtitle: "Kelola master kelas, proses kenaikan otomatis, dan arsip alumni." },
  tahfidz: { title: "Tahfidz & Hafalan", subtitle: "Pantau target, setoran, dan capaian hafalan santri." },
  tahsin: { title: "Tahsin Al-Qur’an", subtitle: "Nilai makhraj, tajwid, kelancaran, panjang pendek, dan adab membaca." },
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

function Overview({ data, onNavigate }: { data: AppData; onNavigate:(page:PageKey)=>void }) {
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
  const announcements=data.announcements.slice(0,3);
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
          <header className="card-header"><div><h3>Pengumuman</h3><p>Informasi penting pesantren</p></div><button className="text-button" onClick={()=>onNavigate("pengumuman")}>Semua</button></header>
          {announcements[0]&&<div className="announcement-feature"><span className="date-box"><b>{new Date(String(announcements[0].published_at)).getDate()}</b>{new Date(String(announcements[0].published_at)).toLocaleDateString("id-ID",{month:"short"}).toUpperCase()}</span><div><Status tone="blue">{announcements[0].category}</Status><h4>{announcements[0].title}</h4><p>{announcements[0].content}</p></div></div>}
          {announcements.slice(1).map(item=><div className="announcement-mini" key={String(item.id)}><span>{new Date(String(item.published_at)).toLocaleDateString("id-ID",{day:"numeric",month:"short"})}</span><p>{item.title}</p></div>)}
          {!announcements.length&&<div className="portal-empty">Belum ada pengumuman.</div>}
        </article>
      </section>
    </>
  );
}

function TahfidzPage({ rows, onAdd, onEdit, onDelete }: { rows: Row[]; onAdd: () => void; onEdit: (row: Row) => void; onDelete: (row: Row) => void }) {
  const today=new Date().toISOString().slice(0,10);
  const todayRows=rows.filter(row=>String(row.recorded_at||"").slice(0,10)===today);
  const totalAyat=rows.reduce((sum,row)=>sum+Number(row.amount||0),0);
  const excellent=rows.filter(row=>["A","A+","Mumtaz","Sangat Baik"].includes(String(row.grade))).length;
  const quality=rows.length?Math.round(excellent/rows.length*100):0;
  return (
    <div className="feature-app tahfidz-app">
      <section className="feature-hero tahfidz-hero"><div className="feature-hero-copy"><span className="feature-kicker">RUANG TUMBUH AL-QURAN</span><h2>Setoran lebih terarah,<br/>capaian lebih bermakna.</h2><p>Pantau rentang surat dan ayat, kualitas bacaan, serta progres hafalan setiap santri dalam satu alur kerja.</p><div className="feature-hero-actions"><button className="feature-primary" onClick={onAdd}>＋ Input Setoran</button><a className="feature-secondary" href="/api/export?type=tahfidz&format=csv">Unduh Rekap</a></div></div><div className="feature-orbit"><div><strong>{totalAyat}</strong><span>ayat tercatat</span></div><i/><i/><i/></div></section>
      <section className="stats-grid three">
        <article className="metric-card feature-metric"><MiniIcon tone="green">✓</MiniIcon><div><span>Setoran Hari Ini</span><strong>{todayRows.length}</strong><small>Catatan masuk hari ini</small></div></article>
        <article className="metric-card feature-metric"><MiniIcon tone="blue">◫</MiniIcon><div><span>Total Hafalan</span><strong>{totalAyat}</strong><small>Ayat pada seluruh setoran</small></div></article>
        <article className="metric-card feature-metric"><MiniIcon tone="amber">☆</MiniIcon><div><span>Kualitas Unggul</span><strong>{quality}%</strong><small>{excellent} setoran berpredikat terbaik</small></div></article>
      </section>
      <section className="card data-card feature-data-card">
        <header className="card-header"><div><h3>Setoran Hafalan Terbaru</h3><p>Daftar setoran tersimpan dan telah diperiksa ustadz</p></div><button className="primary-button" onClick={onAdd}>+ Input Setoran</button></header>
        <div className="table-wrap"><table><thead><tr><th>Santri</th><th>Surat / Ayat</th><th>Jumlah</th><th>Penilaian</th><th>Waktu</th><th /></tr></thead>
          <tbody>{rows.map((r,i)=><tr key={String(r.id)}><td><div className="person"><span>{String(r.student_name).split(" ").map(x=>x[0]).slice(0,2).join("")}</span><strong>{r.student_name}</strong></div></td><td><strong className="tahfidz-range">{tahfidzRange(r)}</strong></td><td>{r.amount} ayat</td><td><Status tone={i===2?"amber":"green"}>{r.grade}</Status></td><td className="muted">{new Date(String(r.recorded_at)).toLocaleDateString("id-ID")}</td><td><div className="row-actions"><button onClick={()=>onEdit(r)}>Ubah</button><button className="danger-link" onClick={()=>onDelete(r)}>Hapus</button></div></td></tr>)}</tbody>
        </table></div>
      </section>
    </div>
  );
}

function TahsinPage({ rows, onAdd, onEdit, onDelete }: { rows:Row[]; onAdd:()=>void; onEdit:(row:Row)=>void; onDelete:(row:Row)=>void }) {
  const levels=["Pra Tahsin","Level 1","Level 2","Level 3","Lulus"];
  const average=(row:Row)=>Math.round(["makhraj_score","tajwid_score","fluency_score","length_score","adab_score"].reduce((sum,key)=>sum+Number(row[key]||0),0)/5);
  const totalAverage=rows.length?Math.round(rows.reduce((sum,row)=>sum+average(row),0)/rows.length):0;
  const passed=rows.filter(row=>row.level==="Lulus").length;
  return <div className="feature-app tahsin-app">
    <section className="feature-hero tahsin-hero"><div className="feature-hero-copy"><span className="feature-kicker">PEMBINAAN BACAAN AL-QUR’AN</span><h2>Tahsin yang terukur, bertahap, dan terhubung ke profil santri.</h2><p>Nilai lima kompetensi utama tanpa membuat data santri terpisah. Semua hasil otomatis masuk ke Santri 360°.</p><div className="feature-hero-actions"><button className="primary-button" onClick={onAdd}>+ Penilaian Tahsin</button><a className="secondary-button link-button" href="/api/export?type=tahsin&format=csv">Ekspor Data</a></div></div><div className="tahsin-level-path">{levels.map((level,index)=><div key={level} className={rows.some(row=>row.level===level)?"active":""}><i>{index+1}</i><span>{level}</span></div>)}</div></section>
    <section className="stats-grid three"><article className="metric-card"><MiniIcon tone="blue">A</MiniIcon><div><span>Rata-rata Nilai</span><strong>{totalAverage||"—"}</strong><small>Lima aspek penilaian</small></div></article><article className="metric-card"><MiniIcon tone="green">✓</MiniIcon><div><span>Santri Lulus</span><strong>{passed}</strong><small>Telah menyelesaikan Tahsin</small></div></article><article className="metric-card"><MiniIcon tone="violet">◫</MiniIcon><div><span>Penilaian Tersimpan</span><strong>{rows.length}</strong><small>Satu sumber data santri</small></div></article></section>
    <section className="card data-card feature-data-card"><header className="card-header responsive"><div><h3>Perkembangan Tahsin</h3><p>Makharijul huruf, tajwid, kelancaran, panjang pendek, dan adab membaca.</p></div><button className="primary-button" onClick={onAdd}>+ Nilai Santri</button></header><div className="table-wrap"><table><thead><tr><th>Santri</th><th>Level</th><th>Makhraj</th><th>Tajwid</th><th>Kelancaran</th><th>Panjang Pendek</th><th>Adab</th><th>Rata-rata</th><th /></tr></thead><tbody>{rows.map(row=><tr key={String(row.id)}><td><strong>{row.student_name}</strong><small className="cell-note">{row.teacher}</small></td><td><Status tone={row.level==="Lulus"?"green":"blue"}>{row.level}</Status></td><td>{row.makhraj_score}</td><td>{row.tajwid_score}</td><td>{row.fluency_score}</td><td>{row.length_score}</td><td>{row.adab_score}</td><td><strong>{average(row)}</strong></td><td><DataActions row={row} onEdit={onEdit} onDelete={onDelete}/></td></tr>)}{!rows.length&&<tr><td colSpan={9} className="muted">Belum ada penilaian Tahsin. Klik Nilai Santri untuk memulai.</td></tr>}</tbody></table></div></section>
  </div>;
}

function StudentsPage({ data, editable, onAdd, onEdit, onDelete, onCard }: { data:AppData; editable:boolean; onAdd: () => void; onEdit: (row: Row) => void; onDelete: (row: Row) => void; onCard:(row:Row)=>void }) {
  const rows=data.students;
  const [query, setQuery] = useState("");
  const [classFilter,setClassFilter]=useState("Semua Kelas");
  const [statusFilter,setStatusFilter]=useState("Semua Status");
  const [page,setPage]=useState(1);
  const [selected,setSelected]=useState<Row|null>(null);
  const [detailTab,setDetailTab]=useState<"ringkasan"|"alquran"|"akademik"|"pembinaan"|"keuangan">("ringkasan");
  const pageSize=10;
  const classNames=Array.from(new Set(rows.map(row=>String(row.class_name||"")).filter(Boolean))).sort();
  const statuses=Array.from(new Set(rows.map(row=>String(row.status||"")).filter(Boolean))).sort();
  const filtered = rows.filter((s) =>
    `${s.name} ${s.nis}`.toLowerCase().includes(query.toLowerCase())
    &&(classFilter==="Semua Kelas"||s.class_name===classFilter)
    &&(statusFilter==="Semua Status"||s.status===statusFilter)
  );
  const pageCount=Math.max(1,Math.ceil(filtered.length/pageSize));
  const activePage=Math.min(page,pageCount);
  const visibleRows=filtered.slice((activePage-1)*pageSize,activePage*pageSize);
  if(selected) {
    const studentId=Number(selected.id);
    const owned=(items:Row[])=>items.filter(row=>Number(row.student_id)===studentId);
    const tahfidz=owned(data.tahfidz);
    const tahsin=owned(data.tahsin);
    const attendance=owned(data.attendance);
    const grades=owned(data.grades);
    const health=owned(data.health);
    const permits=owned(data.permits);
    const counseling=owned(data.counseling);
    const bills=owned(data.bills);
    const mutabaah=owned(data.mutabaah);
    const wallet=data.walletAccounts.find(row=>Number(row.student_id)===studentId);
    const present=attendance.filter(row=>row.status==="Hadir").length;
    const attendanceRate=attendance.length?Math.round(present/attendance.length*100):0;
    const memorized=tahfidz.reduce((total,row)=>total+Number(row.amount||0),0);
    const unpaid=bills.filter(row=>row.status!=="Lunas").reduce((total,row)=>total+Number(row.amount||0),0);
    const points=counseling.reduce((total,row)=>total+(row.type==="Pelanggaran"?-Math.abs(Number(row.points||0)):Math.abs(Number(row.points||0))),0);
    const tahsinScore=(row:Row)=>Math.round(["makhraj_score","tajwid_score","fluency_score","length_score","adab_score"].reduce((sum,key)=>sum+Number(row[key]||0),0)/5);
    const tahsinAverage=tahsin.length?Math.round(tahsin.reduce((total,row)=>total+tahsinScore(row),0)/tahsin.length):0;
    const tabs=[
      ["ringkasan","Ringkasan"],["alquran","Tahfidz & Tahsin"],["akademik","Akademik"],["pembinaan","Asrama & Pembinaan"],["keuangan","Keuangan"],
    ] as const;
    return <div className="student-360-page">
      <section className="student-360-hero">
        <button className="student-360-back" onClick={()=>setSelected(null)}>← Kembali ke daftar</button>
        <div className="student-360-identity"><span>{String(selected.name).split(" ").map(value=>value[0]).slice(0,2).join("")}</span><div><small>PROFIL SANTRI 360° · SATU SANTRI, SATU ID</small><h2>{selected.name}</h2><p>{selected.nis} · {selected.class_name} · Asrama {selected.room}</p></div></div>
        <div className="student-360-actions"><button className="secondary-button" onClick={()=>onCard(selected)}>Kartu QR</button>{editable&&<button className="primary-button" onClick={()=>onEdit(selected)}>Ubah Profil</button>}</div>
      </section>
      <section className="student-360-metrics">
        <article><span>Kehadiran</span><strong>{attendanceRate}%</strong><small>{attendance.length} catatan</small></article>
        <article><span>Hafalan tercatat</span><strong>{memorized}</strong><small>ayat disetorkan</small></article>
        <article><span>Nilai Tahsin</span><strong>{tahsinAverage||"—"}</strong><small>{tahsin[0]?.level||"Belum dinilai"}</small></article>
        <article><span>Tagihan aktif</span><strong>Rp{money.format(unpaid)}</strong><small>Saldo Rp{money.format(Number(wallet?.balance||0))}</small></article>
        <article><span>Poin pembinaan</span><strong>{points>0?`+${points}`:points}</strong><small>{counseling.length} catatan</small></article>
      </section>
      <nav className="student-360-tabs" aria-label="Bagian profil santri">{tabs.map(([key,label])=><button key={key} className={detailTab===key?"active":""} onClick={()=>setDetailTab(key)}>{label}</button>)}</nav>
      {detailTab==="ringkasan"&&<section className="student-360-grid">
        <article className="card student-360-card"><h3>Identitas & Penempatan</h3><dl><div><dt>NIS</dt><dd>{selected.nis}</dd></div><div><dt>Kelas</dt><dd>{selected.class_name}</dd></div><div><dt>Asrama/Kamar</dt><dd>{selected.room}</dd></div><div><dt>Status</dt><dd>{selected.status}</dd></div><div><dt>Wali</dt><dd>{selected.guardian_name}</dd></div><div><dt>Nomor HP</dt><dd>+{selected.guardian_phone}</dd></div></dl></article>
        <article className="card student-360-card"><h3>Aktivitas Terbaru</h3><div className="student-timeline">{[
          ...tahfidz.slice(0,2).map(row=>({title:`Setoran ${tahfidzRange(row)}`,meta:String(row.recorded_at||"Tahfidz"),tone:"green"})),
          ...mutabaah.slice(0,2).map(row=>({title:`Mutaba’ah ${row.activity}`,meta:String(row.record_date||"Kegiatan harian"),tone:row.completed?"green":"amber"})),
          ...health.slice(0,1).map(row=>({title:`Kesehatan: ${row.complaint}`,meta:String(row.status||"Dipantau"),tone:"amber"})),
        ].slice(0,5).map((item,index)=><div key={`${item.title}-${index}`}><i className={item.tone}/><span><strong>{item.title}</strong><small>{item.meta}</small></span></div>)}{!tahfidz.length&&!mutabaah.length&&!health.length&&<p className="muted">Belum ada aktivitas yang tercatat.</p>}</div></article>
      </section>}
      {detailTab==="alquran"&&<section className="student-360-grid"><article className="card student-360-card"><h3>Riwayat Tahfidz</h3><div className="student-record-list">{tahfidz.map(row=><div key={String(row.id)}><span><strong>{tahfidzRange(row)}</strong><small>{row.teacher} · {String(row.recorded_at).slice(0,10)}</small></span><Status>{row.grade}</Status></div>)}{!tahfidz.length&&<p className="muted">Belum ada setoran.</p>}</div></article><article className="card student-360-card"><h3>Perkembangan Tahsin</h3><div className="student-record-list">{tahsin.map(row=><div key={String(row.id)}><span><strong>{row.level}</strong><small>Makhraj {row.makhraj_score} · Tajwid {row.tajwid_score} · Kelancaran {row.fluency_score}</small></span><Status tone="blue">{tahsinScore(row)}</Status></div>)}{!tahsin.length&&<p className="muted">Belum ada penilaian Tahsin.</p>}</div></article></section>}
      {detailTab==="akademik"&&<section className="card student-360-card"><h3>Nilai Akademik</h3><div className="student-record-list">{grades.map(row=><div key={String(row.id)}><span><strong>{row.subject_name}</strong><small>{row.semester} · {row.academic_year}</small></span><Status tone={Number(row.final_score)>=Number(row.minimum_score)?"green":"amber"}>{row.final_score} · {row.predicate}</Status></div>)}{!grades.length&&<p className="muted">Belum ada nilai akademik.</p>}</div></section>}
      {detailTab==="pembinaan"&&<section className="student-360-grid"><article className="card student-360-card"><h3>Pembinaan & Prestasi</h3><div className="student-record-list">{counseling.map(row=><div key={String(row.id)}><span><strong>{row.type}: {row.category}</strong><small>{row.description}</small></span><Status tone={row.type==="Pelanggaran"?"red":"green"}>{row.type==="Pelanggaran"?"-":"+"}{Math.abs(Number(row.points||0))}</Status></div>)}{!counseling.length&&<p className="muted">Belum ada catatan pembinaan.</p>}</div></article><article className="card student-360-card"><h3>Perizinan & Kesehatan</h3><div className="student-record-list">{permits.map(row=><div key={`permit-${row.id}`}><span><strong>{row.reason}</strong><small>{row.start_date} – {row.end_date}</small></span><Status tone={row.status==="Disetujui"?"green":"amber"}>{row.status}</Status></div>)}{health.map(row=><div key={`health-${row.id}`}><span><strong>{row.complaint}</strong><small>{row.treatment}</small></span><Status tone="blue">{row.status}</Status></div>)}{!permits.length&&!health.length&&<p className="muted">Belum ada catatan izin atau kesehatan.</p>}</div></article></section>}
      {detailTab==="keuangan"&&<section className="student-360-grid"><article className="card student-360-card"><h3>Tagihan</h3><div className="student-record-list">{bills.map(row=><div key={String(row.id)}><span><strong>{row.category}</strong><small>{row.invoice_no} · jatuh tempo {row.due_date}</small></span><Status tone={row.status==="Lunas"?"green":"amber"}>Rp{money.format(Number(row.amount||0))}</Status></div>)}{!bills.length&&<p className="muted">Belum ada tagihan.</p>}</div></article><article className="card student-360-card wallet-summary"><span>Saldo SINURPAY</span><strong>Rp{money.format(Number(wallet?.balance||0))}</strong><small>Limit harian Rp{money.format(Number(wallet?.daily_limit||0))}</small></article></section>}
    </div>;
  }
  return (
    <section className="card data-card">
      <header className="card-header responsive"><div><h3>Daftar Santri</h3><p>{rows.length} santri tersimpan pada tahun ajaran 2026/2027</p></div><div className="header-actions"><a className="secondary-button link-button" href="/api/export?type=students&format=csv">⇩ Excel/CSV</a>{editable&&<button className="primary-button" onClick={onAdd}>+ Tambah Santri</button>}</div></header>
      <div className="filters"><div className="search-field">⌕ <input value={query} onChange={e=>{setQuery(e.target.value);setPage(1);}} placeholder="Cari nama atau NIS..." /></div><select value={classFilter} onChange={event=>{setClassFilter(event.target.value);setPage(1);}}><option>Semua Kelas</option>{classNames.map(value=><option key={value}>{value}</option>)}</select><select value={statusFilter} onChange={event=>{setStatusFilter(event.target.value);setPage(1);}}><option>Semua Status</option>{statuses.map(value=><option key={value}>{value}</option>)}</select></div>
      <div className="table-wrap"><table><thead><tr><th>Nama Santri</th><th>NIS</th><th>Kelas</th><th>Kamar</th><th>Status</th><th /></tr></thead>
        <tbody>{visibleRows.map(s=><tr key={String(s.id)}><td><button className="person person-link" onClick={()=>{setSelected(s);setDetailTab("ringkasan");}}><span>{String(s.name).split(" ").map(x=>x[0]).slice(0,2).join("")}</span><strong>{s.name}</strong></button></td><td className="muted">{s.nis}</td><td>{s.class_name}</td><td>{s.room}</td><td><Status tone={s.status==="Aktif"?"green":"amber"}>{s.status}</Status></td><td><div className="row-actions"><button onClick={()=>{setSelected(s);setDetailTab("ringkasan");}}>Lihat 360°</button><button onClick={()=>onCard(s)}>QR</button>{editable&&<><button onClick={()=>onEdit(s)}>Ubah</button><button className="danger-link" onClick={()=>onDelete(s)}>Hapus</button></>}</div></td></tr>)}</tbody>
      </table></div>
      <footer className="table-footer"><span>Menampilkan {visibleRows.length} dari {filtered.length} hasil · halaman {activePage}/{pageCount}</span><div><button disabled={activePage<=1} onClick={()=>setPage(value=>Math.max(1,value-1))}>‹</button><button className="active" disabled>{activePage}</button><button disabled={activePage>=pageCount} onClick={()=>setPage(value=>Math.min(pageCount,value+1))}>›</button></div></footer>
    </section>
  );
}

function ClassesPromotionPage({ data, onAdd, onEdit, onDelete, reload, notify }: { data:AppData; onAdd:()=>void; onEdit:(row:Row)=>void; onDelete:(row:Row)=>void; reload:()=>Promise<void>; notify:(message:string)=>void }) {
  const currentYear=String(data.classes[0]?.academic_year||"2026/2027");
  const nextYear=useMemo(()=>{
    const years=currentYear.match(/\d{4}/g);
    return years?.length===2?`${Number(years[0])+1}/${Number(years[1])+1}`:"2027/2028";
  },[currentYear]);
  const [yearFrom,setYearFrom]=useState(currentYear);
  const [yearTo,setYearTo]=useState(nextYear);
  const [processing,setProcessing]=useState(false);
  const activeStudents=data.students.filter(row=>row.status!=="Alumni"&&row.status!=="Nonaktif");
  const alumni=data.students.filter(row=>row.status==="Alumni"||String(row.class_name).startsWith("Alumni"));
  async function promote() {
    if(!window.confirm(`Proses kenaikan ${yearFrom} → ${yearTo}? Kelas seluruh santri aktif akan diperbarui dan santri tingkat akhir dipindahkan ke arsip Alumni.`)) return;
    setProcessing(true);
    try {
      const response=await fetch("/api/promotions",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({academicYearFrom:yearFrom,academicYearTo:yearTo})});
      const result=await response.json() as {error?:string;promoted?:number;alumni?:number;skipped?:number};
      if(!response.ok) throw new Error(result.error||"Kenaikan kelas gagal diproses.");
      notify(`${result.promoted||0} santri naik kelas, ${result.alumni||0} menjadi alumni, ${result.skipped||0} dilewati.`);
      await reload();
    } catch(error) { notify(error instanceof Error?error.message:"Kenaikan kelas gagal diproses."); }
    finally { setProcessing(false); }
  }
  return <div className="classes-page">
    <section className="stats-grid four">
      <article className="metric-card"><MiniIcon tone="blue">K</MiniIcon><div><span>Kelas Aktif</span><strong>{data.classes.filter(row=>row.status==="Aktif").length}</strong><small>Master kelas SMP–SMK</small></div></article>
      <article className="metric-card"><MiniIcon tone="green">↑</MiniIcon><div><span>Siap Diproses</span><strong>{activeStudents.length}</strong><small>Santri aktif dan izin</small></div></article>
      <article className="metric-card"><MiniIcon tone="violet">A</MiniIcon><div><span>Alumni Tersimpan</span><strong>{alumni.length}</strong><small>Data tidak pernah dihapus</small></div></article>
      <article className="metric-card"><MiniIcon tone="amber">↻</MiniIcon><div><span>Riwayat Kenaikan</span><strong>{data.promotionHistory.length}</strong><small>Jejak perpindahan kelas</small></div></article>
    </section>
    <section className="card report-toolbar">
      <div><strong>Kenaikan kelas otomatis</strong><small>Profil, tahfidz, kesehatan, pembayaran, dan laporan tetap memakai data santri yang sama.</small></div>
      <label>Dari<input value={yearFrom} onChange={event=>setYearFrom(event.target.value)} placeholder="2026/2027"/></label>
      <label>Ke<input value={yearTo} onChange={event=>setYearTo(event.target.value)} placeholder="2027/2028"/></label>
      <button className="primary-button" disabled={processing} onClick={()=>void promote()}>{processing?"Memproses…":"Proses Kenaikan"}</button>
    </section>
    <section className="card data-card">
      <header className="card-header responsive"><div><h3>Master Kelas</h3><p>Tambahkan kelas dan atur kelas tujuan berikutnya. Kelas akhir otomatis menjadi Alumni.</p></div><button className="primary-button" onClick={onAdd}>+ Tambah Kelas</button></header>
      <div className="table-wrap"><table><thead><tr><th>Kelas</th><th>Jenjang</th><th>Wali Kelas</th><th>Kapasitas</th><th>Kelas Berikutnya</th><th>Tahun Ajaran</th><th>Status</th><th /></tr></thead><tbody>
        {data.classes.map(row=><tr key={String(row.id)}><td><strong>{row.name}</strong><small className="cell-note">{row.major||`Tingkat ${row.grade_order}`}</small></td><td>{row.education_level}</td><td>{row.homeroom_teacher||"Belum ditentukan"}</td><td>{row.capacity} santri</td><td>{row.next_class_name||(["IX","XII"].includes(String(row.name).split(" ")[0])?`Alumni ${row.education_level}`:"Otomatis")}</td><td>{row.academic_year}</td><td><Status tone={row.status==="Aktif"?"green":"red"}>{row.status}</Status></td><td><DataActions row={row} onEdit={onEdit} onDelete={onDelete}/></td></tr>)}
        {!data.classes.length&&<tr><td colSpan={8} className="muted">Belum ada master kelas. Klik Tambah Kelas untuk memulai.</td></tr>}
      </tbody></table></div>
    </section>
    <section className="card data-card">
      <header className="card-header"><div><h3>Riwayat Kenaikan & Alumni</h3><p>Cadangan jejak kelas lama untuk audit dan penelusuran alumni.</p></div></header>
      <div className="table-wrap"><table><thead><tr><th>Santri</th><th>NIS</th><th>Dari</th><th>Tujuan</th><th>Proses</th><th>Tahun Ajaran</th><th>Waktu</th></tr></thead><tbody>
        {data.promotionHistory.slice(0,100).map(row=><tr key={String(row.id)}><td><strong>{row.student_name}</strong></td><td className="muted">{row.nis}</td><td>{row.from_class}</td><td>{row.to_class}</td><td><Status tone={row.action==="Alumni"?"violet":"green"}>{row.action}</Status></td><td>{row.academic_year_from} → {row.academic_year_to}</td><td>{new Date(String(row.processed_at)).toLocaleString("id-ID")}</td></tr>)}
        {!data.promotionHistory.length&&<tr><td colSpan={7} className="muted">Riwayat akan muncul setelah proses kenaikan pertama.</td></tr>}
      </tbody></table></div>
    </section>
  </div>;
}

function EmployeesPage({ rows, onAdd, onEdit, onDelete }: { rows:Row[]; onAdd:()=>void; onEdit:(row:Row)=>void; onDelete:(row:Row)=>void }) {
  const [query,setQuery]=useState("");
  const [unit,setUnit]=useState("Semua Unit");
  const [status,setStatus]=useState("Semua Status");
  const units=Array.from(new Set(rows.map(row=>String(row.work_unit||"")).filter(Boolean))).sort();
  const filtered=rows.filter(row=>{
    const matchesQuery=normalizeSearch(`${row.name} ${row.employee_no} ${row.position} ${row.phone}`).includes(normalizeSearch(query));
    const matchesUnit=unit==="Semua Unit"||row.work_unit===unit;
    const matchesStatus=status==="Semua Status"||row.status===status;
    return matchesQuery&&matchesUnit&&matchesStatus;
  });
  const active=rows.filter(row=>row.status==="Aktif").length;
  const educators=rows.filter(row=>["Pendidikan","Tahfidz"].includes(String(row.work_unit))).length;
  const permanent=rows.filter(row=>row.employment_type==="Tetap").length;
  return <div className="employees-page">
    <section className="stats-grid four employee-stats">
      <article className="metric-card"><MiniIcon tone="blue">ID</MiniIcon><div><span>Total Pegawai</span><strong>{rows.length}</strong><small>Seluruh data tersimpan</small></div></article>
      <article className="metric-card"><MiniIcon tone="green">✓</MiniIcon><div><span>Pegawai Aktif</span><strong>{active}</strong><small>{rows.length?Math.round(active/rows.length*100):0}% dari total pegawai</small></div></article>
      <article className="metric-card"><MiniIcon tone="violet">A</MiniIcon><div><span>Tenaga Pendidikan</span><strong>{educators}</strong><small>Guru, ustadz, dan tahfidz</small></div></article>
      <article className="metric-card"><MiniIcon tone="amber">☆</MiniIcon><div><span>Pegawai Tetap</span><strong>{permanent}</strong><small>Status kepegawaian tetap</small></div></article>
    </section>
    <section className="card data-card employee-data-card">
      <header className="card-header responsive"><div><h3>Daftar Pegawai</h3><p>Data pegawai bersifat terbatas dan hanya dapat dikelola Admin</p></div><button className="primary-button" onClick={onAdd}>+ Tambah Pegawai</button></header>
      <div className="filters employee-filters"><div className="search-field">⌕ <input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Cari nama, NIP, jabatan, atau nomor HP…"/></div><select value={unit} onChange={event=>setUnit(event.target.value)}><option>Semua Unit</option>{units.map(value=><option key={value}>{value}</option>)}</select><select value={status} onChange={event=>setStatus(event.target.value)}><option>Semua Status</option><option>Aktif</option><option>Cuti</option><option>Nonaktif</option></select></div>
      <div className="table-wrap"><table><thead><tr><th>Pegawai</th><th>NIP/Nomor Pegawai</th><th>Jabatan & Unit</th><th>Kepegawaian</th><th>Kontak</th><th>Status</th><th /></tr></thead><tbody>{filtered.map(row=><tr key={String(row.id)}><td><div className="person"><span>{String(row.name).split(" ").map(value=>value[0]).slice(0,2).join("").toUpperCase()}</span><div><strong>{row.name}</strong><small className="cell-note">{row.gender} · {row.education||"Pendidikan belum diisi"}</small></div></div></td><td className="muted">{row.employee_no}</td><td><strong>{row.position}</strong><small className="cell-note">{row.work_unit}</small></td><td>{row.employment_type}<small className="cell-note">Masuk {row.join_date?new Date(String(row.join_date)).toLocaleDateString("id-ID"):"—"}</small></td><td>{row.phone||"—"}<small className="cell-note">{row.email||"Email belum diisi"}</small></td><td><Status tone={row.status==="Aktif"?"green":row.status==="Cuti"?"amber":"red"}>{row.status}</Status></td><td><DataActions row={row} onEdit={onEdit} onDelete={onDelete}/></td></tr>)}{!filtered.length&&<tr><td colSpan={7} className="muted">Tidak ada pegawai yang sesuai dengan filter.</td></tr>}</tbody></table></div>
      <footer className="table-footer"><span>Menampilkan {filtered.length} dari {rows.length} pegawai</span><small>Terakhir diperbarui otomatis</small></footer>
    </section>
  </div>;
}

function MutabaahPage({ data, onAdd, onEdit, onDelete, notify }: { data:AppData; onAdd:()=>void; onEdit:(row:Row)=>void; onDelete:(row:Row)=>void; notify:(message:string)=>void }) {
  const rows=data.mutabaah;
  const today=new Date().toISOString().slice(0,10);
  const todayRows=rows.filter(row=>String(row.record_date)===today);
  const completion=todayRows.length?Math.round(todayRows.filter(row=>Number(row.completed)).length/todayRows.length*100):0;
  const habits=Array.from(rows.reduce((map,row)=>{
    const key=String(row.activity||"Kegiatan");
    const current=map.get(key)||{total:0,done:0};
    current.total+=1;current.done+=Number(row.completed)?1:0;map.set(key,current);return map;
  },new Map<string,{total:number;done:number}>())).map(([label,value])=>[label,Math.round(value.done/value.total*100),value.total] as const).slice(0,8);
  const attention=data.students.map(student=>{
    const records=rows.filter(row=>String(row.student_id)===String(student.id));
    const rate=records.length?Math.round(records.filter(row=>Number(row.completed)).length/records.length*100):100;
    return {student,rate};
  }).filter(item=>item.rate<70).sort((a,b)=>a.rate-b.rate).slice(0,5);
  function contact(student:Row) {
    const phone=String(student.guardian_phone||"").replace(/\D/g,"");
    if(!phone){notify("Nomor WhatsApp wali belum tersedia.");return;}
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(`Assalamu’alaikum, kami ingin menyampaikan perkembangan mutaba’ah ${student.name}. Mohon pendampingannya. Jazakumullahu khairan.`)}`,"_blank","noopener,noreferrer");
  }
  return (
    <div className="feature-app mutabaah-app">
      <section className="summary-banner mutabaah-hero"><div><span>MUTABA’AH HARI INI</span><strong>Ibadah yang konsisten,<br/>karakter yang bertumbuh.</strong><p>{todayRows.filter(row=>Number(row.completed)).length} dari {todayRows.length} catatan selesai · capaian harian {completion}%</p><button className="feature-primary" onClick={onAdd}>＋ Catat Kegiatan</button></div><div className="donut" style={{background:`conic-gradient(#a7f3d0 0 ${completion}%,rgba(255,255,255,.16) ${completion}% 100%)`}}><span>{completion}<small>%</small></span></div></section>
      <section className="dashboard-grid">
        <article className="card compact-list"><header className="card-header"><div><h3>Capaian Kegiatan</h3><p>Rekap kegiatan dan ibadah harian</p></div><button className="primary-button" onClick={onAdd}>+ Catat Kegiatan</button></header>
          {habits.map(([h,v,total])=><div className="progress-row habit" key={String(h)}><div><strong>{h}</strong><small>{total} catatan</small></div><Progress value={Number(v)} tone={Number(v)<70?"amber":"green"} /><b>{v}%</b></div>)}{!habits.length&&<div className="portal-empty">Belum ada data kegiatan.</div>}
        </article>
        <article className="card"><header className="card-header"><div><h3>Perlu Perhatian</h3><p>Santri dengan capaian di bawah 70%</p></div></header>
          <div className="attention-list">{attention.map(({student,rate})=><div key={String(student.id)}><span className="avatar">{String(student.name).split(" ").map(value=>value[0]).slice(0,2).join("")}</span><div><strong>{student.name}</strong><small>{student.class_name} · {rate}% tercapai</small></div><button onClick={()=>contact(student)}>Hubungi</button></div>)}{!attention.length&&<div className="portal-empty">Tidak ada santri di bawah 70%.</div>}</div>
        </article>
      </section><section className="card data-card feature-data-card"><header className="card-header"><div><h3>Catatan Mutaba’ah Santri</h3><p>{rows.length} catatan tersimpan</p></div></header><div className="table-wrap"><table><thead><tr><th>Santri</th><th>Kegiatan</th><th>Tanggal</th><th>Status</th><th /></tr></thead><tbody>{rows.map(row=><tr key={String(row.id)}><td><strong>{row.student_name}</strong></td><td>{row.activity}</td><td>{row.record_date}</td><td><Status tone={Number(row.completed)?"green":"amber"}>{Number(row.completed)?"Selesai":"Belum"}</Status></td><td><DataActions row={row} onEdit={onEdit} onDelete={onDelete}/></td></tr>)}</tbody></table></div></section>
    </div>
  );
}

function HealthPage({ rows, onAdd, onEdit, onDelete }: { rows: Row[]; onAdd: () => void; onEdit: (row: Row) => void; onDelete: (row: Row) => void }) {
  const monitored=rows.filter(row=>row.status==="Dipantau").length;
  const recovered=rows.filter(row=>row.status==="Membaik"||row.status==="Selesai").length;
  const referred=rows.filter(row=>row.status==="Dirujuk").length;
  return (
    <>
      <section className="stats-grid three">
        <article className="metric-card"><MiniIcon tone="green">✓</MiniIcon><div><span>Membaik / Selesai</span><strong>{recovered}</strong><small>Dari catatan tersimpan</small></div></article>
        <article className="metric-card"><MiniIcon tone="amber">✚</MiniIcon><div><span>Dalam Pemantauan</span><strong>{monitored}</strong><small>Perlu tindak lanjut</small></div></article>
        <article className="metric-card"><MiniIcon tone="red">!</MiniIcon><div><span>Dirujuk</span><strong>{referred}</strong><small>Fasilitas kesehatan</small></div></article>
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
  stats:{totalBalance:number;todayRevenue:number;todayTransactions:number;lowStock:number;ledgerBalance:number;reconciliationVariance:number;stockValue:number;reversedTransactions:number};
};

function SinurpayPage({ notify }: { notify:(message:string)=>void }) {
  const [data,setData]=useState<SinurpayPayload>({accounts:[],entries:[],topups:[],products:[],sales:[],saleItems:[],stats:{totalBalance:0,todayRevenue:0,todayTransactions:0,lowStock:0,ledgerBalance:0,reconciliationVariance:0,stockValue:0,reversedTransactions:0}});
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
  useEffect(()=>{const timer=window.setTimeout(()=>void load(),0);return()=>window.clearTimeout(timer);},[load]);

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
  const cartLines:(Row&{quantity:number})[]=data.products.filter(item=>cart[String(item.id)]).map(item=>({...item,quantity:cart[String(item.id)]}));
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
      <article className="card data-card wallet-accounts"><header className="card-header"><div><h3>Rekening Santri</h3><p>Saldo, limit harian, dan status kartu</p></div><a className="secondary-button link-button" href="/kartu-santri" target="_blank" rel="noreferrer">Cetak Kartu Massal</a></header><div className="table-wrap"><table><thead><tr><th>Santri</th><th>Saldo</th><th>Limit Harian</th><th>Kartu</th><th /></tr></thead><tbody>{data.accounts.map(account=><tr key={String(account.id)}><td><strong>{account.student_name}</strong><small className="cell-note">{account.nis} · {account.class_name}</small></td><td><strong>Rp{money.format(Number(account.balance))}</strong></td><td>Rp{money.format(Number(account.daily_limit))}</td><td><Status tone={account.status==="Aktif"?"green":"red"}>{account.status}</Status></td><td><button className="text-button" onClick={()=>void updateAccount(account)}>Atur</button></td></tr>)}</tbody></table></div></article>
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

    {tab==="reports"&&<><section className="stats-grid four"><article className="metric-card"><MiniIcon tone={data.stats.reconciliationVariance===0?"green":"red"}>✓</MiniIcon><div><span>Rekonsiliasi Saldo</span><strong>Rp{money.format(Math.abs(data.stats.reconciliationVariance))}</strong><small>{data.stats.reconciliationVariance===0?"Saldo dan buku besar sesuai":"Ada selisih yang perlu diaudit"}</small></div></article><article className="metric-card"><MiniIcon tone="blue">Rp</MiniIcon><div><span>Saldo Buku Besar</span><strong>Rp{money.format(data.stats.ledgerBalance)}</strong><small>Akumulasi seluruh mutasi</small></div></article><article className="metric-card"><MiniIcon tone="violet">▦</MiniIcon><div><span>Nilai Persediaan</span><strong>Rp{money.format(data.stats.stockValue)}</strong><small>Harga jual × stok aktif</small></div></article><article className="metric-card"><MiniIcon tone="amber">↶</MiniIcon><div><span>Transaksi Dibatalkan</span><strong>{data.stats.reversedTransactions}</strong><small>Dana dan stok dikembalikan</small></div></article></section><section className="card data-card sinurpay-sales"><header className="card-header"><div><h3>Transaksi Kantin</h3><p>Riwayat pembayaran, pembatalan, kasir, dan referensi</p></div><a className="secondary-button link-button" href="/api/sinurpay?format=csv">Ekspor CSV</a></header><div className="table-wrap"><table><thead><tr><th>Referensi</th><th>Santri</th><th>Waktu</th><th>Belanja</th><th>Total</th><th>Status</th><th /></tr></thead><tbody>{data.sales.map(sale=>{const items=data.saleItems.filter(item=>Number(item.sale_id)===Number(sale.id));return <tr key={String(sale.id)}><td className="muted">{sale.receipt_no}</td><td><strong>{sale.student_name}</strong><small className="cell-note">{sale.nis}</small></td><td>{String(sale.created_at).slice(0,16).replace("T"," ")}</td><td>{items.map(item=>`${item.product_name} ×${item.quantity}`).join(", ")||"-"}</td><td><strong>Rp{money.format(Number(sale.total))}</strong></td><td><Status tone={sale.status==="Berhasil"?"green":"red"}>{sale.status}</Status></td><td>{sale.status==="Berhasil"&&<button className="danger-link" onClick={()=>void reverseSale(sale)}>Batalkan</button>}</td></tr>})}{!data.sales.length&&<tr><td colSpan={7} className="muted">Belum ada transaksi kantin.</td></tr>}</tbody></table></div></section></>}
  </div>;
}

function FinancePage({ rows, bills, onAdd, onBill, onNotify, onPayment }: { rows: Row[]; bills:Row[]; onAdd: () => void; onBill:()=>void; onNotify: () => void; onPayment:(row:Row)=>void }) {
  const incoming = rows.filter(x=>x.type==="Masuk").reduce((sum,x)=>sum+Number(x.amount||0),0);
  const allowance=rows.filter(x=>x.type==="Masuk"&&x.category==="Uang Saku").reduce((sum,x)=>sum+Number(x.amount||0),0);
  const unpaid=bills.filter(row=>row.status!=="Lunas");
  const unpaidTotal=unpaid.reduce((sum,row)=>sum+Number(row.amount||0),0);
  return (
    <>
      <section className="stats-grid three">
        <article className="metric-card"><MiniIcon tone="blue">Rp</MiniIcon><div><span>Pemasukan Tercatat</span><strong>Rp{money.format(incoming)}</strong><small>Data transaksi permanen</small></div></article>
        <article className="metric-card"><MiniIcon tone="green">✓</MiniIcon><div><span>Uang Saku Masuk</span><strong>Rp{money.format(allowance)}</strong><small>Transaksi tersimpan</small></div></article>
        <article className="metric-card"><MiniIcon tone="amber">!</MiniIcon><div><span>Belum Dibayar</span><strong>Rp{money.format(unpaidTotal)}</strong><small>{unpaid.length} tagihan aktif</small></div></article>
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

function CharacterPage({ data, onAdd, onEdit, onDelete }: { data:AppData; onAdd:()=>void; onEdit:(row:Row)=>void; onDelete:(row:Row)=>void }) {
  const [selectedId,setSelectedId]=useState(String(data.students[0]?.id||""));
  const selected=data.students.find(student=>String(student.id)===selectedId)||data.students[0];
  const records=data.characters.filter(row=>String(row.student_id)===String(selected?.id));
  const categories=["Adab & Akhlak","Kedisiplinan","Kemandirian","Tanggung Jawab","Kebersihan"];
  const traits=categories.map((category,index)=>{
    const record=records.find(row=>row.category===category);
    return {category,score:Number(record?.score||0),tone:["green","blue","amber","violet","green"][index],record};
  });
  const average=records.length?Math.round(records.reduce((sum,row)=>sum+Number(row.score||0),0)/records.length):0;
  const predicate=average>=90?"Sangat Baik":average>=80?"Baik":average>=70?"Cukup":"Perlu Pembinaan";
  const grade=average>=90?"A":average>=80?"B":average>=70?"C":"D";
  const note=records.find(row=>String(row.note||"").trim())?.note;
  return (
    <section className="dashboard-grid">
      <article className="card character-profile"><span className="large-avatar">{selected?String(selected.name).split(" ").map(value=>value[0]).slice(0,2).join(""):"—"}</span><h3>{selected?.name||"Belum ada santri"}</h3><p>{selected?`${selected.class_name} · ${selected.room}`:"Tambahkan data santri terlebih dahulu"}</p><strong>{records.length?grade:"—"}</strong><small>Predikat: {records.length?predicate:"Belum dinilai"}</small><label className="character-student-picker">Pilih Santri<select value={String(selected?.id||"")} onChange={event=>setSelectedId(event.target.value)}>{data.students.map(student=><option key={String(student.id)} value={String(student.id)}>{student.name} · {student.class_name}</option>)}</select></label></article>
      <article className="card compact-list"><header className="card-header"><div><h3>Penilaian Karakter</h3><p>Semester Ganjil 2026/2027</p></div><button className="primary-button" onClick={onAdd}>Input Nilai</button></header>
        {traits.map(item=><div className="trait-row" key={item.category}><div><strong>{item.category}</strong><small>{item.score>=90?"Istiqamah":item.score>=80?"Baik":item.score?"Perlu ditingkatkan":"Belum dinilai"}</small></div><Progress value={item.score} tone={item.tone} /><b>{item.score||"—"}</b>{item.record&&<DataActions row={item.record} onEdit={onEdit} onDelete={onDelete}/>}</div>)}
        <div className="teacher-note"><span>“</span><p>{note||"Belum ada catatan pembina untuk santri ini."}</p><small>— Catatan pembina SINURMAN</small></div>
      </article>
    </section>
  );
}

function InventoryPage({ rows, onAdd, onEdit, onDelete }: { rows: Row[]; onAdd: () => void; onEdit: (row: Row) => void; onDelete: (row: Row) => void }) {
  return <section className="card data-card"><header className="card-header"><div><h3>Daftar Inventaris</h3><p>{rows.reduce((sum,x)=>sum+Number(x.quantity||0),0)} item tercatat</p></div><button className="primary-button" onClick={onAdd}>+ Tambah Barang</button></header><div className="table-wrap"><table><thead><tr><th>Nama Barang</th><th>Lokasi</th><th>Jumlah</th><th>Kondisi</th><th /></tr></thead><tbody>{rows.map((r,i)=><tr key={String(r.id)}><td><strong>{r.name}</strong></td><td>{r.location}</td><td>{r.quantity} {r.unit}</td><td><Status tone={i===2?"amber":"green"}>{r.condition}</Status></td><td><div className="row-actions"><button onClick={()=>onEdit(r)}>Ubah</button><button className="danger-link" onClick={()=>onDelete(r)}>Hapus</button></div></td></tr>)}</tbody></table></div></section>;
}

function AnnouncementsPage({ rows, editable, onAdd, onEdit, onDelete, onNotify }: { rows: Row[]; editable:boolean; onAdd: () => void; onEdit: (row: Row) => void; onDelete: (row: Row) => void; onNotify: () => void }) {
  return <section className="card announcements-page"><header className="card-header"><div><h3>Semua Pengumuman</h3><p>Informasi resmi Pondok Pesantren Nurul Iman</p></div>{editable&&<div className="header-actions"><button className="secondary-button" onClick={onNotify}>Kirim WhatsApp</button><button className="primary-button" onClick={onAdd}>+ Buat Pengumuman</button></div>}</header>{rows.map((x,i)=>{const date=new Date(String(x.published_at));return <article key={String(x.id)}><span className="date-box"><b>{date.getDate()}</b>{date.toLocaleDateString("id-ID",{month:"short"}).toUpperCase()}</span><div><Status tone={["blue","green","violet"][i%3]}>{x.category}</Status><h3>{x.title}</h3><p>{x.content}</p><small>Dipublikasikan oleh {x.author} · {x.audience}</small></div>{editable&&<div className="row-actions"><button onClick={()=>onEdit(x)}>Ubah</button><button className="danger-link" onClick={()=>onDelete(x)}>Hapus</button></div>}</article>})}</section>;
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

function SchedulePage({ data, role, edit, remove }: { data:AppData; role:Role; edit:(r:Resource,row?:Row)=>void; remove:(r:Resource,row:Row)=>void }) {
  const [level,setLevel]=useState("SMP");
  const classes=Array.from(new Set(data.schedules.filter(x=>x.education_level===level).map(x=>String(x.class_name)))).sort();
  const [selectedClass,setSelectedClass]=useState("VII A");
  const [day,setDay]=useState("Senin");
  const activeClass=classes.includes(selectedClass)?selectedClass:(classes[0]??selectedClass);
  const filtered=data.schedules.filter(x=>x.education_level===level&&x.class_name===activeClass&&x.day_name===day);
  const canEditSchedule=role==="Admin"||role==="Ustadz";
  return <><section className="schedule-toolbar card"><div className="level-tabs"><button className={level==="SMP"?"active":""} onClick={()=>setLevel("SMP")}>SMP</button><button className={level==="SMK"?"active":""} onClick={()=>setLevel("SMK")}>SMK</button></div><label>Kelas<select value={activeClass} onChange={e=>setSelectedClass(e.target.value)}>{classes.map(x=><option key={x}>{x}</option>)}</select></label><label>Hari<select value={day} onChange={e=>setDay(e.target.value)}>{["Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"].map(x=><option key={x}>{x}</option>)}</select></label>{canEditSchedule&&<button className="primary-button" onClick={()=>edit("schedules",{education_level:level,class_name:activeClass,day_name:day})}>+ Tambah Pelajaran</button>}</section><section className="dashboard-grid operations-grid"><article className="card data-card"><header className="card-header"><div><h3>Jadwal Harian {activeClass}</h3><p>{day} · {level} · {filtered.length} jam pelajaran</p></div><Status tone={level==="SMP"?"blue":"violet"}>{level}</Status></header><div className="daily-timetable">{filtered.length?filtered.map((x,i)=><div key={String(x.id)}><span className="period-number">{i+1}</span><span className={`schedule-time tone-${i%4}`}>{x.start_time}<small>{x.end_time}</small></span><div><Status tone={x.category==="Produktif"?"violet":x.category==="Tahfidz"?"green":"blue"}>{x.category}</Status><strong>{x.title}</strong><small>{x.teacher} · {x.location}</small></div>{canEditSchedule&&<DataActions row={x} onEdit={r=>edit("schedules",r)} onDelete={r=>remove("schedules",r)} />}</div>):<div className="empty-schedule">Belum ada jadwal untuk kelas dan hari ini.</div>}</div></article>
  <article className="card data-card"><header className="card-header"><div><h3>Kamar & Hunian</h3><p>Kapasitas dan pembina asrama</p></div>{role==="Admin"&&<button className="primary-button" onClick={()=>edit("rooms")}>+ Kamar</button>}</header><div className="room-grid">{data.rooms.map(x=><div className="room-card" key={String(x.id)}><span>◇</span><div><strong>{x.name}</strong><small>{x.supervisor}</small><p>Kapasitas {x.capacity} santri</p></div><Status>{x.status}</Status>{role==="Admin"&&<DataActions row={x} onEdit={r=>edit("rooms",r)} onDelete={r=>remove("rooms",r)} />}</div>)}</div></article></section></>;
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
  if(role==="Wali Santri") return <div className="feature-app admissions-app"><section className="summary-banner admission-banner"><div><span>PPDB ONLINE 2026/2027</span><strong>{rows.length?`${rows.length} Pendaftaran`:"Masa depan dimulai di sini."}</strong><p>Isi formulir, unggah dokumen, dan pantau hasil verifikasi secara online.</p></div><button className="light-button" onClick={()=>setShowForm(true)}>＋ Formulir Baru</button></section>
    <section className="ppdb-steps">{["Isi Formulir","Unggah Dokumen","Verifikasi Admin","Tes & Kelulusan"].map((x,i)=><article className="card" key={x}><span>{i+1}</span><strong>{x}</strong><small>{i===0?"Data calon santri":i===1?"PDF/JPG/PNG maks. 5 MB":i===2?"Pantau catatan perbaikan":"Hasil diumumkan di portal"}</small></article>)}</section>
    <section className="ppdb-applications">{rows.map(row=>{const docs=data.admissionDocuments.filter(x=>Number(x.admission_id)===Number(row.id));const valid=docs.filter(x=>x.status==="Valid").length;return <article className="card ppdb-application-card" key={String(row.id)}><header><div><span>{row.registration_no}</span><h3>{row.name}</h3><p>{row.desired_level} · {row.previous_school}</p></div><Status tone={ppdbTone(row.status)}>{row.status}</Status></header><div className="ppdb-progress"><span><i style={{width:`${Math.min(100,Math.max(15,ppdbStatuses.indexOf(String(row.status))*18+15))}%`}}/></span><small>{valid} dokumen valid · {docs.length} berkas diunggah</small></div>{row.verification_note&&<div className="verification-note"><strong>Catatan verifikator</strong><p>{row.verification_note}</p></div>}<footer><button className="primary-button" onClick={()=>setDocumentsFor(row)}>Kelola Dokumen</button><small>Dibuat {new Date(String(row.created_at)).toLocaleDateString("id-ID")}</small></footer></article>})}{!rows.length&&<article className="card ppdb-empty"><span>＋</span><h3>Belum ada pendaftaran</h3><p>Mulai pendaftaran calon santri SMP atau SMK Nurul Iman.</p><button className="primary-button" onClick={()=>setShowForm(true)}>Isi Formulir PPDB</button></article>}</section>
    {showForm&&<PpdbApplicationModal onClose={()=>setShowForm(false)} onSaved={reload} notify={notify}/>}
    {documentsFor&&<PpdbDocumentsModal admission={documentsFor} documents={data.admissionDocuments} role={role} onClose={()=>setDocumentsFor(null)} onUpdated={reload} notify={notify}/>}</div>;

  return <div className="feature-app admissions-app"><section className="summary-banner admission-banner"><div><span>PPDB 2026/2027 · COMMAND CENTER</span><strong>{rows.length} Pendaftar</strong><p>Formulir, berkas, verifikasi, tes, dan kelulusan dalam satu tempat.</p></div><button className="light-button" onClick={()=>setShowForm(true)}>＋ Pendaftar Baru</button></section><section className="stats-grid three ppdb-stats"><Metric title="Terverifikasi" value={verified} icon="✓" tone="green"/><Metric title="Perlu Perbaikan" value={needsFix} icon="!" tone="red"/><Metric title="Menunggu Proses" value={Math.max(0,rows.length-verified-needsFix)} icon="⌛" tone="blue"/></section><section className="card data-card feature-data-card"><header className="card-header"><div><h3>Daftar Calon Santri</h3><p>Penerimaan santri baru dan status pemeriksaan dokumen</p></div><button className="primary-button" onClick={()=>setShowForm(true)}>Tambah Pendaftar</button></header><div className="table-wrap"><table><thead><tr><th>No. Pendaftaran</th><th>Calon Santri</th><th>Jenjang</th><th>Dokumen</th><th>Nilai</th><th>Tahap</th><th /></tr></thead><tbody>{rows.map(x=>{const docs=data.admissionDocuments.filter(d=>Number(d.admission_id)===Number(x.id));return <tr key={String(x.id)}><td className="muted">{x.registration_no}</td><td><strong>{x.name}</strong><small className="cell-note">{x.guardian_name} · {x.guardian_phone}</small></td><td>{x.desired_level||"—"}<small className="cell-note">{x.previous_school}</small></td><td><button className="text-button" onClick={()=>setDocumentsFor(x)}>{docs.length} berkas · Periksa</button></td><td>{x.score||0}</td><td><Status tone={ppdbTone(x.status)}>{x.status}</Status></td><td><div className="row-actions"><button onClick={()=>setVerifyFor(x)} aria-label="Verifikasi">✓</button><button onClick={()=>setDocumentsFor(x)} aria-label="Dokumen">▤</button><button onClick={()=>remove("admissions",x)} aria-label="Hapus">×</button></div></td></tr>})}{!rows.length&&<tr><td colSpan={7} className="muted">Belum ada pendaftar.</td></tr>}</tbody></table></div></section>
  {showForm&&<PpdbApplicationModal onClose={()=>setShowForm(false)} onSaved={reload} notify={notify}/>}
  {documentsFor&&<PpdbDocumentsModal admission={documentsFor} documents={data.admissionDocuments} role={role} onClose={()=>setDocumentsFor(null)} onUpdated={reload} notify={notify}/>}
  {verifyFor&&<PpdbVerifyModal admission={verifyFor} onClose={()=>setVerifyFor(null)} onUpdated={reload} notify={notify}/>}</div>;
}

function CounselingPage({ rows, edit, remove }: { rows:Row[]; edit:(r:Resource,row?:Row)=>void; remove:(r:Resource,row:Row)=>void }) {
  return <section className="card data-card"><header className="card-header"><div><h3>Catatan Konseling & Pembinaan</h3><p>Data bersifat terbatas untuk pengurus berwenang</p></div><button className="primary-button" onClick={()=>edit("counseling")}>+ Catatan Baru</button></header><div className="table-wrap"><table><thead><tr><th>Santri</th><th>Jenis</th><th>Kategori</th><th>Catatan</th><th>Poin</th><th>Status</th><th /></tr></thead><tbody>{rows.map(x=><tr key={String(x.id)}><td><strong>{x.student_name}</strong></td><td><Status tone={x.type==="Prestasi"?"green":x.type==="Pelanggaran"?"red":"blue"}>{x.type}</Status></td><td>{x.category}</td><td>{x.description}</td><td>{x.points}</td><td>{x.status}</td><td><DataActions row={x} onEdit={r=>edit("counseling",r)} onDelete={r=>remove("counseling",r)} /></td></tr>)}</tbody></table></div></section>;
}

function GuardianAccessAdmin({ data, reload, notify }: { data:AppData; reload:()=>Promise<void>; notify:(message:string)=>void }) {
  const [selected,setSelected]=useState<{phone:string;name:string;students:string}|null>(null);
  const [pin,setPin]=useState("");
  const [saving,setSaving]=useState(false);
  const guardians=Array.from(data.students.reduce((map,student)=>{
    const phone=String(student.guardian_phone||"");
    if(!phone) return map;
    const current=map.get(phone)??{phone,name:String(student.guardian_name||"Wali Santri"),students:[] as string[]};
    current.students.push(String(student.name));
    map.set(phone,current);
    return map;
  },new Map<string,{phone:string;name:string;students:string[]}>()).values());
  async function savePin(event:React.FormEvent) {
    event.preventDefault(); if(!selected) return; setSaving(true);
    const response=await fetch("/api/guardian-accounts",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({phone:selected.phone,pin})});
    const result=await response.json() as {error?:string;message?:string};
    setSaving(false);
    if(!response.ok){notify(result.error||"PIN gagal disimpan.");return;}
    notify(result.message||"PIN Portal Wali disimpan.");setSelected(null);setPin("");await reload();
  }
  async function toggle(phone:string,status:string) {
    const next=status==="Aktif"?"Diblokir":"Aktif";
    const response=await fetch("/api/guardian-accounts",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({phone,status:next})});
    const result=await response.json() as {error?:string};
    if(!response.ok){notify(result.error?.replace("MFA_REQUIRED: ","")||"Status akun gagal diubah.");return;}
    notify(next==="Aktif"?"Akun wali disetujui dan sudah dapat masuk.":"Akses wali berhasil diblokir.");await reload();
  }
  return <><section className="guardian-access-admin card"><div><span>PORTAL WALI SANTRI</span><h3>Pendaftaran wali dengan nomor HP</h3><p>Wali dapat membuat PIN sendiri jika nomor WhatsApp-nya sudah tercatat pada Data Santri. Akun baru tetap menunggu persetujuan Admin sebelum dapat melihat laporan anak.</p></div><a className="primary-button link-button" href="/wali" target="_blank" rel="noreferrer">Buka & Bagikan Portal Wali →</a></section>
  <section className="card data-card guardian-access-table"><header className="card-header"><div><h3>Akses Portal Wali</h3><p>Periksa akun yang menunggu, lalu setujui atau blokir aksesnya</p></div><Status tone="blue">{guardians.length} wali</Status></header><div className="table-wrap"><table><thead><tr><th>Wali</th><th>Santri Terhubung</th><th>Status Akses</th><th /></tr></thead><tbody>{guardians.map(guardian=>{const account=data.guardianAccounts.find(row=>String(row.phone)===guardian.phone);const status=String(account?.status||"Belum mendaftar");return <tr key={guardian.phone}><td><strong>{guardian.name}</strong><small className="cell-note">+{guardian.phone}</small></td><td>{guardian.students.join(", ")}</td><td><Status tone={status==="Aktif"?"green":status==="Diblokir"?"red":"amber"}>{status}</Status></td><td><div className="guardian-access-actions"><button className="text-button" onClick={()=>{setSelected({phone:guardian.phone,name:guardian.name,students:guardian.students.join(", ")});setPin("");}}>{account?"Reset PIN":"Buat PIN"}</button>{account&&<button className="text-button" onClick={()=>void toggle(guardian.phone,status)}>{status==="Aktif"?"Blokir":status==="Menunggu Persetujuan"?"Setujui":"Aktifkan"}</button>}</div></td></tr>})}{!guardians.length&&<tr><td colSpan={4} className="muted">Isi nomor WhatsApp pada Data Santri terlebih dahulu.</td></tr>}</tbody></table></div></section>
  {selected&&<div className="modal-backdrop" onMouseDown={()=>setSelected(null)}><form className="record-modal guardian-pin-modal" onSubmit={savePin} onMouseDown={event=>event.stopPropagation()}><button type="button" className="modal-close" onClick={()=>setSelected(null)}>×</button><span className="modal-eyebrow">AKSES PORTAL WALI</span><h2>Atur PIN {selected.name}</h2><p>+{selected.phone} · {selected.students}. Mengganti PIN akan mengeluarkan sesi lama dari semua perangkat.</p><label>PIN 6 angka<input required autoFocus inputMode="numeric" pattern="[0-9]{6}" minLength={6} maxLength={6} value={pin} onChange={event=>setPin(event.target.value.replace(/\D/g,"").slice(0,6))} placeholder="Contoh: 482731"/></label><div className="modal-actions"><button type="button" className="secondary-button" onClick={()=>setSelected(null)}>Batal</button><button className="primary-button" disabled={saving}>{saving?"Menyimpan…":"Simpan PIN"}</button></div></form></div>}</>;
}

function UserAccessModal({ row, rooms, onClose, onSaved }: { row?:Row; rooms:Row[]; onClose:()=>void; onSaved:(message:string)=>Promise<void> }) {
  const [name,setName]=useState(String(row?.name||""));
  const [email,setEmail]=useState(String(row?.email||""));
  const [role,setRole]=useState<Role>((row?.role as Role)||"Ustadz");
  const [roomScope,setRoomScope]=useState(String(row?.roomScope||row?.room_scope||""));
  const [password,setPassword]=useState("");
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");
  async function submit(event:React.FormEvent) {
    event.preventDefault();setSaving(true);setError("");
    const response=await fetch("/api/admin-users",{
      method:row?"PATCH":"POST",
      headers:{"content-type":"application/json"},
      body:JSON.stringify(row
        ? {id:Number(row.id),action:"update",name,role,roomScope}
        : {name,email,role,roomScope,password}),
    });
    const result=await response.json() as {error?:string;message?:string};
    if(!response.ok){setError(result.error||"Akun gagal disimpan.");setSaving(false);return;}
    await onSaved(result.message||"Akun berhasil disimpan.");onClose();
  }
  return <div className="modal-backdrop" onMouseDown={onClose}><form className="record-modal user-access-modal" onSubmit={submit} onMouseDown={event=>event.stopPropagation()}>
    <button type="button" className="modal-close" onClick={onClose}>×</button><span className="modal-eyebrow">AKSES INTERNAL SINURMAN</span>
    <h2>{row?"Ubah hak akses":"Buat akun sekolah"}</h2><p>{row?"Perubahan peran akan mengeluarkan sesi lama pengguna.":"Email dan sandi ini dapat langsung dipakai pada halaman login Admin."}</p>
    <div className="form-grid"><label>Nama lengkap<input required value={name} onChange={event=>setName(event.target.value)}/></label>
      <label>Email login<input required type="email" autoComplete="username" readOnly={!!row} value={email} onChange={event=>setEmail(event.target.value)}/></label>
      <label>Peran<select required value={role} onChange={event=>setRole(event.target.value as Role)}><option>Admin</option><option>Kepala Asrama</option><option>Musyrif</option><option>Ustadz</option></select></label>
      <label>Kamar/asrama penugasan<select required={role==="Musyrif"||role==="Kepala Asrama"} value={roomScope} onChange={event=>setRoomScope(event.target.value)}><option value="">Tidak dibatasi</option>{rooms.map(room=><option key={String(room.id)} value={String(room.name)}>{room.name}</option>)}</select></label>
      {!row&&<label className="wide">Sandi sementara<input required minLength={8} type="password" autoComplete="new-password" value={password} onChange={event=>setPassword(event.target.value)} placeholder="Minimal 8 karakter, berisi huruf dan angka"/><small>Bagikan sandi secara pribadi dan minta pengguna segera menggantinya.</small></label>}
    </div>{error&&<div className="form-error">{error}</div>}
    <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Batal</button><button className="primary-button" disabled={saving}>{saving?"Menyimpan…":row?"Simpan Perubahan":"Buat Akun Login"}</button></div>
  </form></div>;
}

function ResetUserPasswordModal({ row, onClose, onSaved }: { row:Row; onClose:()=>void; onSaved:(message:string)=>Promise<void> }) {
  const [password,setPassword]=useState("");
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");
  async function submit(event:React.FormEvent){
    event.preventDefault();setSaving(true);setError("");
    const response=await fetch("/api/admin-users",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({id:Number(row.id),action:"reset-password",password})});
    const result=await response.json() as {error?:string;message?:string};
    if(!response.ok){setError(result.error||"Sandi gagal diatur ulang.");setSaving(false);return;}
    await onSaved(result.message||"Sandi berhasil diatur ulang.");onClose();
  }
  return <div className="modal-backdrop" onMouseDown={onClose}><form className="record-modal" onSubmit={submit} onMouseDown={event=>event.stopPropagation()}>
    <button type="button" className="modal-close" onClick={onClose}>×</button><span className="modal-eyebrow">RESET SANDI PENGGUNA</span><h2>{row.name}</h2><p>{row.email}. Semua sesi lama pengguna akan dikeluarkan.</p>
    <label>Sandi sementara baru<input required autoFocus minLength={8} type="password" autoComplete="new-password" value={password} onChange={event=>setPassword(event.target.value)} placeholder="Minimal 8 karakter, berisi huruf dan angka"/></label>
    {error&&<div className="form-error">{error}</div>}<div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Batal</button><button className="primary-button" disabled={saving}>{saving?"Menyimpan…":"Reset Sandi"}</button></div>
  </form></div>;
}

function UsersPage({ data, reply, reload, notify }: { data:AppData; reply:(row:Row)=>void; reload:()=>Promise<void>; notify:(message:string)=>void }) {
  const [users,setUsers]=useState<Row[]>([]);
  const [loadingUsers,setLoadingUsers]=useState(true);
  const [editor,setEditor]=useState<Row|null|undefined>(undefined);
  const [resetUser,setResetUser]=useState<Row|null>(null);
  const [auditRows,setAuditRows]=useState<Row[]>(data.audit);
  const [auditCursor,setAuditCursor]=useState(Number(data.audit.at(-1)?.id||0));
  const [auditLoading,setAuditLoading]=useState(false);
  const loadUsers=useCallback(async()=>{
    setLoadingUsers(true);
    const response=await fetch("/api/admin-users",{cache:"no-store"});
    const result=await response.json() as {users?:Row[];error?:string};
    setLoadingUsers(false);
    if(!response.ok){notify(result.error||"Daftar pengguna gagal dimuat.");return;}
    setUsers(result.users||[]);
  },[notify]);
  useEffect(()=>{const timer=window.setTimeout(()=>void loadUsers(),0);return()=>window.clearTimeout(timer);},[loadUsers]);
  useEffect(()=>{const timer=window.setTimeout(()=>{setAuditRows(data.audit);setAuditCursor(Number(data.audit.at(-1)?.id||0));},0);return()=>window.clearTimeout(timer);},[data.audit]);
  async function loadMoreAudit(){if(!auditCursor||auditLoading)return;setAuditLoading(true);const response=await fetch(`/api/audit?before=${auditCursor}&limit=50`,{cache:"no-store"});const result=await response.json() as {records?:Row[];nextCursor?:number;error?:string};setAuditLoading(false);if(!response.ok){notify(result.error||"Audit gagal dimuat.");return;}setAuditRows(current=>[...current,...(result.records||[])]);setAuditCursor(Number(result.nextCursor||0));}
  async function refresh(message:string){notify(message);await Promise.all([loadUsers(),reload()]);}
  async function toggle(row:Row){
    const next=String(row.status)==="Aktif"?"blokir":"aktifkan";
    if(!window.confirm(`Yakin ingin ${next} akun ${row.email}?`))return;
    const response=await fetch("/api/admin-users",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({id:Number(row.id),action:"toggle"})});
    const result=await response.json() as {error?:string;message?:string};
    if(!response.ok){notify(result.error||"Status akun gagal diubah.");return;}
    await refresh(result.message||"Status akun berhasil diubah.");
  }
  async function remove(row:Row){
    if(!window.confirm(`Hapus akun ${row.email} beserta akses loginnya?`))return;
    const response=await fetch("/api/admin-users",{method:"DELETE",headers:{"content-type":"application/json"},body:JSON.stringify({id:Number(row.id)})});
    const result=await response.json() as {error?:string;message?:string};
    if(!response.ok){notify(result.error||"Akun gagal dihapus.");return;}
    await refresh(result.message||"Akun berhasil dihapus.");
  }
  return <><GuardianAccessAdmin data={data} reload={reload} notify={notify}/>
  <section className="dashboard-grid operations-grid"><article className="card data-card"><header className="card-header"><div><h3>Admin & Pengguna Sekolah</h3><p>Akun Firebase, peran, penugasan, dan status login</p></div><button className="primary-button" onClick={()=>setEditor(null)}>+ Buat Akun</button></header><div className="table-wrap"><table><thead><tr><th>Pengguna</th><th>Peran & Penugasan</th><th>Status Login</th><th /></tr></thead><tbody>{users.map(x=><tr key={String(x.id)}><td><strong>{x.name}</strong><small className="cell-note">{x.email}</small></td><td><Status tone={x.role==="Admin"?"violet":x.role==="Ustadz"?"blue":"green"}>{x.role}</Status><small className="cell-note">{x.roomScope||"Akses sesuai peran"}</small></td><td><Status tone={x.status==="Aktif"?"green":x.status==="Diblokir"?"red":"amber"}>{x.status}</Status></td><td><div className="user-access-actions"><button className="text-button" onClick={()=>setEditor(x)}>Ubah</button><button className="text-button" onClick={()=>setResetUser(x)}>Reset sandi</button><button className="text-button" onClick={()=>void toggle(x)}>{x.status==="Aktif"?"Blokir":"Aktifkan"}</button><button className="danger-link" onClick={()=>void remove(x)}>Hapus</button></div></td></tr>)}{!users.length&&<tr><td colSpan={4} className="muted">{loadingUsers?"Memuat pengguna…":"Belum ada akun internal."}</td></tr>}</tbody></table></div></article><article className="card data-card"><header className="card-header"><div><h3>Audit Aktivitas</h3><p>Jejak perubahan dimuat bertahap</p></div></header><div className="audit-list">{auditRows.map(x=><div key={String(x.id)}><MiniIcon tone={x.action==="Hapus"?"red":x.action==="Tambah"?"green":"blue"}>{String(x.action).slice(0,1)}</MiniIcon><div><strong>{x.action} · {x.resource}</strong><p>{x.detail}</p><small>{x.user_email} · {new Date(String(x.created_at)).toLocaleString("id-ID")}</small></div></div>)}</div>{Boolean(auditCursor)&&<button className="secondary-button audit-more" disabled={auditLoading} onClick={()=>void loadMoreAudit()}>{auditLoading?"Memuat…":"Muat Riwayat Berikutnya"}</button>}</article></section>
  <section className="card data-card guardian-inbox"><header className="card-header"><div><h3>Pesan dari Wali Santri</h3><p>Pertanyaan dari Portal Wali yang menunggu tindak lanjut</p></div><Status tone={data.guardianMessages.some(x=>x.status==="Baru")?"amber":"green"}>{data.guardianMessages.filter(x=>x.status==="Baru").length} baru</Status></header><div className="table-wrap"><table><thead><tr><th>Santri</th><th>Subjek & Pesan</th><th>Pengirim</th><th>Status</th><th /></tr></thead><tbody>{data.guardianMessages.map(x=><tr key={String(x.id)}><td><strong>{x.student_name}</strong></td><td><strong>{x.subject}</strong><small className="cell-note">{x.message}{x.reply?` · Balasan: ${x.reply}`:""}</small></td><td className="muted">{x.sender_email}</td><td><Status tone={x.status==="Dibalas"?"green":"amber"}>{x.status}</Status></td><td><button className="text-button" onClick={()=>reply(x)}>{x.status==="Dibalas"?"Balas lagi":"Balas"}</button></td></tr>)}{!data.guardianMessages.length&&<tr><td colSpan={5} className="muted">Belum ada pesan dari wali santri.</td></tr>}</tbody></table></div></section>
  {editor!==undefined&&<UserAccessModal row={editor||undefined} rooms={data.rooms} onClose={()=>setEditor(undefined)} onSaved={refresh}/>}
  {resetUser&&<ResetUserPasswordModal row={resetUser} onClose={()=>setResetUser(null)} onSaved={refresh}/>}</>;
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
  if(!student) return <div className="empty-state guardian-empty"><b>Belum ada santri yang terhubung</b><span>Minta Admin memastikan “Nomor WhatsApp wali” pada Data Santri sama dengan nomor akun Anda: +{data.user?.guardianPhone}</span><a className="secondary-button link-button" href="/wali">Lihat cara menghubungkan akun</a></div>;

  const byStudent=(rows:Row[])=>rows.filter(x=>Number(x.student_id)===Number(student.id));
  const bills=byStudent(data.bills), attendance=byStudent(data.attendance), tahfidz=byStudent(data.tahfidz), tahsin=byStudent(data.tahsin), grades=byStudent(data.grades);
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

  return <div className="guardian-portal" aria-label="Portal Tahfidz & Mutaba’ah">
    {data.students.length>1&&<section className="student-switcher card"><span>Pilih santri</span>{data.students.map(x=><button key={String(x.id)} className={String(x.id)===String(student.id)?"active":""} onClick={()=>setSelectedId(String(x.id))}>{x.name}<small>{x.class_name}</small></button>)}</section>}
    <section className="guardian-hero"><div className="guardian-profile"><div className="large-avatar">{String(student.name).split(" ").map(x=>x[0]).slice(0,2).join("")}</div><div><span>PORTAL WALI SANTRI · DATA TERLINDUNGI</span><h2>Assalamu’alaikum, keluarga {String(student.name).split(" ")[0]}.</h2><p>{student.name} · {student.nis} · {student.class_name} · {student.room}</p><div className="guardian-live-status"><b>● Santri aktif</b><small>Data diperbarui langsung oleh pengurus</small></div></div></div><div className="guardian-quick-actions"><button className="accent" onClick={()=>setTopupOpen(true)}><i>Rp</i><span>Top Up Saldo<small>Saldo santri</small></span></button><button onClick={()=>onCard(student)}><i>▦</i><span>Kartu QR<small>Identitas digital</small></span></button><button onClick={()=>setAction("permit")}><i>✓</i><span>Ajukan Izin<small>Perizinan online</small></span></button><button onClick={()=>setRequestOpen(true)}><i>⌁</i><span>Kunjungan<small>Jemput & kunjung</small></span></button><button onClick={()=>setAction("contact")}><i>✦</i><span>Pesan<small>Hubungi pengurus</small></span></button></div></section>
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
      <article className="card portal-card"><header className="card-header"><div><h3>Tahfidz, Tahsin & Mutaba’ah</h3><p>Perkembangan Al-Qur’an dan ibadah</p></div></header><div className="portal-list">{tahfidz.slice(0,3).map(x=><div key={`t-${x.id}`}><div><strong>{tahfidzRange(x)}</strong><small>{x.amount} ayat · {x.teacher} · {x.recorded_at}</small></div><Status tone="green">{x.grade}</Status></div>)}{tahsin.slice(0,2).map(x=><div key={`ts-${x.id}`}><div><strong>Tahsin · {x.level}</strong><small>Makhraj {x.makhraj_score} · Tajwid {x.tajwid_score} · Kelancaran {x.fluency_score}</small></div><Status tone="blue">{Math.round((Number(x.makhraj_score)+Number(x.tajwid_score)+Number(x.fluency_score)+Number(x.length_score)+Number(x.adab_score))/5)}</Status></div>)}{mutabaah.slice(0,2).map(x=><div key={`m-${x.id}`}><div><strong>{x.activity}</strong><small>{x.record_date}</small></div><Status tone={Number(x.completed)?"green":"amber"}>{Number(x.completed)?"Selesai":"Belum"}</Status></div>)}{!tahfidz.length&&!tahsin.length&&!mutabaah.length&&<div className="portal-empty">Belum ada catatan perkembangan.</div>}</div></article>
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
  const [status,setStatus]=useState<{midtrans?:boolean;xendit?:boolean;whatsapp?:boolean;bank?:boolean;storage?:boolean;databaseMode?:string;lastBackup?:string;failedNotifications?:number;pendingTopups?:number;pendingAdmissions?:number}>({});
  const [uploading,setUploading]=useState(false);
  const [reminding,setReminding]=useState(false);
  const [backingUp,setBackingUp]=useState(false);
  const [periods,setPeriods]=useState<Array<{period_key:string;status:string;pending_records:number}>>([]);
  const [periodYear,setPeriodYear]=useState("2026/2027");
  const [periodSemester,setPeriodSemester]=useState("Ganjil");
  const [periodWorking,setPeriodWorking]=useState(false);
  const loadStatus=useCallback(async()=>{try{const response=await fetch("/api/integrations",{cache:"no-store"});setStatus(await response.json() as typeof status);}catch{setStatus({});}},[]);
  const loadPeriods=useCallback(async()=>{try{const response=await fetch("/api/academic-periods",{cache:"no-store"});const result=await response.json() as {periods?:typeof periods};if(response.ok)setPeriods(result.periods??[]);}catch{setPeriods([]);}},[]);
  useEffect(()=>{const timer=window.setTimeout(()=>{void loadStatus();void loadPeriods();},0);return()=>window.clearTimeout(timer);},[loadStatus,loadPeriods]);
  async function upload(file:File) { setUploading(true); const form=new FormData(); form.append("file",file); const response=await fetch("/api/import",{method:"POST",body:form}); const result=await response.json() as {error?:string;imported?:number}; setUploading(false); if(!response.ok){notify(result.error||"Impor gagal.");return;} notify(`${result.imported} santri berhasil diimpor.`); await onImported(); }
  async function runReminders(){setReminding(true);const response=await fetch("/api/reminders",{method:"POST"});const result=await response.json() as {error?:string;sent?:number;processed?:number};setReminding(false);if(!response.ok){notify(result.error||"Pengingat gagal dijalankan.");return;}notify(`${result.sent} pengingat dikirim dari ${result.processed} tagihan terjadwal.`);await onImported();}
  async function createServerBackup(){setBackingUp(true);const response=await fetch("/api/backup",{method:"POST"});const result=await response.json() as {error?:string;message?:string};setBackingUp(false);if(!response.ok){notify(result.error||"Backup server gagal dibuat.");return;}notify(result.message||"Backup server berhasil dibuat.");await loadStatus();}
  async function updatePeriod(nextStatus:"Terbuka"|"Dikunci") {setPeriodWorking(true);let force=false;for(;;){const response=await fetch("/api/academic-periods",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({academicYear:periodYear,semester:periodSemester,status:nextStatus,force})});const result=await response.json() as {error?:string;message?:string;pendingRecords?:number};if(response.status===409&&!force&&window.confirm(`${result.error}\n\nTetap kunci periode?`)){force=true;continue;}setPeriodWorking(false);if(!response.ok){notify(result.error||"Periode gagal diperbarui.");return;}notify(result.message||"Periode berhasil diperbarui.");await loadPeriods();return;}}
  return <><section className="integration-grid">{[["Midtrans / QRIS","Pembayaran, webhook, rekonsiliasi, dan kuitansi",status.midtrans],["Xendit / QRIS","Alternatif kanal pembayaran dan webhook",status.xendit],["WhatsApp Cloud API","Notifikasi otomatis saat data berubah",status.whatsapp],["Rekening Pesantren","Transfer bank untuk top-up wali",status.bank],["Penyimpanan Dokumen","Dokumen PPDB, logo, dan backup",status.storage]].map((x,i)=><article className="card integration-card" key={String(x[0])}><MiniIcon tone={["blue","violet","green","amber","blue"][i]}>{i===2?"WA":i===3?"Rp":i===4?"☁":"↗"}</MiniIcon><div><h3>{x[0]}</h3><p>{x[1]}</p></div><Status tone={x[2]?"green":"amber"}>{x[2]?"Terhubung":"Perlu konfigurasi"}</Status></article>)}</section><section className="stats-grid four"><article className="metric-card"><MiniIcon tone="green">DB</MiniIcon><div><span>Database Produksi</span><strong className="compact-value">{status.databaseMode||"Memeriksa…"}</strong><small>Data operasional terkelola</small></div></article><article className="metric-card"><MiniIcon tone={status.failedNotifications?"red":"green"}>WA</MiniIcon><div><span>Notifikasi Gagal</span><strong>{status.failedNotifications??0}</strong><small>Perlu dikirim ulang</small></div></article><article className="metric-card"><MiniIcon tone="amber">Rp</MiniIcon><div><span>Top-up Menunggu</span><strong>{status.pendingTopups??0}</strong><small>Pembayaran/verifikasi</small></div></article><article className="metric-card"><MiniIcon tone="violet">PP</MiniIcon><div><span>PPDB Diproses</span><strong>{status.pendingAdmissions??0}</strong><small>Dokumen dan verifikasi</small></div></article></section><section className="card period-control"><header className="card-header"><div><h3>Periode Akademik & Publikasi</h3><p>Kunci semester setelah seluruh catatan diverifikasi agar rapor lama tidak berubah.</p></div></header><div className="period-control-form"><label>Tahun ajaran<input value={periodYear} pattern="[0-9]{4}/[0-9]{4}" onChange={event=>setPeriodYear(event.target.value)}/></label><label>Semester<select value={periodSemester} onChange={event=>setPeriodSemester(event.target.value)}><option>Ganjil</option><option>Genap</option></select></label><button className="secondary-button" disabled={periodWorking} onClick={()=>void updatePeriod("Terbuka")}>Buka Periode</button><button className="primary-button" disabled={periodWorking} onClick={()=>void updatePeriod("Dikunci")}>Kunci Periode</button></div><div className="portal-list">{periods.map(period=><div key={period.period_key}><div><strong>{period.period_key}</strong><small>{period.pending_records} catatan belum dipublikasikan</small></div><Status tone={period.status==="Dikunci"?"amber":"green"}>{period.status}</Status></div>)}{!periods.length&&<div className="portal-empty">Belum ada periode yang dikelola.</div>}</div></section><section className="card automation-rules"><header className="card-header"><div><h3>Notifikasi WhatsApp Otomatis</h3><p>Wali menerima pembaruan tanpa input pesan manual ketika data berikut berubah.</p></div><Status tone={status.whatsapp?"green":"amber"}>{status.whatsapp?"Aktif":"Mode tautan WhatsApp"}</Status></header><div>{[["Absensi","Sakit, izin, terlambat, atau alpa"],["Tahfidz","Rentang surat, ayat, jumlah, dan nilai setoran"],["Akademik","Nilai akhir dan predikat rapor"],["Karakter","Kategori dan nilai karakter"],["Kesehatan","Keluhan serta status tindak lanjut"],["Pembinaan","Pelanggaran atau prestasi"],["Keuangan","Tagihan baru dan pengingat jatuh tempo"]].map(item=><article key={item[0]}><span>WA</span><div><strong>{item[0]}</strong><small>{item[1]}</small></div><b>Otomatis</b></article>)}</div></section><section className="dashboard-grid operations-grid"><article className="card utility-card reminder-utility"><div><MiniIcon tone="green">WA</MiniIcon><h3>Pengingat Tagihan Otomatis</h3><p>Mengirim pengingat tagihan yang jatuh tempo dalam tujuh hari. Sistem mencegah pengiriman ganda pada hari yang sama.</p><button className="primary-button" disabled={reminding} onClick={()=>void runReminders()}>{reminding?"Mengirim…":"Jalankan Pengingat"}</button></div></article><article className="card utility-card"><div><MiniIcon tone="blue">⇧</MiniIcon><h3>Impor Excel/CSV</h3><p>Kolom: nama, nis, kelas, kamar, nama_wali, whatsapp, email_wali. Maksimal 500 baris.</p><label className="upload-button">{uploading?"Mengimpor...":"Pilih Berkas"}<input type="file" accept=".xlsx,.xls,.csv" disabled={uploading} onChange={e=>e.target.files?.[0]&&void upload(e.target.files[0])} /></label></div></article></section><section className="dashboard-grid operations-grid"><article className="card data-card"><header className="card-header"><div><h3>Riwayat Notifikasi</h3><p>Status pengiriman WhatsApp terbaru</p></div></header><div className="portal-list">{data.notifications.slice(0,8).map(x=><div key={String(x.id)}><div><strong>{x.recipient}</strong><small>{x.message}</small></div><Status tone={x.status==="Terkirim"?"green":x.status==="Gagal"?"red":"amber"}>{x.status}</Status></div>)}</div></article><article className="card utility-card"><div><MiniIcon tone="green">⇩</MiniIcon><h3>Backup & Pemulihan</h3><p>Backup terakhir: {status.lastBackup?new Date(status.lastBackup).toLocaleString("id-ID"):"belum ada backup server"}.</p><div className="header-actions"><button className="primary-button" disabled={backingUp} onClick={()=>void createServerBackup()}>{backingUp?"Menyimpan…":"Backup ke Server"}</button><a className="secondary-button link-button" href="/api/backup">Unduh JSON</a></div></div></article></section></>;
}

function StudentCardModal({ student, onClose }: { student:Row; onClose:()=>void }) {
  const [qr,setQr]=useState(""); useEffect(()=>{void (async()=>{const response=await fetch(`/api/student-card?id=${student.id}`);const result=await response.json() as {qr?:string};setQr(result.qr||"");})();},[student.id]);
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="student-card-modal" onMouseDown={e=>e.stopPropagation()}><button className="modal-close no-print" onClick={onClose}>×</button><div className="student-id-card"><header><BrandMark className="brand-mark"/><div><strong>SINURMAN</strong><small>Pondok Pesantren Nurul Iman</small></div></header><div className="student-card-body"><div><span className="student-photo">{String(student.name).split(" ").map(x=>x[0]).slice(0,2).join("")}</span><h3>{student.name}</h3><p>{student.nis}</p><dl><dt>Kelas</dt><dd>{student.class_name}</dd><dt>Kamar</dt><dd>{student.room}</dd><dt>Status</dt><dd>{student.status}</dd></dl></div>{qr?<img src={qr} alt={`QR ${student.name}`} />:<span className="qr-loading">Memuat QR…</span>}</div><footer>Kartu Santri Digital · Tahun Ajaran 2026/2027</footer></div><button className="primary-button print-card no-print" onClick={()=>window.print()}>Cetak Kartu</button></div></div>;
}

function ReportsPage({ role }: { role:Role }) {
  const today=new Date().toISOString().slice(0,10);
  const [from,setFrom]=useState(`${today.slice(0,4)}-01-01`);
  const [to,setTo]=useState(today);
  const allReports=[
    {key:"students",title:"Laporan Data Santri",copy:"Profil, kelas, kamar, wali, dan status",tone:"blue",admin:false},
    {key:"tahfidz",title:"Rekap Setoran Tahfidz",copy:"Hafalan dan penilaian per santri",tone:"green",admin:false},
    {key:"tahsin",title:"Rekap Penilaian Tahsin",copy:"Level dan lima kompetensi bacaan Al-Qur’an",tone:"blue",admin:false},
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
    { key:"name",label:"Nama lengkap" },{ key:"nis",label:"NIS" },{ key:"class_name",label:"Kelas",type:"class" },
    { key:"room",label:"Kamar" },{ key:"guardian_name",label:"Nama wali" },{ key:"guardian_phone",label:"Nomor WhatsApp wali",type:"tel" },
    { key:"guardian_email",label:"Email wali (opsional)",type:"email" },
    { key:"status",label:"Status",options:["Aktif","Izin","Alumni","Nonaktif"] },
  ],
  employees: [
    {key:"employee_no",label:"NIP / Nomor pegawai"},{key:"name",label:"Nama lengkap"},{key:"gender",label:"Jenis kelamin",options:["Laki-laki","Perempuan"]},
    {key:"birth_place",label:"Tempat lahir"},{key:"birth_date",label:"Tanggal lahir",type:"date"},{key:"phone",label:"Nomor HP / WhatsApp",type:"tel"},
    {key:"email",label:"Email",type:"email"},{key:"position",label:"Jabatan"},{key:"work_unit",label:"Unit kerja",options:["Pimpinan","Pendidikan","Tahfidz","Asrama","Administrasi","Keuangan","Kesehatan","Kantin","Keamanan","Umum"]},
    {key:"employment_type",label:"Jenis kepegawaian",options:["Tetap","Kontrak","Honorer","Magang"]},{key:"education",label:"Pendidikan terakhir"},{key:"join_date",label:"Tanggal mulai bekerja",type:"date"},
    {key:"address",label:"Alamat",type:"textarea"},{key:"status",label:"Status",options:["Aktif","Cuti","Nonaktif"]},
  ],
  classes: [
    {key:"name",label:"Nama kelas (contoh: VII A)"},{key:"education_level",label:"Jenjang",options:["SMP","SMK"]},{key:"grade_order",label:"Tingkat angka",type:"number"},
    {key:"major",label:"Jurusan (opsional)"},{key:"homeroom_teacher",label:"Wali kelas"},{key:"capacity",label:"Kapasitas",type:"number"},
    {key:"next_class_name",label:"Kelas berikutnya (opsional)",type:"class-optional"},{key:"academic_year",label:"Tahun ajaran"},{key:"status",label:"Status",options:["Aktif","Nonaktif"]},
  ],
  tahfidz: [
    { key:"student_id",label:"Santri",type:"student" },
    { key:"surah_from",label:"Surat awal",options:QURAN_SURAHS.map(item=>item.name) },{ key:"verse_from",label:"Ayat awal",type:"number" },
    { key:"surah_to",label:"Surat akhir",options:QURAN_SURAHS.map(item=>item.name) },{ key:"verse_to",label:"Ayat akhir",type:"number" },
    { key:"amount",label:"Jumlah ayat disetor",type:"number" },{ key:"grade",label:"Penilaian",options:["Mumtaz","Jayyid Jiddan","Jayyid","Mengulang"] },{key:"workflow_status",label:"Status publikasi",options:["Draft","Diverifikasi","Dipublikasikan"]},
  ],
  tahsin: [
    {key:"student_id",label:"Santri",type:"student"},{key:"level",label:"Level Tahsin",options:["Pra Tahsin","Level 1","Level 2","Level 3","Lulus"]},
    {key:"makhraj_score",label:"Makharijul Huruf",type:"number"},{key:"tajwid_score",label:"Tajwid",type:"number"},{key:"fluency_score",label:"Kelancaran",type:"number"},
    {key:"length_score",label:"Panjang Pendek",type:"number"},{key:"adab_score",label:"Adab Membaca",type:"number"},{key:"note",label:"Catatan Ustadz",type:"textarea"},{key:"workflow_status",label:"Status publikasi",options:["Draft","Diverifikasi","Dipublikasikan"]},
  ],
  subjects: [
    {key:"code",label:"Kode mata pelajaran"},{key:"name",label:"Nama mata pelajaran"},{key:"education_level",label:"Jenjang",options:["SMP","SMK"]},{key:"class_name",label:"Kelas",type:"class"},{key:"teacher",label:"Guru/Ustadz"},{key:"semester",label:"Semester",options:["Ganjil","Genap"]},{key:"academic_year",label:"Tahun ajaran"},{key:"minimum_score",label:"KKM",type:"number"},
  ],
  grades: [
    {key:"student_id",label:"Santri",type:"student"},{key:"subject_id",label:"Mata pelajaran",type:"subject"},{key:"assignment_score",label:"Nilai tugas",type:"number"},{key:"midterm_score",label:"Nilai PTS",type:"number"},{key:"exam_score",label:"Nilai PAS",type:"number"},{key:"semester",label:"Semester",options:["Ganjil","Genap"]},{key:"academic_year",label:"Tahun ajaran"},{key:"note",label:"Catatan rapor",type:"textarea"},{key:"workflow_status",label:"Status publikasi",options:["Draft","Diverifikasi","Dipublikasikan"]},
  ],
  mutabaah: [
    {key:"student_id",label:"Santri",type:"student"},{key:"activity",label:"Kegiatan/ibadah"},{key:"completed",label:"Status",options:["1","0"]},{key:"record_date",label:"Tanggal",type:"date"},{key:"workflow_status",label:"Status publikasi",options:["Draft","Diverifikasi","Dipublikasikan"]},
  ],
  health: [
    { key:"student_id",label:"Santri",type:"student" },{ key:"complaint",label:"Keluhan" },{ key:"diagnosis",label:"Diagnosis" },
    { key:"treatment",label:"Penanganan" },{ key:"status",label:"Status",options:["Dipantau","Membaik","Dirujuk","Selesai"] },{key:"workflow_status",label:"Status publikasi",options:["Draft","Diverifikasi","Dipublikasikan"]},
  ],
  transactions: [
    { key:"student_id",label:"Santri",type:"student" },{ key:"type",label:"Jenis",options:["Masuk","Keluar"] },
    { key:"category",label:"Kategori",options:["SPP","Uang Saku","Koperasi","Kantin","Laundry","Lainnya"] },
    { key:"amount",label:"Nominal",type:"number" },{ key:"status",label:"Status",options:["Berhasil","Lunas","Tertunda"] },{ key:"note",label:"Catatan" },
  ],
  characters: [
    { key:"student_id",label:"Santri",type:"student" },{ key:"category",label:"Kategori",options:["Adab & Akhlak","Kedisiplinan","Kemandirian","Tanggung Jawab","Kebersihan"] },
    { key:"score",label:"Nilai",type:"number" },{ key:"note",label:"Catatan pembina" },{key:"workflow_status",label:"Status publikasi",options:["Draft","Diverifikasi","Dipublikasikan"]},
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
    {key:"student_id",label:"Santri",type:"student"},{key:"record_date",label:"Tanggal",type:"date"},{key:"status",label:"Status",options:["Hadir","Terlambat","Sakit","Izin","Alpa"]},{key:"note",label:"Catatan"},{key:"workflow_status",label:"Status publikasi",options:["Draft","Diverifikasi","Dipublikasikan"]},
  ],
  permits: [
    {key:"student_id",label:"Santri",type:"student"},{key:"start_date",label:"Tanggal mulai",type:"date"},{key:"end_date",label:"Tanggal selesai",type:"date"},{key:"reason",label:"Alasan",type:"textarea"},{key:"status",label:"Status",options:["Diajukan","Disetujui","Ditolak","Selesai"]},
  ],
  schedules: [
    {key:"education_level",label:"Jenjang",options:["SMP","SMK"]},{key:"class_name",label:"Kelas",type:"class"},{key:"title",label:"Mata pelajaran/kegiatan"},{key:"category",label:"Kategori",options:["Pelajaran Umum","Produktif","Tahfidz","Ibadah","Kegiatan"]},{key:"teacher",label:"Ustadz/Guru"},{key:"location",label:"Ruang"},{key:"day_name",label:"Hari",options:["Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"]},{key:"start_time",label:"Mulai",type:"time"},{key:"end_time",label:"Selesai",type:"time"},
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
  students:"santri",employees:"pegawai",classes:"kelas",tahfidz:"setoran tahfidz",tahsin:"penilaian tahsin",mutabaah:"kegiatan mutaba’ah",health:"pemeriksaan",transactions:"transaksi",
  characters:"nilai karakter",inventory:"barang",announcements:"pengumuman",
  attendance:"absensi",permits:"izin",schedules:"jadwal",rooms:"kamar",admissions:"pendaftar",
  counseling:"catatan konseling",bills:"tagihan",users:"pengguna",
  subjects:"mata pelajaran",grades:"nilai akademik",
};

function RecordModal({ editor, students, subjects, classes, onClose, onSave }: { editor: NonNullable<EditorState>; students: Row[]; subjects:Row[]; classes:Row[]; onClose: () => void; onSave: (resource: Resource, row: Row | undefined, data: Record<string, unknown>) => Promise<void> }) {
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
      for (const [key,value] of Object.entries(form)) data[key] = ["amount","quantity","score","student_id","subject_id","points","capacity","grade_order","completed","verse_from","verse_to","minimum_score","assignment_score","midterm_score","exam_score","makhraj_score","tajwid_score","fluency_score","length_score","adab_score"].includes(key) ? Number(value) : value;
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
      :field.type==="class"||field.type==="class-optional"?<select required={field.type==="class"} value={form[field.key]} onChange={e=>updateFormField(field.key,e.target.value)}><option value="">{field.type==="class"?"Pilih kelas":"Otomatis berdasarkan tingkat"}</option>{classes.filter(row=>row.status==="Aktif"&&row.name!==editor.row?.name).map(row=><option key={String(row.id)} value={String(row.name)}>{row.name} · {row.education_level}</option>)}</select>
      :field.options?<select required value={form[field.key]} onChange={e=>updateFormField(field.key,e.target.value)}><option value="">Pilih</option>{field.options.map(o=><option key={o}>{o}</option>)}</select>
      :field.type==="textarea"?<textarea required={!["note","address"].includes(field.key)} value={form[field.key]} onChange={e=>updateFormField(field.key,e.target.value)} />
      :<input required={!["status","note","room_scope","guardian_email","birth_place","birth_date","phone","email","education","major","homeroom_teacher"].includes(field.key)} readOnly={editor.resource==="tahfidz"&&field.key==="amount"} min={["score","makhraj_score","tajwid_score","fluency_score","length_score","adab_score"].includes(field.key)?0:["verse_from","verse_to","amount","grade_order","capacity"].includes(field.key)?1:undefined} max={["score","minimum_score","assignment_score","midterm_score","exam_score","makhraj_score","tajwid_score","fluency_score","length_score","adab_score"].includes(field.key)?100:undefined} type={field.type||"text"} value={form[field.key]} onChange={e=>updateFormField(field.key,e.target.value)} />}
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
      {title:"Data anak",copy:"Pastikan nomor HP wali sama dengan nomor WhatsApp yang tersimpan pada Data Santri.",page:"portalwali",label:"Periksa data anak"},
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

function AccountModal({ user, role, onClose, onLogout }: { user:AppData["user"]; role:Role; onClose:()=>void; onLogout:()=>void }) {
  const closeButtonRef=useRef<HTMLButtonElement>(null);
  const [currentPassword,setCurrentPassword]=useState("");
  const [newPassword,setNewPassword]=useState("");
  const [confirmation,setConfirmation]=useState("");
  const [savingPassword,setSavingPassword]=useState(false);
  const [passwordError,setPasswordError]=useState("");
  const [passwordMessage,setPasswordMessage]=useState("");
  const [mfaPassword,setMfaPassword]=useState("");
  const [mfaCode,setMfaCode]=useState("");
  const [mfaSecret,setMfaSecret]=useState<TotpSecret|null>(null);
  const [mfaWorking,setMfaWorking]=useState(false);
  const [security,setSecurity]=useState<{sessions:Array<{id:string;current:boolean;createdAt:string;lastSeenAt:string;userAgent:string;ipHash:string}>;mfa:{available:boolean;enrolled:boolean;required:boolean}}|null>(null);
  const loadSecurity=useCallback(async()=>{if(user?.authProvider!=="firebase")return;try{const response=await fetch("/api/account-security",{cache:"no-store"});const result=await response.json() as typeof security&{error?:string};if(response.ok&&result)setSecurity(result);}catch{/* profile remains available */}},[user?.authProvider]);
  useEffect(()=>{
    closeButtonRef.current?.focus();
    const closeOnEscape=(event:KeyboardEvent)=>{if(event.key==="Escape") onClose();};
    const timer=window.setTimeout(()=>void loadSecurity(),0);
    window.addEventListener("keydown",closeOnEscape);
    return()=>{window.clearTimeout(timer);window.removeEventListener("keydown",closeOnEscape);};
  },[onClose,loadSecurity]);
  async function revokeSession(sessionId:string,current:boolean) {
    if(!window.confirm(current?"Keluar dari perangkat ini sekarang?":"Cabut akses perangkat ini?"))return;
    const response=await fetch("/api/account-security",{method:"DELETE",headers:{"content-type":"application/json"},body:JSON.stringify({sessionId})});
    if(!response.ok)return;
    if(current){onLogout();return;}
    await loadSecurity();
  }
  async function startMfaEnrollment() {
    if(!user?.email||!mfaPassword){setPasswordError("Masukkan sandi saat ini untuk mengaktifkan MFA.");return;}
    setMfaWorking(true);setPasswordError("");setPasswordMessage("");
    try {
      const auth=firebaseClient().auth;
      let firebaseUser=auth.currentUser;
      if(!firebaseUser||firebaseUser.email?.toLowerCase()!==user.email.toLowerCase()) firebaseUser=(await signInWithEmailAndPassword(auth,user.email,mfaPassword)).user;
      else await reauthenticateWithCredential(firebaseUser,EmailAuthProvider.credential(user.email,mfaPassword));
      const session=await multiFactor(firebaseUser).getSession();
      setMfaSecret(await TotpMultiFactorGenerator.generateSecret(session));
    } catch(error){setPasswordError(error instanceof Error?error.message:"MFA gagal disiapkan.");}
    finally{setMfaWorking(false);}
  }
  async function finishMfaEnrollment() {
    const firebaseUser=firebaseClient().auth.currentUser;
    if(!firebaseUser||!mfaSecret||!/^\d{6}$/.test(mfaCode)){setPasswordError("Masukkan kode Authenticator 6 angka yang valid.");return;}
    setMfaWorking(true);setPasswordError("");
    try {
      await multiFactor(firebaseUser).enroll(TotpMultiFactorGenerator.assertionForEnrollment(mfaSecret,mfaCode),"SINURMAN Authenticator");
      setMfaSecret(null);setMfaPassword("");setMfaCode("");setPasswordMessage("MFA Authenticator aktif dan akan diminta pada login berikutnya.");await loadSecurity();
    } catch(error){setPasswordError(error instanceof Error?error.message:"Kode Authenticator tidak sesuai.");}
    finally{setMfaWorking(false);}
  }
  async function changePassword(event:React.FormEvent) {
    event.preventDefault();setPasswordError("");setPasswordMessage("");
    if(newPassword.length<8){setPasswordError("Sandi baru minimal 8 karakter.");return;}
    if(!/[A-Za-z]/.test(newPassword)||!/\d/.test(newPassword)){setPasswordError("Sandi baru harus memuat huruf dan angka.");return;}
    if(newPassword!==confirmation){setPasswordError("Konfirmasi sandi baru belum sama.");return;}
    if(!user?.email){setPasswordError("Email akun tidak tersedia.");return;}
    setSavingPassword(true);
    try {
      const auth=firebaseClient().auth;
      let firebaseUser=auth.currentUser;
      if(!firebaseUser||firebaseUser.email?.toLowerCase()!==user.email.toLowerCase()) {
        firebaseUser=(await signInWithEmailAndPassword(auth,user.email,currentPassword)).user;
      } else {
        await reauthenticateWithCredential(firebaseUser,EmailAuthProvider.credential(user.email,currentPassword));
      }
      await updatePassword(firebaseUser,newPassword);
      const idToken=await firebaseUser.getIdToken(true);
      const response=await fetch("/api/firebase-auth",{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify({idToken})});
      const result=await response.json() as {error?:string;message?:string};
      if(!response.ok) throw new Error(result.error||"Sesi baru gagal dibuat.");
      setCurrentPassword("");setNewPassword("");setConfirmation("");
      setPasswordMessage(result.message||"Kata sandi berhasil diubah.");
    } catch(error) {
      const raw=error instanceof Error?error.message:"Kata sandi gagal diubah.";
      setPasswordError(raw.includes("invalid-credential")?"Sandi saat ini tidak sesuai.":raw);
    } finally {setSavingPassword(false);}
  }
  const initials=(user?.name||"Pengguna").split(" ").map(value=>value[0]).slice(0,2).join("").toUpperCase();
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="record-modal account-modal" role="dialog" aria-modal="true" aria-labelledby="account-modal-title" onMouseDown={event=>event.stopPropagation()}>
    <button ref={closeButtonRef} type="button" className="modal-close" aria-label="Tutup profil akun" onClick={onClose}>×</button>
    <span className="modal-eyebrow">AKUN SINURMAN</span><h2 id="account-modal-title">Profil pengguna</h2><p>{user?.guardianPhone?"Identitas wali terhubung dengan nomor HP pada Data Santri.":"Identitas ini berasal dari akun internal yang sedang masuk."}</p>
    <div className="account-summary"><span>{initials}</span><div><strong>{user?.name||"Pengguna SINURMAN"}</strong><small>{user?.guardianPhone?`+${user.guardianPhone}`:user?.email||"Identitas belum tersedia"}</small></div></div>
    <dl className="account-details"><div><dt>Peran</dt><dd>{role}</dd></div><div><dt>Penugasan kamar</dt><dd>{user?.roomScope||"Tidak dibatasi"}</dd></div><div><dt>Status akun</dt><dd><Status tone="green">Aktif</Status></dd></div></dl>
    {role!=="Wali Santri"&&user?.authProvider==="firebase"&&<form className="change-password-form" onSubmit={changePassword}><div><strong>Ubah kata sandi</strong><small>Masukkan sandi saat ini untuk melindungi akun Anda.</small></div>
      <label>Sandi saat ini<input required type="password" autoComplete="current-password" value={currentPassword} onChange={event=>setCurrentPassword(event.target.value)}/></label>
      <div className="password-pair"><label>Sandi baru<input required minLength={8} type="password" autoComplete="new-password" value={newPassword} onChange={event=>setNewPassword(event.target.value)}/></label><label>Ulangi sandi baru<input required minLength={8} type="password" autoComplete="new-password" value={confirmation} onChange={event=>setConfirmation(event.target.value)}/></label></div>
      {passwordError&&<div className="form-error">{passwordError}</div>}{passwordMessage&&<div className="form-success">{passwordMessage}</div>}
      <button type="submit" className="secondary-button" disabled={savingPassword}>{savingPassword?"Mengubah…":"Ubah Kata Sandi"}</button>
    </form>}
    {user?.authProvider==="firebase"&&security&&<section className="account-security"><header><div><strong>Keamanan perangkat</strong><small>Sesi aktif dapat dicabut kapan saja.</small></div><Status tone={security.mfa.enrolled?"green":"amber"}>{security.mfa.enrolled?"MFA aktif":"MFA wajib disiapkan"}</Status></header>{!security.mfa.enrolled&&<div className="mfa-enrollment"><strong>Aktifkan Authenticator</strong><p>Admin tetap dapat melihat dashboard, tetapi perubahan data dikunci sampai MFA aktif.</p>{!mfaSecret?<><label>Sandi saat ini<input type="password" autoComplete="current-password" value={mfaPassword} onChange={event=>setMfaPassword(event.target.value)}/></label><button type="button" className="secondary-button" disabled={mfaWorking} onClick={()=>void startMfaEnrollment()}>{mfaWorking?"Menyiapkan…":"Buat Kunci MFA"}</button></>:<><p>Tambahkan kunci berikut ke Google/Microsoft Authenticator:</p><code>{mfaSecret.secretKey}</code><label>Kode 6 angka<input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={mfaCode} onChange={event=>setMfaCode(event.target.value.replace(/\D/g,"").slice(0,6))}/></label><button type="button" className="primary-button" disabled={mfaWorking} onClick={()=>void finishMfaEnrollment()}>{mfaWorking?"Memverifikasi…":"Aktifkan MFA"}</button></>}</div>}<div>{security.sessions.map(session=><article key={session.id}><div><strong>{session.current?"Perangkat ini":"Perangkat lain"}</strong><small>{session.userAgent}<br/>Terakhir aktif {session.lastSeenAt?new Date(session.lastSeenAt).toLocaleString("id-ID"):"-"}{session.ipHash?` · ID jaringan ${session.ipHash}`:""}</small></div><button type="button" className={session.current?"text-button":"danger-link"} onClick={()=>void revokeSession(session.id,session.current)}>{session.current?"Keluar":"Cabut"}</button></article>)}</div><p>Semua Admin wajib menggunakan Authenticator dan menyelesaikan verifikasi dua langkah pada setiap login baru.</p></section>}
    <div className="modal-actions"><button type="button" className="secondary-button" onClick={onLogout}>Keluar dari akun</button><button type="button" className="primary-button" onClick={onClose}>Selesai</button></div>
  </div></div>;
}

function SettingsModal({ dark, role, onDarkChange, onHelp, notify, onClose }: { dark:boolean; role:Role; onDarkChange:(value:boolean)=>void; onHelp:()=>void; notify:(message:string)=>void; onClose:()=>void }) {
  const closeButtonRef=useRef<HTMLButtonElement>(null);
  const [logo,setLogo]=useState<File|null>(null);
  const [savingLogo,setSavingLogo]=useState(false);
  const [logoError,setLogoError]=useState("");
  useEffect(()=>{
    closeButtonRef.current?.focus();
    const closeOnEscape=(event:KeyboardEvent)=>{if(event.key==="Escape") onClose();};
    window.addEventListener("keydown",closeOnEscape);
    return()=>window.removeEventListener("keydown",closeOnEscape);
  },[onClose]);
  async function uploadLogo() {
    if(!logo){setLogoError("Pilih berkas logo terlebih dahulu.");return;}
    setSavingLogo(true);setLogoError("");
    const body=new FormData();body.set("logo",logo);
    const response=await fetch("/api/branding/logo",{method:"POST",body});
    const result=await response.json() as {error?:string;message?:string};
    setSavingLogo(false);
    if(!response.ok){setLogoError(result.error||"Logo gagal diperbarui.");return;}
    setLogo(null);notify(result.message||"Logo sekolah berhasil diperbarui.");
    window.dispatchEvent(new Event("sinurman-logo-updated"));
  }
  async function resetLogo() {
    setSavingLogo(true);setLogoError("");
    const response=await fetch("/api/branding/logo",{method:"DELETE"});
    const result=await response.json() as {error?:string;message?:string};
    setSavingLogo(false);
    if(!response.ok){setLogoError(result.error||"Logo gagal dikembalikan.");return;}
    notify(result.message||"Logo bawaan digunakan kembali.");
    window.dispatchEvent(new Event("sinurman-logo-updated"));
  }
  async function installApp() {
    const prompt=window.sinurmanInstallPrompt;
    if(!prompt){notify("Gunakan menu browser lalu pilih ‘Tambahkan ke layar utama’ untuk memasang SINURMAN.");return;}
    await prompt.prompt();
    const choice=await prompt.userChoice;
    if(choice.outcome==="accepted") notify("SINURMAN berhasil dipasang di perangkat ini.");
    window.sinurmanInstallPrompt=undefined;
  }
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="record-modal settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-modal-title" onMouseDown={event=>event.stopPropagation()}>
    <button ref={closeButtonRef} type="button" className="modal-close" aria-label="Tutup pengaturan" onClick={onClose}>×</button>
    <span className="modal-eyebrow">PENGATURAN TAMPILAN</span><h2 id="settings-modal-title">Sesuaikan dashboard</h2><p>Pilihan tampilan disimpan pada perangkat ini.</p>
    <div className="theme-options"><button type="button" className={!dark?"active":""} aria-pressed={!dark} onClick={()=>onDarkChange(false)}><span>☀</span><strong>Terang</strong><small>Nyaman untuk penggunaan siang hari</small></button><button type="button" className={dark?"active":""} aria-pressed={dark} onClick={()=>onDarkChange(true)}><span>☾</span><strong>Gelap</strong><small>Mengurangi silau pada malam hari</small></button></div>
    <div className="settings-help"><div><strong>Pasang aplikasi SINURMAN</strong><small>Akses seperti aplikasi HP dengan ikon pada layar utama.</small></div><button type="button" onClick={()=>void installApp()}>Pasang Aplikasi</button></div>
    {role==="Admin"&&<section className="branding-settings"><div className="branding-settings-head"><BrandMark className="brand-mark"/><div><strong>Logo sekolah</strong><small>Tampil di dashboard, login, Portal Wali, PPDB, kartu, dan laporan cetak.</small></div></div><label>Pilih logo baru<input type="file" accept=".png,.jpg,.jpeg,.webp" onChange={event=>setLogo(event.target.files?.[0]||null)}/><small>PNG, JPG, atau WebP · maksimal 2 MB · disarankan gambar persegi.</small></label>{logoError&&<div className="form-error">{logoError}</div>}<div className="branding-settings-actions"><button type="button" className="primary-button" disabled={savingLogo||!logo} onClick={()=>void uploadLogo()}>{savingLogo?"Menyimpan…":"Unggah Logo"}</button><button type="button" className="secondary-button" disabled={savingLogo} onClick={()=>void resetLogo()}>Gunakan Logo Bawaan</button></div></section>}
    {role==="Admin"&&<div className="settings-help"><div><strong>Pemulihan backup</strong><small>Periksa dan pulihkan data dari berkas backup JSON.</small></div><a href="/pemulihan">Buka Pemulihan</a></div>}
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
        ? new Set<PageKey>(["dashboard","santri","tahfidz","tahsin","akademik","mutabaah","karakter","absensi","kesehatan","pengumuman","konseling"])
        : role === "Kepala Asrama"
          ? new Set<PageKey>(["dashboard","santri","tahfidz","tahsin","akademik","mutabaah","karakter","absensi","jadwal","kesehatan","pengumuman","laporan","konseling"])
      : role === "Ustadz"
        ? new Set<PageKey>(["dashboard","santri","tahfidz","tahsin","akademik","mutabaah","karakter","absensi","jadwal","kesehatan","pengumuman","laporan","konseling"])
        : null;
    return navGroups.map(group => ({...group,items:allowed?group.items.filter(item=>allowed.has(item.key)):group.items})).filter(group=>group.items.length);
  },[role]);
  const mobileNavItems = useMemo(() => {
    if(role==="Wali Santri") return [{key:"portalwali" as PageKey,icon:"fi-rr-home-heart",label:"Portal Wali"}];
    const priorities=new Set<PageKey>(["dashboard","santri","tahfidz","keuangan"]);
    return visibleNavGroups.flatMap(group=>group.items).filter(item=>priorities.has(item.key)).slice(0,4);
  },[role,visibleNavGroups]);

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
        if(result.user.role==="Admin") void fetch("/api/backup",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"automatic"})});
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
      ...data.employees.map(row => result(`employee:${row.id}`, row.name, `${row.employee_no||"Tanpa NIP"} · ${row.position||"Tanpa jabatan"} · ${row.work_unit||"Tanpa unit"}`, "pegawai", "fi-rr-id-badge", `${row.phone} ${row.email} ${row.employment_type} ${row.status} pegawai karyawan`)),
      ...data.classes.map(row => result(`class:${row.id}`, row.name, `${row.education_level} · Wali kelas ${row.homeroom_teacher||"belum ditentukan"} · ${row.academic_year}`, "kelas", "fi-rr-chalkboard-user", `${row.major} ${row.next_class_name} kenaikan kelas alumni`)),
      ...data.schedules.map(row => result(`schedule:${row.id}`, row.title, `${row.class_name || ""} · ${row.day_name || ""} ${row.start_time || ""}–${row.end_time || ""} · ${row.teacher || ""}`, "jadwal", "▦", `${row.education_level} ${row.location} pelajaran mapel jadwal`)),
      ...data.tahfidz.map(row => result(`tahfidz:${row.id}`, row.student_name, tahfidzRange(row), "tahfidz", "◫", `${row.surah_from} ${row.surah_to} ${row.verse_from} ${row.verse_to} ${row.grade} ${row.status} hafalan setoran`)),
      ...data.tahsin.map(row => result(`tahsin:${row.id}`, row.student_name, `${row.level} · Makhraj ${row.makhraj_score} · Tajwid ${row.tajwid_score}`, "tahsin", "fi-rr-book-open-cover", `${row.fluency_score} ${row.length_score} ${row.adab_score} tahsin bacaan quran`)),
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
  }, [data, visibleNavGroups]);

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

  const content = (() => {
    const actions=(resource:Resource)=>({onAdd:()=>setEditor({resource}),onEdit:(row:Row)=>setEditor({resource,row}),onDelete:(row:Row)=>void deleteRecord(resource,row)});
    switch (page) {
      case "dashboard": return <Overview data={data} onNavigate={selectPage} />;
      case "santri": return <StudentsPage data={data} editable={role==="Admin"} {...actions("students")} onCard={setCardStudent} />;
      case "pegawai": return <EmployeesPage rows={data.employees} {...actions("employees")} />;
      case "kelas": return <ClassesPromotionPage data={data} {...actions("classes")} reload={loadData} notify={notify} />;
      case "tahfidz": return <TahfidzPage rows={data.tahfidz} {...actions("tahfidz")} />;
      case "tahsin": return <TahsinPage rows={data.tahsin} {...actions("tahsin")} />;
      case "akademik": return <AcademicPage data={data} role={role} edit={(resource,row)=>setEditor({resource,row})} remove={(resource,row)=>void deleteRecord(resource,row)} />;
      case "mutabaah": return <MutabaahPage data={data} {...actions("mutabaah")} notify={notify} />;
      case "kesehatan": return <HealthPage rows={data.health} {...actions("health")} />;
      case "keuangan": return <FinancePage rows={data.transactions} bills={data.bills} onAdd={()=>setEditor({resource:"transactions"})} onBill={()=>setEditor({resource:"bills"})} onNotify={()=>setShowNotification(true)} onPayment={row=>void openPayment(row)} />;
      case "sinurpay": return <SinurpayPage notify={notify} />;
      case "karakter": return <CharacterPage data={data} onAdd={()=>setEditor({resource:"characters"})} onEdit={row=>setEditor({resource:"characters",row})} onDelete={row=>void deleteRecord("characters",row)} />;
      case "inventaris": return <InventoryPage rows={data.inventory} {...actions("inventory")} />;
      case "pengumuman": return <AnnouncementsPage rows={data.announcements} editable={role==="Admin"} {...actions("announcements")} onNotify={()=>setShowNotification(true)} />;
      case "laporan": return <ReportsPage role={role} />;
      case "absensi": return <AttendancePage data={data} edit={(resource,row)=>setEditor({resource,row})} remove={(resource,row)=>void deleteRecord(resource,row)} reload={loadData} notify={notify} />;
      case "jadwal": return <SchedulePage data={data} role={role} edit={(resource,row)=>setEditor({resource,row})} remove={(resource,row)=>void deleteRecord(resource,row)} />;
      case "penerimaan": return <AdmissionsPage data={data} role={role} reload={loadData} notify={notify} remove={(resource,row)=>void deleteRecord(resource,row)} />;
      case "konseling": return <CounselingPage rows={data.counseling} edit={(resource,row)=>setEditor({resource,row})} remove={(resource,row)=>void deleteRecord(resource,row)} />;
      case "pengguna": return <UsersPage data={data} reply={row=>void replyGuardianMessage(row)} reload={loadData} notify={notify} />;
      case "integrasi": return <IntegrationsPage data={data} onImported={loadData} notify={notify} />;
      case "portalwali": return <GuardianPortal data={data} onCard={setCardStudent} onPayment={row=>void openPayment(row)} reload={loadData} notify={notify} />;
    }
  })();

  function selectPage(key: PageKey) {
    if(role==="Wali Santri"&&key!=="portalwali") {
      setPage("portalwali");
      setSidebarOpen(false);
      notify("Akun Wali Santri hanya dapat membuka laporan anak di Portal Wali.");
      return;
    }
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

  async function logout() {
    if(data.user?.guardianPhone) {
      await fetch("/api/wali-auth",{method:"DELETE"});
      window.location.assign("/wali");
      return;
    }
    if(data.user?.authProvider==="firebase") {
      await fetch("/api/firebase-auth",{method:"DELETE"});
      window.location.assign("/login");
      return;
    }
    window.location.assign("/signout-with-chatgpt?return_to=%2F");
  }

  return (
    <div className={`app-shell ${dark ? "dark" : ""}`}>
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="brand"><button className="brand-home" aria-label={role==="Wali Santri"?"Kembali ke Portal Wali":"Kembali ke dashboard"} onClick={()=>selectPage(role==="Wali Santri"?"portalwali":"dashboard")}><BrandMark className="brand-mark"/><span><strong>SINURMAN</strong><small>Nurul Iman</small></span></button><button className="close-sidebar" onClick={()=>setSidebarOpen(false)}>×</button></div>
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
              {topbarPanel==="profile"&&<div className="topbar-popover profile-menu" role="menu"><div className="profile-menu-head"><span>{(data.user?.name||"Pengguna").split(" ").map(x=>x[0]).slice(0,2).join("").toUpperCase()}</span><div><strong>{data.user?.name||"Pengguna SINURMAN"}</strong><small>{data.user?.guardianPhone?`+${data.user.guardianPhone}`:data.user?.email||role}</small></div></div><div className="profile-role"><span>✓</span><div><strong>{role} aktif</strong><small>{data.user?.roomScope?`Kamar ${data.user.roomScope}`:"Akses sesuai penugasan akun"}</small></div></div><button type="button" onClick={()=>{setTopbarPanel(null);setShowAccount(true);}}>♙ <span>Profil akun</span></button><button type="button" onClick={()=>{setTopbarPanel(null);setShowSettings(true);}}>⚙ <span>Pengaturan tampilan</span></button><button type="button" onClick={()=>{setTopbarPanel(null);setShowHelp(true);}}>? <span>Pusat bantuan</span></button><button type="button" onClick={()=>void logout()}>↪ <span>Keluar</span></button></div>}
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
        {mobileNavItems.map(item=><button key={item.key} className={page===item.key?"active":""} onClick={()=>selectPage(item.key)}><ToolIcon name={item.icon} /><span>{item.label}</span></button>)}
        <button onClick={()=>setSidebarOpen(true)}><i>•••</i><span>Lainnya</span></button>
      </nav>
      {editor&&<RecordModal key={`${editor.resource}-${editor.row?.id??"new"}`} editor={editor} students={data.students} subjects={data.subjects} classes={data.classes} onClose={()=>setEditor(null)} onSave={saveRecord} />}
      {cardStudent&&<StudentCardModal student={cardStudent} onClose={()=>setCardStudent(null)} />}
      {showNotification&&<NotificationModal students={data.students} onClose={()=>setShowNotification(false)} onSent={notify} />}
      {paymentBill&&<PaymentQrModal bill={paymentBill} onClose={()=>setPaymentBill(null)} onUpdated={loadData} notify={notify}/>}
      {showHelp&&<HelpModal role={role} onClose={()=>setShowHelp(false)} onNavigate={selectPage} onRefresh={async()=>{await loadData();notify("Data berhasil disinkronkan.");}}/>}
      {showAccount&&<AccountModal user={data.user} role={role} onClose={()=>setShowAccount(false)} onLogout={()=>void logout()}/>}
      {showSettings&&<SettingsModal dark={dark} role={role} onDarkChange={changeTheme} onHelp={()=>setShowHelp(true)} notify={notify} onClose={()=>setShowSettings(false)}/>}
      {toast&&<div className="toast"><span>✓</span>{toast}</div>}
    </div>
  );
}

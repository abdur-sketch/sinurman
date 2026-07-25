import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const file = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("portal wali menyediakan seluruh layanan utama", async () => {
  const page = await file("app/dashboard-client.tsx");
  for (const feature of [
    "Jadwal Pelajaran Harian",
    "Tagihan & Pembayaran",
    "Tahfidz & Mutaba’ah",
    "Rapor Karakter",
    "Kesehatan Santri",
    "Absensi & Perizinan",
    "Pengumuman",
    "Pesan ke Pesantren",
  ]) {
    assert.match(page, new RegExp(feature.replace(/[’&]/g, ".")));
  }
  assert.match(page, /action:"permit"/);
  assert.match(page, /action:"contact"/);
  assert.match(page, /onPayment/);
});

test("data wali diisolasi berdasarkan nomor HP yang terhubung", async () => {
  const [bootstrap, portal, studentCard, migration, auth] = await Promise.all([
    file("app/api/bootstrap/route.ts"),
    file("app/api/portal/route.ts"),
    file("app/api/student-card/route.ts"),
    file("drizzle/0011_gifted_nocturne.sql"),
    file("app/api/_lib.ts"),
  ]);

  assert.match(bootstrap, /user\.guardianPhone/);
  assert.match(bootstrap, /s\.guardian_phone/);
  assert.match(bootstrap, /guardianMessages/);
  assert.match(portal, /canAccessStudent/);
  assert.match(portal, /guardianOwnsStudent/);
  assert.match(studentCard, /guardianOwnsStudent/);
  assert.match(auth, /guardian_phone=\?/);
  assert.match(migration, /CREATE TABLE `guardian_accounts`/);
  assert.match(migration, /CREATE TABLE `guardian_sessions`/);
});

test("pembayaran wali memeriksa kepemilikan tagihan", async () => {
  const payment = await file("app/api/integrations/route.ts");
  assert.match(payment, /user\.role === "Wali Santri"/);
  assert.match(payment, /guardianOwnsStudent/);
  assert.match(payment, /Midtrans|Xendit/);
});

test("notifikasi otomatis terhubung ke perubahan data dan pengingat tagihan", async () => {
  const [records, notifications, reminders] = await Promise.all([
    file("app/api/records/route.ts"),
    file("app/api/_notifications.ts"),
    file("app/api/reminders/route.ts"),
  ]);
  assert.match(records, /notifyRecordChange/);
  assert.match(notifications, /WHATSAPP_PHONE_NUMBER_ID/);
  assert.match(notifications, /notification_logs/);
  assert.match(reminders, /date\(\?, '\+7 day'\)/);
});

test("pembayaran memiliki webhook rekonsiliasi dan kuitansi", async () => {
  const [webhook, receipt, migration] = await Promise.all([
    file("app/api/payments/webhook/route.ts"),
    file("app/api/receipt/route.ts"),
    file("drizzle/0004_plain_kang.sql"),
  ]);
  assert.match(webhook, /signature_key/);
  assert.match(webhook, /UPDATE bills SET status='Lunas'/);
  assert.match(receipt, /KUITANSI PEMBAYARAN/);
  assert.match(migration, /ADD `payment_reference`/);
});

test("kunjungan dan penjemputan memakai QR sekali pakai", async () => {
  const [requestRoute, qrRoute, page] = await Promise.all([
    file("app/api/guardian-requests/route.ts"),
    file("app/api/guardian-requests/qr/route.ts"),
    file("app/dashboard-client.tsx"),
  ]);
  assert.match(requestRoute, /crypto\.randomUUID/);
  assert.match(requestRoute, /status='Digunakan'/);
  assert.match(qrRoute, /SINURMAN:REQUEST:/);
  assert.match(page, /Validasi QR/);
});

test("logo dan tombol bantuan sidebar memiliki aksi", async () => {
  const page = await file("app/dashboard-client.tsx");
  assert.match(page, /className="brand-home"[\s\S]*onClick=/);
  assert.match(page, /className="sidebar-help"[\s\S]*setShowHelp\(true\)/);
  assert.match(page, /PUSAT BANTUAN SINURMAN/);
});

test("PPDB online menyediakan formulir dan pelacakan status untuk wali", async () => {
  const [page, bootstrap] = await Promise.all([
    file("app/dashboard-client.tsx"),
    file("app/api/bootstrap/route.ts"),
  ]);
  assert.match(page, /PPDB ONLINE 2026\/2027/);
  assert.match(page, /Kirim Pendaftaran/);
  assert.match(page, /Kelola Dokumen/);
  assert.match(page, /Catatan verifikator/);
  assert.match(page, /new Set<PageKey>\(\["portalwali"\]\)/);
  assert.match(bootstrap, /lower\(applicant_email\)=\?/);
  assert.match(bootstrap, /admissionDocuments/);
});

test("unggah dokumen PPDB membatasi tipe, ukuran, dan kepemilikan", async () => {
  const [documents, hosting, migration] = await Promise.all([
    file("app/api/admissions/documents/route.ts"),
    file(".openai/hosting.json"),
    file("drizzle/0005_smart_drax.sql"),
  ]);
  assert.match(documents, /application\/pdf/);
  assert.match(documents, /5 \* 1024 \* 1024/);
  assert.match(documents, /applicant_email\.toLowerCase\(\) !== email\.toLowerCase\(\)/);
  assert.match(documents, /env\.FILES\.put/);
  assert.match(hosting, /"r2": "FILES"/);
  assert.match(migration, /CREATE TABLE `admission_documents`/);
});

test("verifikasi PPDB hanya dapat dilakukan admin", async () => {
  const [admissions, documents] = await Promise.all([
    file("app/api/admissions/route.ts"),
    file("app/api/admissions/documents/route.ts"),
  ]);
  assert.match(admissions, /user\.role !== "Admin"/);
  assert.match(admissions, /Perlu Perbaikan/);
  assert.match(admissions, /sendWhatsappNotification/);
  assert.match(documents, /Hanya admin yang dapat memverifikasi dokumen/);
  assert.match(documents, /status === "Ditolak"/);
});

test("dashboard aman untuk admin dan wali diarahkan ke portal terbatas", async () => {
  const [lib, page, bootstrap] = await Promise.all([
    file("app/api/_lib.ts"),
    file("app/dashboard-client.tsx"),
    file("app/api/bootstrap/route.ts"),
  ]);
  assert.match(lib, /ensureDatabaseSchema/);
  assert.match(lib, /CREATE TABLE IF NOT EXISTS students/);
  assert.match(lib, /PRAGMA table_info/);
  assert.match(page, /new Set<PageKey>\(\["portalwali"\]\)/);
  assert.match(page, /if\(result\.user\.role==="Wali Santri"\) setPage\("portalwali"\)/);
  assert.match(page, /role==="Wali Santri"\?"Kembali ke Portal Wali":"Kembali ke dashboard"/);
  assert.match(lib, /UPDATE users SET role='Admin'/);
  assert.match(lib, /const ownerEmail = "baikganteng88@gmail.com"/);
  assert.match(lib, /identity\.email\.toLowerCase\(\) === ownerEmail/);
  assert.match(bootstrap, /const safe = async/);
  assert.match(page, /setRole\("Admin"\)/);
  assert.match(page, /\{role\} aktif/);
  assert.doesNotMatch(page, /Pratinjau peran demo/);
});

test("pusat bantuan dan ikon kanan atas memiliki aksi lengkap", async () => {
  const page = await file("app/dashboard-client.tsx");
  assert.match(page, /aria-haspopup="dialog"[\s\S]*setShowHelp\(true\)/);
  assert.match(page, /PUSAT BANTUAN SINURMAN/);
  assert.match(page, /onNavigate\(guide\.page\)/);
  assert.match(page, /topbarPanel==="notifications"/);
  assert.match(page, /notification-list/);
  assert.match(page, /setShowAccount\(true\)/);
  assert.match(page, /setShowSettings\(true\)/);
  assert.match(page, /sinurman-theme/);
  assert.match(page, /signout-with-chatgpt\?return_to=%2F/);
  assert.match(page, /event\.key==="Escape"/);
});

test("seluruh laporan mendukung cetak langsung A4, PDF, CSV, dan pembatasan peran", async () => {
  const [dashboard, printPage, printClient, exportRoute, styles] = await Promise.all([
    file("app/dashboard-client.tsx"),
    file("app/cetak/page.tsx"),
    file("app/cetak/print-report-client.tsx"),
    file("app/api/export/route.ts"),
    file("app/globals.css"),
  ]);
  for (const type of ["students","tahfidz","mutabaah","attendance","characters","health","counseling","schedules","finance","inventory","admissions"]) {
    assert.match(dashboard, new RegExp(`key:"${type}"`));
    assert.match(exportRoute, new RegExp(`${type}: \\{`));
  }
  assert.match(dashboard, /\/cetak\?type=/);
  assert.match(dashboard, /query\(report\.key,"pdf"\)/);
  assert.match(dashboard, /query\(report\.key,"csv"\)/);
  assert.match(printPage, /requireChatGPTUser\("\/cetak"\)/);
  assert.match(printClient, /window\.print\(\)/);
  assert.match(printClient, /PONDOK PESANTREN NURUL IMAN/);
  assert.match(printClient, /Pimpinan Pesantren/);
  assert.match(exportRoute, /config\.adminOnly&&user\.role!=="Admin"/);
  assert.match(exportRoute, /user\.role==="Musyrif"\|\|user\.role==="Kepala Asrama"/);
  assert.match(exportRoute, /config\.scopedQuery/);
  assert.match(styles, /@page \{ size:A4 landscape/);
});

test("setoran tahfidz menyimpan rentang surat dan ayat secara lengkap", async () => {
  const [dashboard, records, notifications, exportRoute, migration, schema, runtime] = await Promise.all([
    file("app/dashboard-client.tsx"),
    file("app/api/records/route.ts"),
    file("app/api/_notifications.ts"),
    file("app/api/export/route.ts"),
    file("drizzle/0007_real_caretaker.sql"),
    file("db/schema.ts"),
    file("app/api/_lib.ts"),
  ]);
  for (const field of ["surah_from","surah_to","verse_from","verse_to"]) {
    assert.match(dashboard, new RegExp(field));
    assert.match(records, new RegExp(field));
    assert.match(exportRoute, new RegExp(field));
    assert.match(migration, new RegExp(field));
  }
  assert.match(dashboard, /function tahfidzRange/);
  assert.match(dashboard, /Ayat awal/);
  assert.match(dashboard, /Ayat akhir/);
  assert.match(dashboard, /verseTo-verseFrom\+1/);
  assert.match(records, /Ayat akhir tidak boleh lebih kecil/);
  assert.match(notifications, /sampai/);
  assert.match(schema, /surahFrom: text\("surah_from"\)/);
  assert.match(runtime, /UPDATE tahfidz_records SET surah_from=surah/);
});

test("portal internal memakai login ChatGPT dan halaman PPDB tetap publik", async () => {
  const [root, auth, publicPage, publicApi, lib] = await Promise.all([
    file("app/page.tsx"),
    file("app/chatgpt-auth.ts"),
    file("app/ppdb/page.tsx"),
    file("app/api/ppdb/route.ts"),
    file("app/api/_lib.ts"),
  ]);
  assert.match(root, /requireChatGPTUser\("\/"\)/);
  assert.match(auth, /signin-with-chatgpt/);
  assert.match(publicPage, /PPDB ONLINE 2026\/2027/);
  assert.match(publicPage, /Cek status pendaftaran/);
  assert.match(publicApi, /trackingToken/);
  assert.match(publicApi, /tracking_token=\?/);
  assert.doesNotMatch(lib, /admin@sinurman\.local/);
});

test("portal wali memiliki halaman masuk khusus dan pengunci akses anak", async () => {
  const [guardianLogin, guardianClient, dashboard, bootstrap, ppdb, authRoute, adminRoute] = await Promise.all([
    file("app/wali/page.tsx"),
    file("app/wali/wali-login-client.tsx"),
    file("app/dashboard-client.tsx"),
    file("app/api/bootstrap/route.ts"),
    file("app/ppdb/page.tsx"),
    file("app/api/wali-auth/route.ts"),
    file("app/api/guardian-accounts/route.ts"),
  ]);
  assert.match(guardianLogin, /nomor HP dan PIN/);
  assert.match(guardianClient, /Masuk ke Portal Wali/);
  assert.match(guardianClient, /\/api\/wali-auth/);
  assert.match(guardianClient, /PIN Portal Wali/);
  assert.match(authRoute, /set-cookie/);
  assert.match(adminRoute, /setGuardianPin/);
  assert.match(dashboard, /role==="Wali Santri"&&key!=="portalwali"/);
  assert.match(dashboard, /hanya dapat membuka laporan anak di Portal Wali/);
  assert.match(dashboard, /Buka & Bagikan Portal Wali/);
  assert.match(bootstrap, /guardianPhone/);
  assert.match(ppdb, /href="\/wali">Masuk Portal Wali/);
});

test("login nomor HP memakai PIN aman, sesi HttpOnly, dan penguncian percobaan", async () => {
  const [lib, authRoute, portalPage, migration] = await Promise.all([
    file("app/api/_lib.ts"),
    file("app/api/wali-auth/route.ts"),
    file("app/portal-wali/page.tsx"),
    file("drizzle/0011_gifted_nocturne.sql"),
  ]);
  assert.match(lib, /PBKDF2/);
  assert.match(lib, /iterations: 100_000/);
  assert.match(lib, /failed_attempts/);
  assert.match(lib, /15 \* 60 \* 1000/);
  assert.match(lib, /HttpOnly; Secure; SameSite=Lax/);
  assert.match(lib, /guardian_sessions/);
  assert.match(authRoute, /verifyGuardianPin/);
  assert.match(authRoute, /redirectTo: "\/portal-wali"/);
  assert.match(portalPage, /getGuardianSession/);
  assert.match(portalPage, /redirect\("\/wali"\)/);
  assert.match(migration, /pin_hash/);
  assert.doesNotMatch(authRoute, /pin_hash/);
});

test("data pegawai memiliki CRUD Admin, filter, pencarian, dan migrasi database", async () => {
  const [dashboard, records, bootstrap, runtime, schema, migration] = await Promise.all([
    file("app/dashboard-client.tsx"),
    file("app/api/records/route.ts"),
    file("app/api/bootstrap/route.ts"),
    file("app/api/_lib.ts"),
    file("db/schema.ts"),
    file("drizzle/0012_noisy_lilandra.sql"),
  ]);
  assert.match(dashboard, /Data Pegawai/);
  assert.match(dashboard, /function EmployeesPage/);
  assert.match(dashboard, /Total Pegawai/);
  assert.match(dashboard, /Pegawai Aktif/);
  assert.match(dashboard, /Tenaga Pendidikan/);
  assert.match(dashboard, /Cari nama, NIP, jabatan, atau nomor HP/);
  assert.match(dashboard, /actions\("employees"\)/);
  assert.match(records, /employees: \{/);
  assert.match(records, /employee_no/);
  assert.match(bootstrap, /SELECT \* FROM employees ORDER BY name/);
  assert.match(bootstrap, /user\.role === "Admin"/);
  assert.match(runtime, /CREATE TABLE IF NOT EXISTS employees/);
  assert.match(schema, /export const employees/);
  assert.match(migration, /CREATE TABLE `employees`/);
  assert.match(migration, /employees_employee_no_unique/);
});

test("master kelas, kenaikan otomatis, dan arsip alumni tersedia untuk Admin", async () => {
  const [dashboard, promotions, records, bootstrap, runtime, schema, tablesMigration, indexMigration] = await Promise.all([
    file("app/dashboard-client.tsx"),
    file("app/api/promotions/route.ts"),
    file("app/api/records/route.ts"),
    file("app/api/bootstrap/route.ts"),
    file("app/api/_lib.ts"),
    file("db/schema.ts"),
    file("drizzle/0013_cool_amphibian.sql"),
    file("drizzle/0014_amused_speed_demon.sql"),
  ]);
  assert.match(dashboard, /Kelas & Kenaikan/);
  assert.match(dashboard, /function ClassesPromotionPage/);
  assert.match(dashboard, /Kenaikan kelas otomatis/);
  assert.match(dashboard, /Alumni Tersimpan/);
  assert.match(dashboard, /promotionHistory/);
  assert.match(dashboard, /type:"class"/);
  assert.match(promotions, /Hanya Admin yang dapat memproses kenaikan kelas/);
  assert.match(promotions, /status='Alumni'/);
  assert.match(promotions, /INSERT OR IGNORE INTO student_promotions/);
  assert.match(promotions, /student_promotions_year_idx|academic_year_from/);
  assert.match(records, /school_classes/);
  assert.match(bootstrap, /SELECT \* FROM school_classes/);
  assert.match(bootstrap, /SELECT \* FROM student_promotions/);
  assert.match(runtime, /CREATE TABLE IF NOT EXISTS school_classes/);
  assert.match(runtime, /CREATE TABLE IF NOT EXISTS student_promotions/);
  assert.match(schema, /export const schoolClasses/);
  assert.match(schema, /export const studentPromotions/);
  assert.match(tablesMigration, /CREATE TABLE `school_classes`/);
  assert.match(tablesMigration, /CREATE TABLE `student_promotions`/);
  assert.match(indexMigration, /student_promotions_year_idx/);
});

test("Musyrif dan Kepala Asrama dibatasi modul serta kamar penugasan", async () => {
  const [page, lib, bootstrap, records, migration] = await Promise.all([
    file("app/dashboard-client.tsx"),
    file("app/api/_lib.ts"),
    file("app/api/bootstrap/route.ts"),
    file("app/api/records/route.ts"),
    file("drizzle/0006_faithful_wendell_vaughn.sql"),
  ]);
  assert.match(page, /role === "Musyrif"/);
  assert.match(page, /role === "Kepala Asrama"/);
  assert.match(lib, /role === "Musyrif"/);
  assert.match(bootstrap, /WHERE s\.room=\?/);
  assert.match(records, /Santri ini berada di luar penugasan kamar Anda/);
  assert.match(records, /"mutabaah"/);
  assert.match(migration, /ADD `room_scope`/);
});

test("unggah PPDB publik memvalidasi token, tipe, dan ukuran berkas", async () => {
  const documents = await file("app/api/ppdb/documents/route.ts");
  assert.match(documents, /tracking_token=\?/);
  assert.match(documents, /application\/pdf/);
  assert.match(documents, /5 \* 1024 \* 1024/);
  assert.match(documents, /env\.FILES\.put/);
});

test("akademik SMP-SMK menghitung rapor dan membatasi data sesuai kamar", async () => {
  const [dashboard, records, bootstrap, exportRoute, migration] = await Promise.all([
    file("app/dashboard-client.tsx"),
    file("app/api/records/route.ts"),
    file("app/api/bootstrap/route.ts"),
    file("app/api/export/route.ts"),
    file("drizzle/0008_academic_qr.sql"),
  ]);
  assert.match(dashboard, /Akademik & Rapor/);
  assert.match(dashboard, /assignment_score/);
  assert.match(records, /scores\[0\]\*0\.3\+scores\[1\]\*0\.3\+scores\[2\]\*0\.4/);
  assert.match(records, /finalScore>=90\?"A"/);
  assert.match(bootstrap, /academic_grades/);
  assert.match(bootstrap, /WHERE s\.room=\?/);
  assert.match(exportRoute, /academics: \{/);
  assert.match(migration, /CREATE TABLE `academic_subjects`/);
  assert.match(migration, /CREATE TABLE `academic_grades`/);
});

test("presensi QR dan notifikasi WhatsApp otomatis terintegrasi", async () => {
  const [qr, card, notifications, dashboard] = await Promise.all([
    file("app/api/attendance-qr/route.ts"),
    file("app/api/student-card/route.ts"),
    file("app/api/_notifications.ts"),
    file("app/dashboard-client.tsx"),
  ]);
  assert.match(card, /app:"SINURMAN"/);
  assert.match(qr, /payload\.app!=="SINURMAN"/);
  assert.match(qr, /student_id=\? AND record_date=\?/);
  assert.match(qr, /Santri berada di luar penugasan kamar Anda/);
  assert.match(qr, /notifyRecordChange\("attendance"/);
  for (const resource of ["grades","characters","counseling"]) assert.match(notifications, new RegExp(`resource==="${resource}"`));
  assert.match(dashboard, /Notifikasi WhatsApp Otomatis/);
});

test("dashboard analitik dapat difilter per kelas, kamar, dan periode", async () => {
  const dashboard = await file("app/dashboard-client.tsx");
  assert.match(dashboard, /classFilter/);
  assert.match(dashboard, /roomFilter/);
  assert.match(dashboard, /periodFilter/);
  assert.match(dashboard, /Distribusi per Kelas/);
  assert.match(dashboard, /Distribusi per Kamar/);
});

test("master Al-Quran berisi 114 surat dan memvalidasi rentang lintas surat", async () => {
  const quran = await file("app/quran-data.ts");
  assert.match(quran, /\[1,"Al-Fatihah",7\]/);
  assert.match(quran, /\[114,"An-Nas",6\]/);
  assert.match(quran, /end<start/);
  assert.match(quran, /amount\+=QURAN_SURAHS\[index\]\.verses/);
});

test("SINURPAY menyediakan buku tabungan, kasir barcode, stok, limit, dan audit", async () => {
  const [dashboard, route, card, bootstrap, migration] = await Promise.all([
    file("app/dashboard-client.tsx"),
    file("app/api/sinurpay/route.ts"),
    file("app/api/student-card/route.ts"),
    file("app/api/bootstrap/route.ts"),
    file("drizzle/0009_sinurpay.sql"),
  ]);
  for (const feature of ["Kasir Kantin","Buku Tabungan","Produk & Stok","Transaksi & Laporan","Scan kartu santri"]) {
    assert.match(dashboard, new RegExp(feature.replace("&",".")));
  }
  for (const table of ["wallet_accounts","wallet_entries","canteen_products","canteen_sales","canteen_sale_items"]) {
    assert.match(route, new RegExp(table));
    assert.match(migration, new RegExp(`CREATE TABLE .${table}.`));
  }
  assert.match(route, /Saldo tidak cukup/);
  assert.match(route, /Melebihi limit harian/);
  assert.match(route, /Stok salah satu produk tidak mencukupi/);
  assert.match(route, /reverse-sale/);
  assert.match(route, /notifyGuardian/);
  assert.match(route, /user\.role!=="Admin"/);
  assert.match(card, /walletToken/);
  assert.match(bootstrap, /guardianPhone/);
});

test("portal wali menampilkan saldo dan mutasi SINURPAY milik santri terhubung", async () => {
  const [dashboard, bootstrap, route] = await Promise.all([
    file("app/dashboard-client.tsx"),
    file("app/api/bootstrap/route.ts"),
    file("app/api/sinurpay/route.ts"),
  ]);
  assert.match(dashboard, /Saldo SINURPAY/);
  assert.match(dashboard, /Buku Tabungan & Belanja Kantin/);
  assert.match(bootstrap, /walletEntries/);
  assert.match(bootstrap, /canteenSales/);
  assert.match(route, /guardianField/);
  assert.match(route, /s\.guardian_phone=\?/);
  assert.doesNotMatch(route, /guardian.*card_token/);
});

test("top-up SINURPAY memakai payment gateway, webhook idempoten, dan isolasi wali", async () => {
  const [dashboard, topup, settlement, webhook, runtime, migration, guardMigration] = await Promise.all([
    file("app/dashboard-client.tsx"),
    file("app/api/sinurpay/topup/route.ts"),
    file("app/api/sinurpay/_topup.ts"),
    file("app/api/payments/webhook/route.ts"),
    file("app/api/_lib.ts"),
    file("drizzle/0010_sinurpay_topup.sql"),
    file("drizzle/0011_sinurpay_settlement.sql"),
  ]);
  assert.match(dashboard, /Top Up Saldo/);
  assert.match(dashboard, /QRIS/);
  assert.match(topup, /guardianOwnsStudent/);
  assert.match(topup, /MIDTRANS_SERVER_KEY/);
  assert.match(topup, /XENDIT_API_KEY/);
  assert.match(webhook, /invoice\.startsWith\("TOP-"\)/);
  assert.match(settlement, /wallet_topup_settlements/);
  assert.match(settlement, /UPDATE wallet_accounts SET balance/);
  assert.match(runtime, /CREATE TABLE IF NOT EXISTS wallet_topups/);
  assert.match(migration, /CREATE TABLE `wallet_topups`/);
  assert.match(guardMigration, /UNIQUE INDEX `wallet_topup_settlements_topup_id_unique`/);
});

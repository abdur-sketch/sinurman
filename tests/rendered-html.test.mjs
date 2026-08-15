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
  assert.match(lib, /isOwnerEmail/);
  assert.match(lib, /isOwnerEmail\(identity\.email\)/);
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

test("wali dapat mendaftar memakai nomor HP dengan persetujuan Admin", async () => {
  const [registration, auth, client, admin] = await Promise.all([
    file("app/api/wali-register/route.ts"),
    file("app/api/_lib.ts"),
    file("app/wali/wali-login-client.tsx"),
    file("app/dashboard-client.tsx"),
  ]);
  assert.match(registration, /registerGuardianAccount/);
  assert.match(auth, /Menunggu Persetujuan/);
  assert.match(auth, /guardian_phone=\? AND status='Aktif'/);
  assert.match(client, /Daftar Akun Wali/);
  assert.match(client, /\/api\/wali-register/);
  assert.match(admin, /Setujui/);
});

test("Google Sign-In wali memverifikasi provider dan tetap melalui status persetujuan", async () => {
  const [client, route, lib, schema, proxy] = await Promise.all([
    file("app/wali/wali-login-client.tsx"),
    file("app/api/wali-google-auth/route.ts"),
    file("app/api/_lib.ts"),
    file("db/schema.ts"),
    file("proxy.ts"),
  ]);
  assert.match(client, /GoogleAuthProvider/);
  assert.match(client, /signInWithPopup/);
  assert.match(client, /\/api\/wali-google-auth/);
  assert.match(route, /verifyIdToken\(idToken, true\)/);
  assert.match(route, /provider !== "google\.com"/);
  assert.match(route, /status !== "Aktif"/);
  assert.match(route, /Pastikan provider Google sudah diaktifkan/);
  assert.match(route, /google_uid/);
  assert.match(`${lib}\n${schema}`, /google_uid/);
  assert.match(proxy, /"\/api\/wali-google-auth"/);
});

test("Admin dapat mengganti logo sekolah yang dipakai di seluruh portal", async () => {
  const [route, brand, dashboard, wali, login, ppdb, print] = await Promise.all([
    file("app/api/branding/logo/route.ts"),
    file("app/brand-mark.tsx"),
    file("app/dashboard-client.tsx"),
    file("app/wali/page.tsx"),
    file("app/login/page.tsx"),
    file("app/ppdb/page.tsx"),
    file("app/cetak/print-report-client.tsx"),
  ]);
  assert.match(route, /user\.role !== "Admin"/);
  assert.match(route, /image\/webp/);
  assert.match(route, /2 \* 1024 \* 1024/);
  assert.match(route, /env\.FILES\.put/);
  assert.match(brand, /\/api\/branding\/logo/);
  for (const source of [dashboard, wali, login, ppdb, print]) assert.match(source, /BrandMark/);
  assert.match(dashboard, /Unggah Logo/);
  assert.match(dashboard, /Gunakan Logo Bawaan/);
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

test("target Firebase App Hosting memiliki SDK, emulator, aturan keamanan, dan health check", async () => {
  const [packageJson, appHosting, firebaseConfig, firestoreRules, storageRules, health, admin, client, nextConfig] = await Promise.all([
    file("package.json"),
    file("apphosting.yaml"),
    file("firebase.json"),
    file("firestore.rules"),
    file("storage.rules"),
    file("app/api/firebase-health/route.ts"),
    file("lib/firebase/admin.ts"),
    file("lib/firebase/client.ts"),
    file("next.config.ts"),
  ]);
  assert.match(packageJson, /build:firebase/);
  assert.match(packageJson, /firebase:emulators/);
  assert.match(packageJson, /firebase-admin/);
  assert.match(appHosting, /FIREBASE_RUNTIME/);
  assert.match(firebaseConfig, /firestore/);
  assert.match(firebaseConfig, /storage/);
  assert.match(firebaseConfig, /emulators/);
  assert.match(firestoreRules, /allow read, write: if false/);
  assert.match(storageRules, /allow read, write: if false/);
  assert.match(health, /firebase-app-hosting/);
  assert.match(admin, /applicationDefault/);
  assert.match(client, /initializeApp/);
  assert.match(nextConfig, /cloudflare:workers/);
});

test("runtime Firebase menolak header lama dan membatasi sesi dashboard internal", async () => {
  const [api, serverAuth, session] = await Promise.all([
    file("app/api/_lib.ts"),
    file("app/chatgpt-auth.ts"),
    file("lib/firebase/session.ts"),
  ]);
  assert.match(api, /\} else \{\s+const email = request\.headers\.get\("oai-authenticated-user-email"\)/);
  assert.match(serverAuth, /if \(process\.env\.FIREBASE_RUNTIME === "true"\)[\s\S]*return null;/);
  assert.match(session, /const internalRoles = new Set\(\["Admin", "Kepala Asrama", "Musyrif", "Ustadz"\]\)/);
  assert.match(session, /Akun belum diberi akses oleh Admin SINURMAN/);
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

test("Admin dapat mengubah sandi dan mengelola akun login sekolah melalui Firebase", async () => {
  const [dashboard, users, auth, session, records] = await Promise.all([
    file("app/dashboard-client.tsx"),
    file("app/api/admin-users/route.ts"),
    file("app/api/firebase-auth/route.ts"),
    file("lib/firebase/session.ts"),
    file("app/api/records/route.ts"),
  ]);
  assert.match(dashboard, /Ubah kata sandi/);
  assert.match(dashboard, /reauthenticateWithCredential/);
  assert.match(dashboard, /Buat Akun Login/);
  assert.match(dashboard, /Reset sandi/);
  assert.match(users, /createUser/);
  assert.match(users, /updateUser/);
  assert.match(users, /revokeRefreshTokens/);
  assert.match(users, /Akun pemilik utama tidak dapat diblokir/);
  assert.match(users, /managedRoles/);
  assert.match(auth, /rotateFirebaseSession/);
  assert.match(session, /verifyIdToken\(idToken,\s*true\)/);
  assert.match(session, /revokeFirebaseSessions/);
  assert.match(records, /Manajemen Pengguna agar akun Firebase dan hak akses tetap sinkron/);
});

test("keluar akun dan ubah sandi mengikuti penyedia login yang benar", async () => {
  const [dashboard, auth] = await Promise.all([
    file("app/dashboard-client.tsx"),
    file("app/api/_lib.ts"),
  ]);
  assert.match(auth, /authProvider: "firebase"/);
  assert.match(auth, /authProvider: "chatgpt"/);
  assert.match(auth, /authProvider: "guardian"/);
  assert.match(dashboard, /data\.user\?\.authProvider==="firebase"/);
  assert.match(dashboard, /fetch\("\/api\/firebase-auth",\{method:"DELETE"\}\)/);
  assert.match(dashboard, /window\.location\.assign\("\/login"\)/);
  assert.match(dashboard, /user\?\.authProvider==="firebase"/);
});

test("API terlindungi menolak permintaan tanpa sesi sebagai 401", async () => {
  const proxy = await file("proxy.ts");
  assert.match(proxy, /sinurman_admin_session/);
  assert.match(proxy, /sinurman_wali_session/);
  assert.match(proxy, /oai-authenticated-user-email/);
  assert.match(proxy, /status:\s*401/);
  assert.match(proxy, /request\.method === "GET"/);
  assert.match(proxy, /matcher:\s*"\/api\/:path\*"/);
});

test("tombol dashboard utama terhubung ke data nyata dan menghormati hak akses", async () => {
  const [dashboard, records, login] = await Promise.all([
    file("app/dashboard-client.tsx"),
    file("app/api/records/route.ts"),
    file("app/login/login-client.tsx"),
  ]);
  assert.match(dashboard, /onClick=\{\(\)=>onNavigate\("pengumuman"\)\}/);
  assert.match(dashboard, /visibleRows=filtered\.slice/);
  assert.match(dashboard, /setPage\(value=>Math\.min\(pageCount,value\+1\)\)/);
  assert.match(dashboard, /window\.open\(`https:\/\/wa\.me/);
  assert.match(dashboard, /data\.characters\.filter/);
  assert.match(dashboard, /character-student-picker/);
  assert.match(dashboard, /editable=\{role==="Admin"\}/);
  assert.match(dashboard, /canEditSchedule=role==="Admin"\|\|role==="Ustadz"/);
  assert.doesNotMatch(dashboard, /<strong>473<\/strong>/);
  assert.doesNotMatch(dashboard, /Rp46,8jt/);
  assert.match(records, /Nilai karakter harus berada pada rentang 0–100/);
  assert.match(login, /Masuk ke Dashboard/);
});

test("Firebase menyimpan setiap baris sebagai dokumen dan mempertahankan migrasi data lama", async () => {
  const [adapter, session] = await Promise.all([
    file("lib/firebase/firestore-d1.ts"),
    file("lib/firebase/session.ts"),
  ]);
  assert.match(adapter, /collection\("_d1_tables"\)/);
  assert.match(adapter, /collection\("rows"\)/);
  assert.match(adapter, /doc\("d1-schema-v3"\)/);
  assert.match(adapter, /doc\("d1-schema-v2"\)/);
  assert.match(adapter, /doc\("d1-state-v1"\)/);
  assert.match(adapter, /runTransaction/);
  assert.match(adapter, /sourceRows\.slice\(start,start\+400\)/);
  assert.match(adapter, /version:3,rowCount/);
  assert.match(adapter, /ADD COLUMN/);
  assert.match(adapter, /tableRows\(name\)\.limit\(400\)/);
  assert.match(session, /collection\("_d1_tables"\)\.doc\("users"\)/);
  assert.match(session, /collection\("rows"\)/);
  assert.match(session, /legacy\.data\(\)\?\.tables\?\.users/);
});

test("PWA tersedia tanpa menyimpan API atau data rahasia saat offline", async () => {
  const [manifest, register, worker, offline] = await Promise.all([
    file("app/manifest.ts"),
    file("app/pwa-register.tsx"),
    file("public/sw.js"),
    file("public/offline.html"),
  ]);
  assert.match(manifest, /display:\s*"standalone"/);
  assert.match(register, /navigator\.serviceWorker\.register\("\/sw\.js"\)/);
  assert.match(worker, /url\.pathname\.startsWith\("\/api\/"\)/);
  assert.match(worker, /url\.pathname\.startsWith\("\/api\/"\)\) return/);
  assert.match(worker, /offline\.html/);
  assert.match(offline, /Data SINURMAN dilindungi dan tidak disimpan/);
});

test("backup operasional dapat disimpan ke storage dan status integrasi dapat diaudit", async () => {
  const [backup, backupService, integrations, dashboard, restore] = await Promise.all([
    file("app/api/backup/route.ts"),
    file("lib/backup-service.ts"),
    file("app/api/integrations/route.ts"),
    file("app/dashboard-client.tsx"),
    file("app/pemulihan/restore-client.tsx"),
  ]);
  assert.match(backup, /export async function POST/);
  assert.match(backup, /export async function PUT/);
  assert.match(backupService, /env\.FILES\.put/);
  assert.match(backupService, /version:3/);
  assert.match(backupService, /automaticInterval=20\*60\*60\*1000/);
  assert.match(backupService, /retentionDays=90/);
  assert.match(backup, /confirm!=="PULIHKAN"/);
  assert.match(integrations, /databaseMode/);
  assert.match(integrations, /lastBackup/);
  assert.match(integrations, /failedNotifications/);
  assert.match(dashboard, /Backup ke Server/);
  assert.match(dashboard, /action:"automatic"/);
  assert.match(restore, /Validasi backup/);
  assert.match(restore, /confirm:"PULIHKAN"/);
});

test("keamanan akun Firebase mewajibkan MFA adaptif dan pencabutan sesi perangkat", async () => {
  const [session, route, dashboard, login] = await Promise.all([
    file("lib/firebase/session.ts"),
    file("app/api/account-security/route.ts"),
    file("app/dashboard-client.tsx"),
    file("app/login/login-client.tsx"),
  ]);
  assert.match(session, /enrolledMfa/);
  assert.match(session, /access\.role==="Admin"&&enrolledMfa/);
  assert.match(session, /sign_in_second_factor/);
  assert.match(session, /lastSeenAt/);
  assert.match(route, /listFirebaseSessions/);
  assert.match(route, /removeFirebaseSessionById/);
  assert.match(route, /required:user\.role==="Admin"/);
  assert.match(dashboard, /Keamanan perangkat/);
  assert.match(dashboard, /MFA aktif/);
  assert.match(dashboard, /TotpMultiFactorGenerator\.generateSecret/);
  assert.match(dashboard, /assertionForEnrollment/);
  assert.match(login, /auth\/multi-factor-auth-required/);
  assert.match(login, /getMultiFactorResolver/);
  assert.match(login, /assertionForSignIn/);
});

test("impor spreadsheet tidak memakai xlsx rentan dan membatasi transaksi", async () => {
  const [packageJson, importer] = await Promise.all([
    file("package.json"),
    file("app/api/import/route.ts"),
  ]);
  assert.doesNotMatch(packageJson, /"xlsx"/);
  assert.match(packageJson, /"read-excel-file"/);
  assert.match(importer, /readSheet/);
  assert.match(importer, /file\.size>3_000_000/);
  assert.match(importer, /start\+=350/);
});

test("health check produksi memeriksa database dan backup otomatis", async () => {
  const [health, proxy] = await Promise.all([
    file("app/api/health/route.ts"),
    file("proxy.ts"),
  ]);
  assert.match(health, /SELECT COUNT\(\*\) AS total FROM users/);
  assert.match(health, /backups\/\.automatic-backup\.json/);
  assert.match(health, /latencyMs/);
  assert.match(proxy, /\/api\/health/);
});

test("Admin dapat mencetak kartu santri massal per kelas", async () => {
  const [route, client] = await Promise.all([
    file("app/api/student-card/route.ts"),
    file("app/kartu-santri/student-cards-client.tsx"),
  ]);
  assert.match(route, /searchParams\.get\("bulk"\)==="1"/);
  assert.match(route, /user\.role!=="Admin"/);
  assert.match(route, /results\.slice\(0,250\)/);
  assert.match(client, /Tampilkan Kartu/);
  assert.match(client, /window\.print/);
});

test("rekonsiliasi SINURPAY memakai seluruh buku besar, bukan daftar terbatas", async () => {
  const [route, dashboard] = await Promise.all([
    file("app/api/sinurpay/route.ts"),
    file("app/dashboard-client.tsx"),
  ]);
  assert.match(route, /SELECT COALESCE\(SUM\(amount\),0\) AS total FROM wallet_entries/);
  assert.match(route, /reconciliationVariance:totalBalance-ledgerBalance/);
  assert.match(dashboard, /Rekonsiliasi Saldo/);
  assert.match(dashboard, /Nilai Persediaan/);
});

test("reset PIN wali memakai OTP WhatsApp aman, kedaluwarsa, dan pembatasan percobaan", async () => {
  const [route, notification, migration, login, proxy] = await Promise.all([
    file("app/api/wali-pin-reset/route.ts"),
    file("app/api/_notifications.ts"),
    file("drizzle/0015_plain_thunderball.sql"),
    file("app/wali/wali-login-client.tsx"),
    file("proxy.ts"),
  ]);
  assert.match(route, /crypto\.subtle\.digest\("SHA-256"/);
  assert.match(route, /10\*60\*1000/);
  assert.match(route, /attempts>=5/);
  assert.match(route, /60_000/);
  assert.match(route, /if\(!notification\.automatic\)/);
  assert.match(notification, /sensitive\?"Pesan keamanan rahasia telah dikirim/);
  assert.match(migration, /CREATE TABLE `guardian_pin_resets`/);
  assert.match(login, /Lupa PIN/);
  assert.match(proxy, /\/api\/wali-pin-reset/);
});

test("Tahsin dan Profil Santri 360 memakai satu ID santri terpadu", async () => {
  const [dashboard, schema, runtime, records, bootstrap, migration, backup] = await Promise.all([
    file("app/dashboard-client.tsx"),
    file("db/schema.ts"),
    file("app/api/_lib.ts"),
    file("app/api/records/route.ts"),
    file("app/api/bootstrap/route.ts"),
    file("drizzle/0017_messy_umar.sql"),
    file("lib/backup-service.ts"),
  ]);
  assert.match(dashboard, /Profil Santri 360°/);
  assert.match(dashboard, /SATU SANTRI, SATU ID/);
  assert.match(dashboard, /Tahsin Al-Qur’an/);
  assert.match(schema, /export const tahsinRecords/);
  assert.match(runtime, /CREATE TABLE IF NOT EXISTS tahsin_records/);
  assert.match(records, /Seluruh nilai Tahsin harus berada pada rentang 0–100/);
  assert.match(bootstrap, /JOIN students s ON s\.id=t\.student_id/);
  assert.match(migration, /FOREIGN KEY \(`student_id`\) REFERENCES `students`\(`id`\)/);
  assert.match(backup, /"tahsin_records"/);
});

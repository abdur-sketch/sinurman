import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const file = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("portal wali menyediakan seluruh layanan utama", async () => {
  const page = await file("app/page.tsx");
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

test("data wali diisolasi berdasarkan email yang terhubung", async () => {
  const [bootstrap, portal, studentCard, migration] = await Promise.all([
    file("app/api/bootstrap/route.ts"),
    file("app/api/portal/route.ts"),
    file("app/api/student-card/route.ts"),
    file("drizzle/0003_new_sprite.sql"),
  ]);

  assert.match(bootstrap, /lower\(s\.guardian_email\)=\?/);
  assert.match(bootstrap, /guardianMessages/);
  assert.match(portal, /canAccessStudent/);
  assert.match(portal, /lower\(guardian_email\)=lower\(\?\)/);
  assert.match(studentCard, /guardian_email/);
  assert.match(migration, /ADD `guardian_email`/);
  assert.match(migration, /CREATE TABLE `guardian_messages`/);
});

test("pembayaran wali memeriksa kepemilikan tagihan", async () => {
  const payment = await file("app/api/integrations/route.ts");
  assert.match(payment, /user\.role === "Wali Santri"/);
  assert.match(payment, /b\.id=\? AND lower\(s\.guardian_email\)=lower\(\?\)/);
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
    file("app/page.tsx"),
  ]);
  assert.match(requestRoute, /crypto\.randomUUID/);
  assert.match(requestRoute, /status='Digunakan'/);
  assert.match(qrRoute, /SINURMAN:REQUEST:/);
  assert.match(page, /Validasi QR/);
});

test("logo dan tombol bantuan sidebar memiliki aksi", async () => {
  const page = await file("app/page.tsx");
  assert.match(page, /className="brand-home"[\s\S]*onClick=/);
  assert.match(page, /className="sidebar-help"[\s\S]*setShowHelp\(true\)/);
  assert.match(page, /PUSAT BANTUAN SINURMAN/);
});

test("PPDB online menyediakan formulir dan pelacakan status untuk wali", async () => {
  const [page, bootstrap] = await Promise.all([
    file("app/page.tsx"),
    file("app/api/bootstrap/route.ts"),
  ]);
  assert.match(page, /PPDB ONLINE 2026\/2027/);
  assert.match(page, /Kirim Pendaftaran/);
  assert.match(page, /Kelola Dokumen/);
  assert.match(page, /Catatan verifikator/);
  assert.match(page, /new Set<PageKey>\(\["dashboard","penerimaan","portalwali"\]\)/);
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

test("dashboard menginisialisasi database dan dapat dibuka semua peran", async () => {
  const [lib, page, bootstrap] = await Promise.all([
    file("app/api/_lib.ts"),
    file("app/page.tsx"),
    file("app/api/bootstrap/route.ts"),
  ]);
  assert.match(lib, /ensureDatabaseSchema/);
  assert.match(lib, /CREATE TABLE IF NOT EXISTS students/);
  assert.match(lib, /PRAGMA table_info/);
  assert.match(page, /new Set<PageKey>\(\["dashboard","penerimaan","portalwali"\]\)/);
  assert.doesNotMatch(page, /if\(result\.user\.role==="Wali Santri"\) setPage\("portalwali"\)/);
  assert.match(page, /aria-label="Kembali ke dashboard"/);
  assert.match(lib, /UPDATE users SET role='Admin'/);
  assert.match(lib, /const ownerEmail = "baikganteng88@gmail.com"/);
  assert.match(lib, /identity\.email\.toLowerCase\(\) === ownerEmail/);
  assert.match(bootstrap, /const safe = async/);
  assert.match(page, /setRole\("Admin"\)/);
});

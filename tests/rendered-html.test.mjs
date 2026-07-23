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

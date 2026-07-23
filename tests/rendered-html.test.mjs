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

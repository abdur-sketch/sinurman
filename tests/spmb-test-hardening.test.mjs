import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("SPMB test snapshots protect historical questions", async () => {
  const [schema, admin, portal] = await Promise.all([
    read("app/api/_lib.ts"), read("app/api/admissions/test/route.ts"), read("app/api/spmb/track/test/route.ts"),
  ]);
  assert.match(schema, /snapshot_json/);
  assert.match(admin, /Soal yang sudah ditugaskan tidak dapat diubah/);
  assert.match(admin, /snapshot_json/);
  assert.match(portal, /snapshot_json/);
});

test("SPMB submission is server-locked and atomic", async () => {
  const source = await read("app/api/spmb/track/test/route.ts");
  assert.match(source, /database\(\)\.batch\(\[/);
  assert.match(source, /submitted_at='' AND status IN/);
  assert.match(source, /new Set\(ids\)\.size !== ids\.length/);
  assert.match(source, /Jawaban memuat soal yang tidak ditugaskan/);
  assert.match(source, /Menunggu Pengesahan/);
});

test("SPMB test APIs enforce admin and OTP portal boundaries", async () => {
  const [admin, portal, proxy] = await Promise.all([
    read("app/api/admissions/test/route.ts"), read("app/api/spmb/track/test/route.ts"), read("proxy.ts"),
  ]);
  assert.match(admin, /ensureUser/);
  assert.match(admin, /requirePermission\(user, "admissions"\)/);
  assert.match(portal, /spmb_portal_session/);
  assert.match(proxy, /spmb_portal_session/);
  const otp = await read("app/api/spmb/track/start/route.ts");
  assert.match(otp, /SPMB_OTP_MOCK/);
  assert.match(otp, /\^TEST-\|\^QA-/i);
  assert.doesNotMatch(otp, /return Response\.json\(\{[^}]*code/);
});

test("SPMB result publication is explicit and audited", async () => {
  const source = await read("app/api/admissions/test/route.ts");
  assert.match(source, /submitted_at<>'' AND published=0/);
  assert.match(source, /publication\[0\]\?\.meta\.changes/);
  assert.match(source, /database\(\)\.batch\(\[/);
  assert.match(source, /published=1/);
  assert.match(source, /Publikasi Tes SPMB/);
  assert.match(source, /result_status/);
});

test("SPMB admin supports guarded CSV workflow and result inspection", async () => {
  const source = await read("app/api/admissions/test/route.ts");
  assert.match(source, /parseCsv/);
  assert.match(source, /Maksimal 500 soal per impor/);
  assert.match(source, /soal duplikat dengan bank soal/);
  assert.match(source, /format.*template/);
  assert.match(source, /params\.get\("detail"/);
  assert.match(source, /params\.get\("stats"\)/);
  assert.match(source, /correct_option/);
});

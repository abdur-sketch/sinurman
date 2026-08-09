import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),"utf8");

test("owner identity is configured outside application source",async()=>{
  const [config,session,users]=await Promise.all([read("lib/security-config.ts"),read("lib/firebase/session.ts"),read("app/api/admin-users/route.ts")]);
  assert.match(config,/SINURMAN_OWNER_EMAIL/);
  assert.doesNotMatch(`${session}\n${users}`,/baikganteng88@gmail\.com/);
});

test("admin mutations require MFA while enrollment remains reachable",async()=>{
  const source=await read("app/api/_lib.ts");
  assert.match(source,/MFA_REQUIRED/);
  assert.match(source,/\/api\/account-security/);
  assert.match(source,/multiFactor\?\.enrolledFactors/);
  assert.match(source,/pathname==="\/api\/guardian-accounts"&&isOwnerEmail\(user\.email\)/);
});

test("scheduled backups are authenticated and carry integrity metadata",async()=>{
  const [backup,scheduler,service,proxy]=await Promise.all([read("app/api/backup/route.ts"),read("app/api/maintenance/backup/route.ts"),read("lib/backup-service.ts"),read("proxy.ts")]);
  assert.match(`${backup}\n${service}`,/sha256/);
  assert.match(service,/manifest\.json/);
  assert.match(scheduler,/CRON_SECRET/);
  assert.match(scheduler,/CRON_SECRET\?\?""\)\.trim\(\)/);
  assert.match(scheduler,/automaticBackupDue/);
  assert.match(proxy,/\/api\/maintenance\/backup/);
});

test("guardian queries expose only published governed records",async()=>{
  const source=await read("app/api/bootstrap/route.ts");
  for(const alias of ["t","m","h","c","a","g"]) assert.match(source,new RegExp(`${alias}\\.workflow_status='Dipublikasikan'`));
});

test("academic periods block locked edits and track pending publication",async()=>{
  const [records,periods]=await Promise.all([read("app/api/records/route.ts"),read("app/api/academic-periods/route.ts")]);
  assert.match(records,/assertPeriodOpen/);
  assert.match(records,/Periode .* sudah dikunci/);
  assert.match(periods,/pending_records/);
  assert.match(periods,/Kunci Periode/);
});

test("Firebase Hosting menyediakan domain web.app menuju backend produksi",async()=>{
  const [configSource,adminSession,api]=await Promise.all([
    read("firebase.json"),read("lib/firebase/session.ts"),read("app/api/_lib.ts"),
  ]);
  const config=JSON.parse(configSource);
  assert.equal(config.hosting.site,"sinurman-2026");
  assert.deepEqual(config.hosting.rewrites,[{
    source:"**",
    run:{serviceId:"sinurman",region:"asia-southeast1"},
  }]);
  assert.match(adminSession,/FIREBASE_RUNTIME === "true" \? "__session"/);
  assert.match(api,/FIREBASE_RUNTIME === "true" \? "__session"/);
});

test("navigasi seluler hanya merender modul yang tersedia untuk peran aktif",async()=>{
  const dashboard=await read("app/dashboard-client.tsx");
  assert.match(dashboard,/visibleNavGroups\.flatMap\(group=>group\.items\)\.filter/);
  assert.match(dashboard,/mobileNavItems\.map\(item=>/);
  assert.doesNotMatch(dashboard,/navGroups\[2\]\.items\[1\]/);
});

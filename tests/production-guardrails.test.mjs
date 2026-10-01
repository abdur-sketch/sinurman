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

test("Firestore mutations sanitize SQL NULL fields before persistence",async()=>{
  const source=await read("lib/firebase/firestore-d1.ts");
  assert.match(source,/const sanitizedAfter=cleanRows\(after\)/);
  assert.match(source,/new Map\(sanitizedAfter\.map/);
});

test("navigasi seluler hanya merender modul yang tersedia untuk peran aktif",async()=>{
  const dashboard=await read("app/dashboard-client.tsx");
  assert.match(dashboard,/visibleNavGroups\.flatMap\(group=>group\.items\)\.filter/);
  assert.match(dashboard,/mobileNavItems\.map\(item=>/);
  assert.doesNotMatch(dashboard,/navGroups\[2\]\.items\[1\]/);
});

test("pembersihan demo tidak menghapus inventaris berdasarkan nama",async()=>{
  const [cleanup,lib]=await Promise.all([read("app/api/cleanup-demo/route.ts"),read("app/api/_lib.ts")]);
  assert.match(cleanup,/seed_source='development-demo'/);
  assert.doesNotMatch(cleanup,/DELETE FROM inventory_items WHERE name IN/);
  assert.match(lib,/seed_source TEXT NOT NULL DEFAULT ''/);
  assert.match(lib,/development-demo/);
});

test("granular user permissions are role-bounded and enforced server-side",async()=>{
  const [lib,users,records,bootstrap,dashboard]=await Promise.all([
    read("app/api/_lib.ts"),read("app/api/admin-users/route.ts"),read("app/api/records/route.ts"),read("app/api/bootstrap/route.ts"),read("app/dashboard-client.tsx"),
  ]);
  assert.match(lib,/hasPermission|requirePermission|defaultPermissions/);
  assert.match(lib,/permission_json/);
  assert.match(lib,/permission_json AS permissionJson/);
  assert.match(lib,/typeof value !== "string" \|\| !value\.trim\(\)/);
  assert.match(lib,/if \(role === "Admin"\) return \[\.\.\.TOOL_PERMISSIONS\]/);
  assert.match(users,/USER_PERMISSION_UPDATED/);
  assert.match(users,/Gunakan Default Role|defaultPermissions/);
  assert.match(records,/requirePermission\(user,permission\)/);
  assert.match(bootstrap,/const visible|hasPermission/);
  assert.match(dashboard,/permissionGroups/);
  assert.match(dashboard,/Gunakan Default Role/);
});

test("struktur role internal baru konsisten dan migrasi lama aman",async()=>{
  const [lib,users,schema,session,records,attendance,bootstrap]=await Promise.all([
    read("app/api/_lib.ts"),read("app/api/admin-users/route.ts"),read("db/schema.ts"),read("lib/firebase/session.ts"),read("app/api/records/route.ts"),read("app/api/attendance-qr/route.ts"),read("app/api/bootstrap/route.ts"),
  ]);
  for (const role of ["Admin","Kepala UPT","Yayasan","Bendahara","Sekolahan","Kesantrian","Tendik"]) {
    assert.match(lib,new RegExp(role.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")));
    assert.match(`${lib}\n${users}`,new RegExp(role.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")));
  }
  assert.match(users,/const managedRoles = new Set<Role>\(INTERNAL_ROLES\)/);
  assert.match(lib,/role_review_required/);
  assert.match(lib,/UPDATE users SET role_review_required=0 WHERE role='Admin'/);
  assert.match(lib,/UPDATE users SET role_review_required=1 WHERE role=\?/);
  assert.match(lib,/permission_json/);
  assert.match(schema,/Kepala UPT.*Yayasan.*Bendahara.*Sekolahan.*Kesantrian.*Tendik/);
  assert.match(session,/Kepala UPT.*Yayasan.*Bendahara.*Sekolahan.*Kesantrian.*Tendik/);
  assert.match(records,/role === "Kesantrian"/);
  assert.match(attendance,/user\.role === "Kesantrian"/);
  assert.match(bootstrap,/user\.role === "Kesantrian"/);
  assert.match(users,/USER_ROLE_UPDATED/);
});

test("room scope internal opsional dan permission tetap menjadi gate",async()=>{
  const [page,users,records,attendance,bootstrap,exportRoute]=await Promise.all([
    read("app/dashboard-client.tsx"),read("app/api/admin-users/route.ts"),read("app/api/records/route.ts"),read("app/api/attendance-qr/route.ts"),read("app/api/bootstrap/route.ts"),read("app/api/export/route.ts"),
  ]);
  assert.match(page,/Kamar\/asrama penugasan \(opsional\)/);
  assert.match(page,/Semua kamar \/ Tidak dibatasi/);
  assert.doesNotMatch(page,/required=\{roomAssignmentRequired\}/);
  assert.doesNotMatch(users,/Kamar\/asrama penugasan wajib/);
  assert.match(records,/if \(user\.role === "Kesantrian" && user\.roomScope\)/);
  assert.match(attendance,/user\.role === "Kesantrian"&&user\.roomScope/);
  assert.match(bootstrap,/Boolean\(user\.roomScope\)/);
  assert.match(exportRoute,/user\.role==="Kesantrian"&&Boolean\(user\.roomScope\)/);
  assert.match(records,/requirePermission\(user,permission\)/);
});

test("kalender menolak direct URL tanpa sesi",async()=>{
  const proxy=await read("proxy.ts");
  assert.match(proxy,/matcher: \["\/api\/:path\*", "\/kalender"\]/);
  assert.match(proxy,/status: 401/);
});

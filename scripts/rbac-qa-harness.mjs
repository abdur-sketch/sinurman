/**
 * Local-only RBAC verification harness.
 *
 * This script intentionally refuses to run unless Firebase Auth and Firestore
 * emulators are selected. It creates ordinary Firebase email/password users,
 * obtains ID tokens through the emulator, and establishes sessions through the
 * real /api/firebase-auth endpoint. No headers, impersonation, or production
 * services are used.
 */
import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { DatabaseSync } from "node:sqlite";

const appUrl = process.env.RBAC_QA_BASE_URL || "http://127.0.0.1:3000";
const projectId = process.env.RBAC_QA_PROJECT_ID || process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || "";
const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST || "";
const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST || "";
if (process.env.RBAC_QA_EMULATOR !== "true" || !projectId || !authHost.startsWith("127.0.0.1:") || !firestoreHost.startsWith("127.0.0.1:")) {
  throw new Error("Refusing to run: set RBAC_QA_EMULATOR=true with local demo Firebase Auth/Firestore emulators.");
}

const suffix = `${Date.now()}`;
const password = `QaOnly${suffix}A1`;
const fixtures = [
  { key: "admin", name: "RBAC QA Admin", phone: `62870000${suffix.slice(-6)}`, role: "Admin", permissions: [] },
  { key: "kesantrianA", name: "RBAC QA Kesantrian A", phone: `62871000${suffix.slice(-6)}`, role: "Kesantrian", permissions: ["students", "rooms", "reports"] },
  { key: "kesantrianB", name: "RBAC QA Kesantrian B", phone: `62872000${suffix.slice(-6)}`, role: "Kesantrian", permissions: ["students", "reports"] },
  { key: "bendahara", name: "RBAC QA Bendahara", phone: `62873000${suffix.slice(-6)}`, role: "Bendahara", permissions: ["finance", "sinurpay"] },
  { key: "sekolahan", name: "RBAC QA Sekolahan", phone: `62874000${suffix.slice(-6)}`, role: "Sekolahan", permissions: ["students", "classes", "academic"] },
  { key: "tendik", name: "RBAC QA Tendik", phone: `62875000${suffix.slice(-6)}`, role: "Tendik", permissions: ["employees"] },
  { key: "zero", name: "RBAC QA Zero", phone: `62876000${suffix.slice(-6)}`, role: "Kesantrian", permissions: [] },
];

const accounts = new Map();
const result = { checks: [], failures: [] };
const qaSqlite = new DatabaseSync(process.env.RBAC_QA_DB_PATH || ".wrangler/rbac-qa.sqlite");

function clearLocalDb() {
  const tables = qaSqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().map((row) => row.name);
  for (const table of tables) qaSqlite.prepare(`DELETE FROM "${String(table).replaceAll('"', '""')}"`).run();
}

function insertLocalUser(id, fixture, email) {
  qaSqlite.prepare("INSERT OR REPLACE INTO users (id,email,phone,name,role,room_scope,permission_json,role_review_required,created_at) VALUES (?,?,?,?,?,?,?,?,?)")
    .run(id, email, fixture.phone || "", fixture.name, fixture.role, "", JSON.stringify(fixture.permissions), 0, new Date().toISOString());
}
function check(name, condition, detail = "") {
  const item = { name, status: condition ? "PASS" : "FAIL", detail };
  result.checks.push(item);
  if (!condition) result.failures.push(item);
  if (!condition) throw new Error(`${name}: ${detail || "assertion failed"}`);
}

function adminSdk() {
  const app = getApps()[0] || initializeApp({ credential: applicationDefault(), projectId });
  return { auth: getAuth(app), firestore: getFirestore(app) };
}

function internalEmail(phone) { return `${phone}@internal.sinurman.local`; }

async function authCreate(email, displayName) {
  const { auth } = adminSdk();
  try { return await auth.createUser({ email, password, displayName, emailVerified: true }); }
  catch (error) {
    if (String(error?.code) === "auth/email-already-exists") return auth.getUserByEmail(email);
    throw error;
  }
}

async function signIn(email) {
  const response = await fetch(`http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(`Auth emulator sign-in failed (${response.status})`);
  return body.idToken;
}

async function establish(email) {
  const idToken = await signIn(email);
  const response = await fetch(`${appUrl}/api/firebase-auth`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  const body = await response.json();
  const cookie = response.headers.get("set-cookie")?.split(";", 1)[0] || "";
  if (!response.ok || !cookie) throw new Error(`Firebase session creation failed (${response.status}): ${body?.error || "unknown"}`);
  return { cookie, email, idToken, body };
}

async function api(path, options = {}, session) {
  const headers = new Headers(options.headers || {});
  if (session?.cookie) headers.set("cookie", session.cookie);
  const response = await fetch(`${appUrl}${path}`, { ...options, headers });
  let body = null;
  try { body = await response.json(); } catch { /* non-JSON response */ }
  return { response, body };
}

async function seedAdmin() {
  const admin = fixtures[0];
  const account = await authCreate("qa-admin@qa.local", admin.name);
  const { firestore } = adminSdk();
  await firestore.collection("_d1_tables").doc("users").collection("rows").doc("id-1").set({
    data: { id: 1, email: "qa-admin@qa.local", phone: "", name: admin.name, role: "Admin", room_scope: "", permission_json: "", role_review_required: 0, created_at: new Date().toISOString() },
    updatedAt: new Date().toISOString(),
  });
  accounts.set(admin.key, { ...admin, email: "qa-admin@qa.local", uid: account.uid });
  insertLocalUser(1, admin, "qa-admin@qa.local");
}

async function createFixtureAccounts() {
  const { firestore } = adminSdk();
  for (const [index, fixture] of fixtures.slice(1).entries()) {
    const email = internalEmail(fixture.phone);
    const account = await authCreate(email, fixture.name);
    const id = index + 2;
    await firestore.collection("_d1_tables").doc("users").collection("rows").doc(`id-${id}`).set({
      data: { id, email, phone: fixture.phone, name: fixture.name, role: fixture.role, room_scope: "", permission_json: JSON.stringify(fixture.permissions), role_review_required: 0, created_at: new Date().toISOString() },
      updatedAt: new Date().toISOString(),
    });
    accounts.set(fixture.key, { ...fixture, email, uid: account.uid, id });
    insertLocalUser(id, fixture, email);
  }
}

async function sessionFor(key) {
  const fixture = accounts.get(key);
  if (!fixture) throw new Error(`Unknown fixture ${key}`);
  await authCreate(fixture.email, fixture.name);
  const session = await establish(fixture.email);
  accounts.set(key, { ...fixture, session });
  return session;
}

async function testBootstrap(key, expected) {
  const session = await sessionFor(key);
  const { response, body } = await api("/api/bootstrap", {}, session);
  check(`${key} bootstrap authenticated`, response.status === 200, `HTTP ${response.status}`);
  check(`${key} permission set`, JSON.stringify([...(body?.user?.permissionIds || [])].sort()) === JSON.stringify([...expected].sort()), JSON.stringify(body?.user?.permissionIds || []));
  return { session, body };
}

async function mutate(session, resource, data = {}) {
  return api("/api/records", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "create", resource, data }) }, session);
}

async function publicRegistration(key, name, phone, options = {}) {
  const payload = {
    name,
    nisn: options.nisn || `NISN-${suffix}-${name.replace(/\W/g, "").slice(-4)}`,
    birth_place: "Bandar Lampung",
    birth_date: "2012-01-01",
    gender: "Laki-laki",
    desired_level: options.level || "SMP",
    guardian_name: "Wali QA",
    guardian_phone: phone,
    previous_school: "SD QA",
    address: "Alamat QA",
    submission_id: key,
  };
  return api("/api/ppdb", { method: "POST", headers: { "content-type": "application/json", "Idempotency-Key": key }, body: JSON.stringify(payload) });
}


async function remove(session, resource, id) {
  if (!id) return;
  await api("/api/records", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "delete", resource, id }) }, session);
}

async function run() {
  const health = await api("/api/health?qa=1");
  check("local QA database ready", health.response.status === 200, `HTTP ${health.response.status}`);
  clearLocalDb();
  const ppdbKey = `qa-spmb-${suffix}`;
  const firstPpdb = await publicRegistration(ppdbKey, "QA Calon Satu", `62879000${suffix.slice(-5)}`);
  check("SPMB one submit creates one registration", firstPpdb.response.status === 201, `HTTP ${firstPpdb.response.status}`);
  const replayPpdb = await publicRegistration(ppdbKey, "QA Calon Satu", `62879000${suffix.slice(-5)}`);
  check("SPMB sequential replay is idempotent", replayPpdb.response.status === 200 && replayPpdb.body?.id === firstPpdb.body?.id, `HTTP ${replayPpdb.response.status}`);
  const concurrent = await Promise.all(Array.from({ length: 5 }, () => publicRegistration(ppdbKey, "QA Calon Satu", `62879000${suffix.slice(-5)}`)));
  check("SPMB five concurrent requests create one registration", concurrent.every((item) => [200, 201].includes(item.response.status)) && new Set(concurrent.map((item) => item.body?.id)).size === 1, JSON.stringify(concurrent.map((item) => item.response.status)));
  const different = await publicRegistration(`qa-spmb-different-${suffix}`, "QA Calon Dua", `62879001${suffix.slice(-5)}`);
  check("two distinct SPMB applicants remain separate", different.response.status === 201 && different.body?.id !== firstPpdb.body?.id, `HTTP ${different.response.status}`);
  const businessDuplicate = await publicRegistration(`qa-spmb-new-key-${suffix}`, "QA Calon Satu", `62879000${suffix.slice(-5)}`);
  check("same applicant new submission is business-blocked", businessDuplicate.response.status === 409 && businessDuplicate.body?.code === "DUPLICATE_BLOCKED", `HTTP ${businessDuplicate.response.status}`);
  const anonymousCalendar = await api("/api/academic-events");
  check("anonymous calendar API denied", anonymousCalendar.response.status === 401, `HTTP ${anonymousCalendar.response.status}`);
  await seedAdmin();
  const adminSession = await establish("qa-admin@qa.local");
  accounts.get("admin").session = adminSession;
  const adminBootstrap = await api("/api/bootstrap", {}, adminSession);
  check("Admin Pusat bootstrap allowed", adminBootstrap.response.status === 200, `HTTP ${adminBootstrap.response.status}`);
  check("Admin Pusat full permissions", (adminBootstrap.body?.user?.permissionIds || []).length >= 20, "full permission list missing");
  const adminCalendar = await api("/api/academic-events", {}, adminSession);
  check("Admin Pusat calendar API allowed", adminCalendar.response.status === 200, `HTTP ${adminCalendar.response.status}`);
  await createFixtureAccounts();

  const a = await testBootstrap("kesantrianA", ["students", "rooms", "reports"]);
  check("Kesantrian A students visible", Array.isArray(a.body.students), "students payload missing");
  check("Kesantrian A rooms visible", Array.isArray(a.body.rooms), "rooms payload missing");
  check("Kesantrian A finance isolated", Array.isArray(a.body.transactions) && a.body.transactions.length === 0, "finance data leaked");
  const room = await mutate(a.session, "rooms", { name: `QA Room ${suffix}`, capacity: 20, supervisor: "QA", status: "Aktif" });
  check("Kesantrian A rooms API allowed", room.response.status === 201, `HTTP ${room.response.status}${room.body?.error ? `: ${room.body.error}` : ""}`);
  await remove(a.session, "rooms", room.body?.id);
  const financeDenied = await mutate(a.session, "transactions", { student_id: 0, type: "Masuk", category: "QA", amount: 1, status: "Lunas", note: "QA", recorded_at: new Date().toISOString() });
  check("Kesantrian A finance API denied", financeDenied.response.status === 403, `HTTP ${financeDenied.response.status}${financeDenied.body?.error ? `: ${financeDenied.body.error}` : ""}`);
  const aCalendar = await api("/api/academic-events", {}, a.session);
  check("Kesantrian A calendar API denied", aCalendar.response.status === 403, `HTTP ${aCalendar.response.status}`);

  const b = await testBootstrap("kesantrianB", ["students", "reports"]);
  check("Kesantrian B rooms isolated", Array.isArray(b.body.rooms) && b.body.rooms.length === 0, "rooms data leaked");
  const bRoom = await mutate(b.session, "rooms", { name: `QA Room B ${suffix}`, capacity: 20, supervisor: "QA", status: "Aktif" });
  check("Kesantrian B rooms API denied", bRoom.response.status === 403, `HTTP ${bRoom.response.status}${bRoom.body?.error ? `: ${bRoom.body.error}` : ""}`);

  const bendahara = await testBootstrap("bendahara", ["finance", "sinurpay"]);
  check("Bendahara students isolated", Array.isArray(bendahara.body.students) && bendahara.body.students.length === 0, "students data leaked");
  const tx = await mutate(bendahara.session, "transactions", { student_id: 0, type: "Masuk", category: "QA", amount: 1, status: "Lunas", note: "QA", recorded_at: new Date().toISOString() });
  check("Bendahara finance API allowed", tx.response.status === 201, `HTTP ${tx.response.status}${tx.body?.error ? `: ${tx.body.error}` : ""}`);
  await remove(bendahara.session, "transactions", tx.body?.id);

  const sekolahan = await testBootstrap("sekolahan", ["students", "classes", "academic"]);
  check("Sekolahan finance isolated", Array.isArray(sekolahan.body.transactions) && sekolahan.body.transactions.length === 0, "finance data leaked");
  const klass = await mutate(sekolahan.session, "classes", { name: `QA ${suffix}`, education_level: "SMP", grade_order: 7, capacity: 20, academic_year: "2026/2027", status: "Aktif" });
  check("Sekolahan classes API allowed", klass.response.status === 201, `HTTP ${klass.response.status}${klass.body?.error ? `: ${klass.body.error}` : ""}`);
  await remove(sekolahan.session, "classes", klass.body?.id);

  const tendik = await testBootstrap("tendik", ["employees"]);
  check("Tendik students isolated", Array.isArray(tendik.body.students) && tendik.body.students.length === 0, "students data leaked");
  const inventory = await mutate(tendik.session, "inventory", { name: `QA Item ${suffix}`, location: "QA", quantity: 1, unit: "pcs", condition: "Baik", updated_at: new Date().toISOString() });
  check("Tendik inventory API allowed", inventory.response.status === 201, `HTTP ${inventory.response.status}${inventory.body?.error ? `: ${inventory.body.error}` : ""}`);
  await remove(tendik.session, "inventory", inventory.body?.id);

  const zero = await testBootstrap("zero", []);
  const zeroStudents = await mutate(zero.session, "students", { name: "QA", nis: `QA-${suffix}`, class_name: "VII A", room: "QA", guardian_name: "QA", guardian_phone: "628123456789" });
  check("Zero-permission students API denied", zeroStudents.response.status === 403, `HTTP ${zeroStudents.response.status}${zeroStudents.body?.error ? `: ${zeroStudents.body.error}` : ""}`);

  // Verify server-side session revocation through the real account-security
  // flow (the Admin mutation endpoint additionally requires production MFA).
  const secondAdmin = await establish("qa-admin@qa.local");
  const sessions = await api("/api/account-security", {}, adminSession);
  const other = sessions.body?.sessions?.find((item) => !item.current);
  check("Admin session inventory available", sessions.response.status === 200 && Boolean(other?.id), `HTTP ${sessions.response.status}`);
  const revoked = await api("/api/account-security", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ sessionId: other.id }) }, adminSession);
  check("session revocation succeeds", revoked.response.status === 200, `HTTP ${revoked.response.status}`);
  const revokedCheck = await api("/api/bootstrap", {}, secondAdmin);
  check("revoked session denied", revokedCheck.response.status === 401, `HTTP ${revokedCheck.response.status}`);

  const root = await api("/");
  check("authenticated app shell available", root.response.status === 200, `HTTP ${root.response.status}`);
}

try {
  await run();
  console.log(JSON.stringify({ status: "VERIFIED PASS", checks: result.checks.length, failures: result.failures.length }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ status: "FAILED — NEEDS FIX", error: error instanceof Error ? error.message : String(error), checks: result.checks, failures: result.failures }, null, 2));
  process.exitCode = 1;
} finally {
  try {
    const { auth, firestore } = adminSdk();
    if (process.env.RBAC_QA_KEEP_DATA !== "true") {
      for (const fixture of fixtures) {
        const email = fixture.key === "admin" ? "qa-admin@qa.local" : internalEmail(fixture.phone);
        try { const account = await auth.getUserByEmail(email); await auth.deleteUser(account.uid); } catch { /* already removed */ }
      }
    }
    // Emulator-only cleanup endpoint. It cannot address production projects.
    if (process.env.RBAC_QA_KEEP_DATA !== "true") {
      await fetch(`http://127.0.0.1:8080/emulator/v1/projects/${projectId}/databases/(default)/documents`, { method: "DELETE" }).catch(() => undefined);
      clearLocalDb();
    }
    void firestore;
  } catch { /* cleanup must not hide the test result */ }
}

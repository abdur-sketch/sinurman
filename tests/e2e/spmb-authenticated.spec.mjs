import { test, expect } from "@playwright/test";
import { DatabaseSync } from "node:sqlite";
import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const otp = process.env.SINURMAN_STAGING_TEST_OTP_CODE || "246810";
const adminEmail = "qa-spmb-admin@sinurman-e2e.local";
const password = "QaOnlySpmbE2E9!";
const dbPath = process.env.RBAC_QA_DB_PATH || ".wrangler/spmb-e2e.sqlite";

function adminSdk() {
  const app = getApps()[0] || initializeApp({ credential: applicationDefault(), projectId: "sinurman-e2e" });
  return { auth: getAuth(app), firestore: getFirestore(app) };
}

async function seedFixtures(suffix) {
  const { auth, firestore } = adminSdk();
  let user;
  try { user = await auth.createUser({ email: adminEmail, password, displayName: "QA SPMB Admin", emailVerified: true }); }
  catch { user = await auth.getUserByEmail(adminEmail); }
  await firestore.collection("_d1_tables").doc("users").collection("rows").doc("id-1").set({
    data: { id: 1, email: adminEmail, phone: "", name: "QA SPMB Admin", role: "Admin", room_scope: "", permission_json: "", role_review_required: 0, created_at: new Date().toISOString() },
    updatedAt: new Date().toISOString(),
  });
  const db = new DatabaseSync(dbPath);
  const now = new Date().toISOString();
  const registrationNo = `STG-E2E-${suffix}`;
  db.prepare("INSERT OR IGNORE INTO admissions (registration_no,name,applicant_email,nisn,birth_place,birth_date,gender,desired_level,guardian_name,guardian_phone,previous_school,address,status,score,verification_note,public_note,internal_note,result_published_at,verified_by,verified_at,tracking_token,idempotency_key,registration_requirement_version,wave,test_date,test_time,test_location,student_id,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
    .run(registrationNo, `QA Calon SPMB ${suffix}`, "", `STG-NISN-${suffix}`, "Bandar Lampung", "2012-01-01", "Laki-laki", "SMP", "QA Wali", `62870000${suffix}`, "SD QA", "Alamat QA", "Terverifikasi", 0, "", "", "", "", "", "", `stg-e2e-token-${suffix}`, `stg-e2e-key-${suffix}`, 2, "Gelombang 1", "", "", "", null, now);
  const admission = db.prepare("SELECT id FROM admissions WHERE registration_no=?").get(registrationNo);
  return { user, registrationNo, admissionId: Number(admission.id), prompt: `Berapakah 2 + 2? (${suffix})` };
}

async function adminSession(request) {
  const signIn = await request.post("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key", { data: { email: adminEmail, password, returnSecureToken: true } });
  expect(signIn.ok()).toBeTruthy();
  const { idToken } = await signIn.json();
  const session = await request.post(`${baseURL}/api/firebase-auth`, { data: { idToken } });
  expect(session.ok()).toBeTruthy();
  return session.headers()["set-cookie"].split(";", 1)[0];
}

test.describe.serial("authenticated SPMB flow in isolated QA", () => {
  let adminCookie;
  let assignmentId;
  let questionId;
  let registrationNo;
  let admissionId;
  let questionPrompt;

  test.beforeAll(async ({ request }, testInfo) => {
    await request.get(`${baseURL}/api/health?e2e=1`);
    const suffix = testInfo.project.name.replace(/[^a-z0-9]/gi, "").slice(0, 10).toUpperCase();
    ({ registrationNo, admissionId, prompt: questionPrompt } = await seedFixtures(suffix));
    adminCookie = await adminSession(request);
  });

  test("admin creates question and assigns scheduled test", async ({ page }) => {
    await page.context().addCookies([{ name: "sinurman_admin_session", value: adminCookie.split("=", 2)[1], domain: "127.0.0.1", path: "/" }]);
    await page.goto("/spmb/tes/admin");
    await expect(page.getByText("Soal Tes Calon Santri")).toBeVisible();
    await page.getByLabel("Pertanyaan").fill(questionPrompt);
    await page.getByRole("textbox", { name: "Opsi jawaban" }).fill("3\n4\n5");
    await page.getByLabel("Jawaban benar").fill("4");
    await page.getByRole("button", { name: "Tambah Soal" }).click();
    await expect(page.getByRole("checkbox", { name: new RegExp(questionPrompt.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) }).first()).toBeVisible();
    const questionResponse = await page.request.get("/api/admissions/test");
    const questionData = await questionResponse.json();
    questionId = questionData.questions.find((item) => item.prompt === questionPrompt).id;
    await page.getByLabel("Calon santri").selectOption({ value: String(admissionId) });
    await page.getByRole("checkbox", { name: questionPrompt }).first().check();
    await page.getByLabel("Durasi (menit)").fill("10");
    await page.getByRole("button", { name: "Tugaskan Soal" }).click();
    await expect(page.getByText("Soal berhasil ditugaskan")).toBeVisible();
    const assignments = await (await page.request.get("/api/admissions/test")).json();
    assignmentId = assignments.assignments.find((item) => item.admission_id === admissionId).id;
    expect(assignmentId).toBeTruthy();
    expect(questionId).toBeTruthy();
  });

  test("participant authenticates with mock OTP, refreshes, submits, and sees only published result", async ({ browser, request }) => {
    const start = await request.post(`${baseURL}/api/spmb/track/start`, { data: { registrationNo } });
    expect(start.ok()).toBeTruthy();
    const { challengeId } = await start.json();
    const verify = await request.post(`${baseURL}/api/spmb/track/verify`, { data: { challengeId, code: otp } });
    expect(verify.ok()).toBeTruthy();
    const portalCookie = verify.headers()["set-cookie"].split(";", 1)[0];
    const participant = await browser.newContext();
    await participant.addCookies([{ name: "spmb_portal_session", value: portalCookie.split("=", 2)[1], domain: "127.0.0.1", path: "/" }]);
    const page = await participant.newPage();
    await page.goto("/spmb/tes");
    await expect(page.getByText(questionPrompt)).toBeVisible();
    await page.getByLabel("4").check();
    await page.waitForTimeout(750);
    await page.reload();
    await expect(page.getByLabel("4")).toBeChecked();
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Kirim Jawaban" }).click();
    await expect(page.getByText("Menunggu pengesahan admin.")).toBeVisible();
    const replay = await page.request.post("/api/spmb/track/test", { data: { answers: [{ question_id: questionId, answer: "4" }] } });
    expect(replay.status()).toBe(409);
    await expect(page.getByText(/Hasil menunggu pengesahan admin/)).toBeVisible();
    await participant.close();
  });

  test("admin publishes result and a second participant cannot access it", async ({ request }) => {
    const response = await request.patch(`${baseURL}/api/admissions/test`, { headers: { cookie: adminCookie }, data: { action: "publish", assignment_id: assignmentId } });
    expect(response.ok()).toBeTruthy();
    const { challengeId } = await (await request.post(`${baseURL}/api/spmb/track/start`, { data: { registrationNo } })).json();
    const verify = await request.post(`${baseURL}/api/spmb/track/verify`, { data: { challengeId, code: otp } });
    expect(verify.ok()).toBeTruthy();
    const cookie = verify.headers()["set-cookie"].split(";", 1)[0];
    const status = await request.get(`${baseURL}/api/spmb/track/status`, { headers: { cookie } });
    expect(status.ok()).toBeTruthy();
    const body = await status.json();
    expect(body.admission.score).toBe(100);
    expect(body.admission.status).toBe("Lulus");
    expect(body.admission.verification_note).toContain("Hasil tes tersedia");
    const other = await request.get(`${baseURL}/api/spmb/track/status`, { headers: { cookie: "spmb_portal_session=invalid" } });
    expect(other.status()).toBe(401);
  });
});

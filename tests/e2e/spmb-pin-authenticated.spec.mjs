import { test, expect } from "@playwright/test";
import { DatabaseSync } from "node:sqlite";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const adminEmail = "qa-spmb-admin@sinurman-e2e.local";
const dbPath = process.env.RBAC_QA_DB_PATH || ".wrangler/spmb-e2e.sqlite";

test.describe.serial("registration PIN QA in isolated emulator", () => {
  let adminCookie;
  let registrationNo;
  let admissionId;
  let initialPin;

  test.beforeAll(async ({ request }) => {
    const db = new DatabaseSync(dbPath);
    const now = new Date().toISOString();
    registrationNo = `STG-PIN-${Date.now()}`;
    db.prepare("INSERT INTO admissions (registration_no,name,applicant_email,nisn,birth_place,birth_date,gender,desired_level,guardian_name,guardian_phone,previous_school,address,status,score,verification_note,public_note,internal_note,result_published_at,verified_by,verified_at,tracking_token,idempotency_key,registration_requirement_version,wave,test_date,test_time,test_location,student_id,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
      .run(registrationNo, "QA Peserta PIN", "", `NISN-${Date.now()}`, "QA", "2012-01-01", "Laki-laki", "SMP", "QA Wali", "628700001234", "SD QA", "Alamat QA", "Terverifikasi", 0, "", "", "", "", "", "", `token-${Date.now()}`, `key-${Date.now()}`, 2, "Gelombang 1", "", "", "", null, now);
    admissionId = Number(db.prepare("SELECT id FROM admissions WHERE registration_no=?").get(registrationNo).id);
    const auth = await request.post("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key", { data: { email: adminEmail, password: "QaOnlySpmbE2E9!", returnSecureToken: true } });
    expect(auth.ok()).toBeTruthy();
    const { idToken } = await auth.json();
    const session = await request.post(`${baseURL}/api/firebase-auth`, { data: { idToken } });
    expect(session.ok()).toBeTruthy();
    adminCookie = session.headers()["set-cookie"].split(";", 1)[0];
  });

  test("admin issues PIN, participant logs in, and cross-account access is denied", async ({ request, page }) => {
    const issue = await request.post(`${baseURL}/api/admissions/pin`, { headers: { cookie: adminCookie }, data: { admissionId, action: "activate" } });
    expect(issue.ok()).toBeTruthy();
    const issued = await issue.json(); initialPin = issued.pin;
    expect(initialPin).toMatch(/^\d{8}$/);
    const login = await request.post(`${baseURL}/api/spmb/pin/login`, { data: { registrationNo, pin: initialPin } });
    expect(login.ok()).toBeTruthy();
    const cookie = login.headers()["set-cookie"].split(";", 1)[0];
    const status = await request.get(`${baseURL}/api/spmb/track/status`, { headers: { cookie } });
    expect(status.status()).toBe(200);
    const body = await status.json(); expect(body.admission.registration_no).toBe(registrationNo);
    const other = await request.get(`${baseURL}/api/spmb/track/status`, { headers: { cookie: "spmb_portal_session=invalid" } });
    expect(other.status()).toBe(401);
    await page.goto("/spmb/lacak");
    await expect(page.getByText("PIN peserta")).toBeVisible();
  });

  test("wrong PIN locks account and admin reset invalidates old PIN", async ({ request }) => {
    for (let attempt = 0; attempt < 5; attempt++) {
      const response = await request.post(`${baseURL}/api/spmb/pin/login`, { data: { registrationNo, pin: "00000000" } });
      expect(response.status()).toBe(401);
    }
    const locked = await request.post(`${baseURL}/api/spmb/pin/login`, { data: { registrationNo, pin: initialPin } });
    expect(locked.status()).toBe(401);
    const reset = await request.post(`${baseURL}/api/admissions/pin`, { headers: { cookie: adminCookie }, data: { admissionId, action: "reset" } });
    expect(reset.ok()).toBeTruthy();
    const nextPin = (await reset.json()).pin;
    const old = await request.post(`${baseURL}/api/spmb/pin/login`, { data: { registrationNo, pin: initialPin } });
    expect(old.status()).toBe(401);
    const next = await request.post(`${baseURL}/api/spmb/pin/login`, { data: { registrationNo, pin: nextPin } });
    expect(next.ok()).toBeTruthy();
  });
});

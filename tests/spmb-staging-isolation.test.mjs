import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { firebaseRuntimeTargets, STAGING } from "../lib/firebase/runtime-isolation.mjs";

const base = {
  FIREBASE_RUNTIME: "true",
  SINURMAN_RUNTIME_ENV: "staging",
  K_SERVICE: STAGING.cloudRunService,
  FIREBASE_PROJECT_ID: STAGING.projectId,
  FIREBASE_FIRESTORE_DATABASE_ID: STAGING.firestoreDatabaseId,
  FIREBASE_STORAGE_BUCKET: STAGING.storageBucket,
  SINURMAN_STAGING_DATABASE_CONFIRMED: "isolated",
  SINURMAN_STAGING_BUCKET_CONFIRMED: "isolated",
  SINURMAN_STAGING_SECRETS_CONFIRMED: "isolated",
  SINURMAN_STAGING_SERVICE_CONFIRMED: "isolated",
  SINURMAN_STAGING_SITE_CONFIRMED: "isolated",
  SINURMAN_STAGING_OTP_MODE: "mock",
};

test("legacy production remains on the default Firestore database", () => {
  assert.deepEqual(firebaseRuntimeTargets({ FIREBASE_STORAGE_BUCKET: "sinurman-2026.firebasestorage.app" }), {
    mode: "production", databaseId: "(default)", bucket: "sinurman-2026.firebasestorage.app",
  });
});

test("staging Cloud Run rejects missing runtime mode before accessing default production data", () => {
  assert.throws(
    () => firebaseRuntimeTargets({ ...base, SINURMAN_RUNTIME_ENV: undefined }),
    /must explicitly set SINURMAN_RUNTIME_ENV=staging/
  );
  assert.throws(
    () => firebaseRuntimeTargets({ ...base, SINURMAN_RUNTIME_ENV: "production" }),
    /must explicitly set SINURMAN_RUNTIME_ENV=staging/
  );
});

test("production cannot unintentionally switch to named staging database", () => {
  assert.throws(() => firebaseRuntimeTargets({ FIREBASE_FIRESTORE_DATABASE_ID: "spmb-staging" }), /requires SINURMAN_RUNTIME_ENV=staging/);
});

test("staging requires exactly the approved named database and bucket", () => {
  assert.deepEqual(firebaseRuntimeTargets(base), { mode: "staging", databaseId: "spmb-staging", bucket: "sinurman-2026-spmb-staging" });
  for (const key of ["FIREBASE_PROJECT_ID", "FIREBASE_FIRESTORE_DATABASE_ID", "FIREBASE_STORAGE_BUCKET", "FIREBASE_RUNTIME"]) {
    const invalid = { ...base, [key]: "" };
    assert.throws(() => firebaseRuntimeTargets(invalid), /Unsafe SINURMAN staging configuration/, key);
  }
});

test("staging rejects production bucket, broad service JSON, and emulator flags", () => {
  assert.throws(() => firebaseRuntimeTargets({ ...base, FIREBASE_STORAGE_BUCKET: "sinurman-2026.firebasestorage.app" }), /Unsafe/);
  assert.throws(() => firebaseRuntimeTargets({ ...base, FIREBASE_SERVICE_ACCOUNT_JSON: "{}" }), /forbidden/);
  assert.throws(() => firebaseRuntimeTargets({ ...base, RBAC_QA_EMULATOR: "true" }), /not allowed/);
  assert.throws(() => firebaseRuntimeTargets({ ...base, K_SERVICE: "sinurman" }), /Cloud Run service must be/);
  assert.throws(() => firebaseRuntimeTargets({ ...base, SINURMAN_STAGING_OTP_MODE: "" }), /requires mock OTP/);
});

test("read-only staging preflight blocks even when manual confirmations are omitted", () => {
  const file = fileURLToPath(new URL("../scripts/spmb-staging-preflight.mjs", import.meta.url));
  const result = spawnSync(process.execPath, [file], { env: { ...base, SINURMAN_STAGING_DATABASE_CONFIRMED: "" }, encoding: "utf8" });
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stdout, /NO-GO/);
});

test("read-only preflight is only an attestation, never a deployment", () => {
  const file = fileURLToPath(new URL("../scripts/spmb-staging-preflight.mjs", import.meta.url));
  const result = spawnSync(process.execPath, [file], { env: base, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /PREFLIGHT ONLY/);
  assert.match(result.stdout, /NOT independently verified/);
});

test("staging Hosting rewrites only to its own Cloud Run service", async () => {
  const production = JSON.parse(await readFile(new URL("../firebase.json", import.meta.url)));
  const staging = JSON.parse(await readFile(new URL("../firebase.staging.json", import.meta.url)));
  assert.equal(production.hosting.site, "sinurman-2026");
  assert.equal(production.hosting.rewrites[0].run.serviceId, "sinurman");
  assert.equal(staging.hosting.site, "sinurman-2026-staging");
  assert.equal(staging.hosting.rewrites.length, 1);
  assert.equal(staging.hosting.rewrites[0].run.serviceId, STAGING.cloudRunService);
  assert.equal(staging.firestore, undefined);
  assert.equal(staging.storage, undefined);
  assert.equal(staging.apphosting, undefined);
});

test("Admin SDK routes staging to named Firestore rather than default", async () => {
  const source = await readFile(new URL("../lib/firebase/admin.ts", import.meta.url), "utf8");
  assert.match(source, /getFirestore\(app,targets\.databaseId\)/);
  assert.match(source, /firebaseRuntimeTargets\(env\)/);
  assert.match(source, /storageBucket:qaEmulator \? undefined : env\.FIREBASE_STORAGE_BUCKET/);
});

test("staging OTP route does not send WhatsApp or expose the test code", async () => {
  const source = await readFile(new URL("../app/api/spmb/track/start/route.ts", import.meta.url), "utf8");
  assert.match(source, /firebaseRuntimeTargets\(runtime\)/);
  assert.match(source, /SINURMAN_STAGING_TEST_OTP_CODE/);
  assert.match(source, /if \(!staging\) \{/);
  assert.match(source, /registrationNo\.startsWith\("STG-"\)/);
  assert.doesNotMatch(source, /return Response\.json\(\{[^\n]*code\b/);
});

/**
 * Pure runtime guard. This is a configuration gate, NOT proof of cloud IAM isolation.
 * Staging reuses the Firebase project but must never fall back to its default data.
 */
export const STAGING = Object.freeze({
  projectId: "sinurman-2026",
  firestoreDatabaseId: "spmb-staging",
  storageBucket: "sinurman-2026-spmb-staging",
  cloudRunService: "sinurman-spmb-staging",
});

export function firebaseRuntimeTargets(env) {
  const mode = env.SINURMAN_RUNTIME_ENV || "production";
  const localE2E = env.SINURMAN_E2E_HARNESS === "true";
  if (localE2E) {
    const violations = [];
    const loopback = (value) => /^(127\.0\.0\.1|localhost):\d+$/.test(String(value || ""));
    if (env.FIREBASE_RUNTIME === "true") violations.push("FIREBASE_RUNTIME must be false");
    if (env.RBAC_QA_EMULATOR !== "true") violations.push("RBAC_QA_EMULATOR must be true");
    if (env.RBAC_QA_PROJECT_ID === "sinurman-2026" || env.FIREBASE_PROJECT_ID === "sinurman-2026") violations.push("production project is forbidden");
    if (!loopback(env.FIREBASE_AUTH_EMULATOR_HOST)) violations.push("Auth emulator must use loopback");
    if (!loopback(env.FIRESTORE_EMULATOR_HOST)) violations.push("Firestore emulator must use loopback");
    if (!loopback(env.FIREBASE_STORAGE_EMULATOR_HOST)) violations.push("Storage emulator must use loopback");
    if (env.K_SERVICE) violations.push("Cloud Run is forbidden");
    if (env.FIREBASE_SERVICE_ACCOUNT_JSON) violations.push("service account credentials are forbidden");
    if (env.SINURMAN_STAGING_OTP_MODE !== "mock") violations.push("mock OTP mode is required");
    if (violations.length) throw new Error("Unsafe local E2E configuration: " + violations.join("; "));
    return { mode: "qa-e2e", databaseId: "qa-sqlite", bucket: "qa-local" };
  }
  // Cloud Run supplies K_SERVICE independently of app env settings. Treat a
  // staging service with missing SINURMAN_RUNTIME_ENV as a fatal error, not prod.
  if (env.K_SERVICE === STAGING.cloudRunService && mode !== "staging") {
    throw new Error("Staging Cloud Run must explicitly set SINURMAN_RUNTIME_ENV=staging.");
  }
  if (env.SINURMAN_STAGING_OTP_MODE === "mock" && mode !== "staging") {
    throw new Error("Mock OTP configuration is forbidden in production mode.");
  }
  if (mode !== "production" && mode !== "staging") {
    throw new Error("SINURMAN_RUNTIME_ENV must be production or staging.");
  }
  const databaseId = env.FIREBASE_FIRESTORE_DATABASE_ID?.trim() || "(default)";
  const bucket = env.FIREBASE_STORAGE_BUCKET?.trim() || "";

  if (mode === "staging") {
    const violations = [];
    if (env.FIREBASE_RUNTIME !== "true") violations.push("FIREBASE_RUNTIME must be true");
    if (env.FIREBASE_PROJECT_ID !== STAGING.projectId) violations.push("Firebase project must be sinurman-2026");
    if (databaseId !== STAGING.firestoreDatabaseId) violations.push("named Firestore database must be spmb-staging");
    if (bucket !== STAGING.storageBucket) violations.push("staging Storage bucket is missing or incorrect");
    if (env.FIREBASE_SERVICE_ACCOUNT_JSON) violations.push("JSON service account credentials are forbidden in staging: use a dedicated Cloud Run runtime identity");
    if (env.RBAC_QA_EMULATOR === "true") violations.push("QA emulator flag is not allowed on deployed staging");
    if (env.K_SERVICE !== STAGING.cloudRunService) violations.push("Cloud Run service must be sinurman-spmb-staging");
    if (env.SINURMAN_STAGING_OTP_MODE !== "mock") violations.push("Staging requires mock OTP delivery mode");
    if (violations.length) throw new Error("Unsafe SINURMAN staging configuration: " + violations.join("; "));
    return { mode, databaseId, bucket };
  }
  if (databaseId !== "(default)") {
    throw new Error("Named Firestore database requires SINURMAN_RUNTIME_ENV=staging.");
  }
  return { mode, databaseId, bucket };
}

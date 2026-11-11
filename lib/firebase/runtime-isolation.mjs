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
    if (env.K_SERVICE && env.K_SERVICE !== STAGING.cloudRunService) violations.push("Cloud Run service is not the staging service");
    if (violations.length) throw new Error("Unsafe SINURMAN staging configuration: " + violations.join("; "));
    return { mode, databaseId, bucket };
  }
  if (databaseId !== "(default)") {
    throw new Error("Named Firestore database requires SINURMAN_RUNTIME_ENV=staging.");
  }
  return { mode, databaseId, bucket };
}

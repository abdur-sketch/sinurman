/**
 * Fail-closed guard for non-production Firebase runtimes.
 * Production keeps its existing explicit project configuration; staging/QA
 * must provide an explicit, non-production project, bucket, and credential.
 */
/** @param {Record<string, string | undefined>} runtimeEnv */
export function assertRuntimeIsolation(runtimeEnv = process.env) {
  const environment = runtimeEnv.SINURMAN_ENV || runtimeEnv.FIREBASE_RUNTIME_ENV || "production";
  const projectId = runtimeEnv.FIREBASE_PROJECT_ID || "";
  const bucket = runtimeEnv.FIREBASE_STORAGE_BUCKET || "";
  const productionProject = "sinurman-2026";
  const productionBucket = "sinurman-2026.firebasestorage.app";
  if (environment === "production") return { environment, projectId, bucket };
  if (environment === "qa" && runtimeEnv.RBAC_QA_EMULATOR === "true") return { environment, projectId, bucket };
  if (!projectId || !bucket || !runtimeEnv.FIREBASE_SERVICE_ACCOUNT_JSON) {
    throw new Error("Firebase staging menolak start: project, bucket, dan service account staging wajib diisi.");
  }
  if (projectId === productionProject || bucket === productionBucket || projectId.endsWith("-prod")) {
    throw new Error("Firebase staging menolak start: konfigurasi menunjuk resource production.");
  }
  let serviceAccount;
  try { serviceAccount = JSON.parse(runtimeEnv.FIREBASE_SERVICE_ACCOUNT_JSON); } catch { throw new Error("Firebase staging menolak start: service account JSON tidak valid."); }
  if (!serviceAccount?.project_id || serviceAccount.project_id !== projectId) throw new Error("Firebase staging menolak start: service account berbeda dengan project staging.");
  return { environment, projectId, bucket };
}

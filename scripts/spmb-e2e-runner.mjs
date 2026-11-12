import { spawn } from "node:child_process";

const waitForServer = async () => {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch("http://127.0.0.1:3000/api/health");
      if (response.status === 200 || response.status === 503) return;
    } catch { /* server is still starting */ }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("Local E2E server did not start.");
};

const env = {
  ...process.env,
  FIREBASE_RUNTIME: "false",
  RBAC_QA_EMULATOR: "true",
  SINURMAN_E2E_HARNESS: "true",
  RBAC_QA_PROJECT_ID: "sinurman-e2e",
  FIREBASE_PROJECT_ID: "sinurman-e2e",
  FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
  FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
  FIREBASE_STORAGE_EMULATOR_HOST: "127.0.0.1:9199",
  SINURMAN_STAGING_OTP_MODE: "mock",
  SINURMAN_STAGING_TEST_OTP_CODE: process.env.SINURMAN_STAGING_TEST_OTP_CODE || "246810",
};
const server = spawn(process.execPath, ["scripts/spmb-e2e-server.mjs"], { env, stdio: "inherit" });
try {
  await waitForServer();
  const child = spawn(process.execPath, ["node_modules/.bin/playwright", "test", "--config=playwright.auth.config.mjs"], { env, stdio: "inherit" });
  const code = await new Promise((resolve) => child.on("exit", (value, signal) => resolve(value ?? (signal ? 1 : 0))));
  process.exitCode = Number(code);
} finally {
  server.kill("SIGTERM");
}

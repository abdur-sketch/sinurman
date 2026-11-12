import net from "node:net";
import { rmSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";

const root = process.cwd();
const dbPath = path.join(root, ".wrangler", "spmb-e2e.sqlite");
const required = [
  ["FIREBASE_AUTH_EMULATOR_HOST", "127.0.0.1:9099"],
  ["FIRESTORE_EMULATOR_HOST", "127.0.0.1:8080"],
  ["FIREBASE_STORAGE_EMULATOR_HOST", "127.0.0.1:9199"],
];

function available(address) {
  return new Promise((resolve) => {
    const [host, port] = address.split(":");
    const socket = net.createConnection({ host, port: Number(port) });
    socket.once("connect", () => { socket.destroy(); resolve(true); });
    socket.once("error", () => { socket.destroy(); resolve(false); });
    socket.setTimeout(800, () => { socket.destroy(); resolve(false); });
  });
}

if (process.env.NODE_ENV === "production" || process.env.FIREBASE_RUNTIME === "true") {
  throw new Error("Refusing local E2E server in production/Firebase runtime mode.");
}
for (const [key, fallback] of required) {
  const value = process.env[key] || fallback;
  if (!/^(127\.0\.0\.1|localhost):\d+$/.test(value) || !(await available(value))) {
    throw new Error(`${key} must point to an active loopback Firebase emulator.`);
  }
}

rmSync(dbPath, { force: true });
const env = {
  ...process.env,
  FIREBASE_RUNTIME: "false",
  RBAC_QA_EMULATOR: "true",
  SINURMAN_E2E_HARNESS: "true",
  RBAC_QA_PROJECT_ID: "sinurman-e2e",
  FIREBASE_PROJECT_ID: "sinurman-e2e",
  FIREBASE_AUTH_EMULATOR_HOST: process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099",
  FIRESTORE_EMULATOR_HOST: process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080",
  FIREBASE_STORAGE_EMULATOR_HOST: process.env.FIREBASE_STORAGE_EMULATOR_HOST || "127.0.0.1:9199",
  SINURMAN_STAGING_OTP_MODE: "mock",
  SINURMAN_STAGING_TEST_OTP_CODE: process.env.SINURMAN_STAGING_TEST_OTP_CODE || "246810",
  RBAC_QA_DB_PATH: dbPath,
};
const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start"], { cwd: root, env, stdio: "inherit" });
child.on("exit", (code, signal) => process.exit(code ?? (signal ? 1 : 0)));

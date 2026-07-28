import { spawnSync } from "node:child_process";

const firebaseRuntime = process.env.FIREBASE_RUNTIME === "true";
const command = firebaseRuntime ? "next build" : "vinext build";
const environment = firebaseRuntime
  ? process.env
  : { ...process.env, WRANGLER_LOG_PATH: ".wrangler/wrangler.log" };

console.log(`Building SINURMAN for ${firebaseRuntime ? "Firebase App Hosting" : "Vinext"}.`);

const result = spawnSync(command, {
  cwd: process.cwd(),
  env: environment,
  shell: true,
  stdio: "inherit",
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);

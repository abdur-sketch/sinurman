import { readFile } from "node:fs/promises";

const required = [
  "FIREBASE_PROJECT_ID",
  "FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
];

let appHosting="";
try { appHosting=await readFile(new URL("../apphosting.yaml",import.meta.url),"utf8"); } catch { /* local environment may not use App Hosting */ }
function configured(key) {
  if(process.env[key])return true;
  const block=appHosting.match(new RegExp(`- variable: ${key}\\s+value: ["']?([^\\n"']+)`));
  return Boolean(block?.[1]?.trim());
}
const missing=required.filter(key=>!configured(key));
if(missing.length) {
  console.error(`Konfigurasi Firebase belum lengkap: ${missing.join(", ")}`);
  process.exitCode=1;
} else {
  console.log("Konfigurasi dasar Firebase SINURMAN lengkap.");
}

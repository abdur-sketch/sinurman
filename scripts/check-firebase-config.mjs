const required = [
  "FIREBASE_PROJECT_ID",
  "FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
];

const missing=required.filter(key=>!process.env[key]);
if(missing.length) {
  console.error(`Konfigurasi Firebase belum lengkap: ${missing.join(", ")}`);
  process.exitCode=1;
} else {
  console.log("Konfigurasi dasar Firebase SINURMAN lengkap.");
}

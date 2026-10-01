import { applicationDefault, cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

function serviceAccount() {
  const raw=process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if(!raw) return null;
  const parsed=JSON.parse(raw) as {project_id:string;client_email:string;private_key:string};
  return {
    projectId:parsed.project_id,
    clientEmail:parsed.client_email,
    privateKey:parsed.private_key.replace(/\\n/g,"\n"),
  };
}

export function firebaseAdminApp():App {
  const existing=getApps()[0];
  if(existing) return existing;
  const account=serviceAccount();
  // QA is deliberately pinned to the explicitly supplied local emulator
  // project so a test process cannot accidentally address production.
  // Read through a dynamic key so Next/Turbopack cannot inline the value from
  // the production .env.local while compiling the QA server.
  const runtimeEnv = Reflect.get(Reflect.get(globalThis, "process") as object, "env") as Record<string, string | undefined>;
  const qaEmulator = runtimeEnv.RBAC_QA_EMULATOR === "true";
  return initializeApp({
    credential:qaEmulator ? applicationDefault() : account?cert(account):applicationDefault(),
    projectId:qaEmulator ? (runtimeEnv.RBAC_QA_PROJECT_ID || "demo-sinurman") : process.env.FIREBASE_PROJECT_ID||process.env.GCLOUD_PROJECT,
    storageBucket:qaEmulator ? undefined : process.env.FIREBASE_STORAGE_BUCKET,
  });
}

export function firebaseAdmin() {
  const app=firebaseAdminApp();
  return {
    app,
    auth:getAuth(app),
    firestore:getFirestore(app),
    storage:getStorage(app),
  };
}

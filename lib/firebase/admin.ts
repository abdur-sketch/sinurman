import { applicationDefault, cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { firebaseRuntimeTargets } from "./runtime-isolation.mjs";

function runtimeEnv() {
  // Do not allow build-time substitution of production .env.local values in staging.
  return Reflect.get(Reflect.get(globalThis, "process") as object, "env") as Record<string, string | undefined>;
}

function serviceAccount() {
  const raw=runtimeEnv().FIREBASE_SERVICE_ACCOUNT_JSON;
  if(!raw) return null;
  const parsed=JSON.parse(raw) as {project_id:string;client_email:string;private_key:string};
  return {
    projectId:parsed.project_id,
    clientEmail:parsed.client_email,
    privateKey:parsed.private_key.replace(/\\n/g,"\n"),
  };
}

export function firebaseAdminApp():App {
  const env=runtimeEnv();
  const targets=firebaseRuntimeTargets(env); // fail closed BEFORE reusing an initialized Admin app
  const existing=getApps()[0];
  if(existing) {
    if(targets.mode==="staging" &&
       (existing.options.projectId!==env.FIREBASE_PROJECT_ID || existing.options.storageBucket!==targets.bucket)) {
      throw new Error("Existing Firebase Admin app is not configured for staging resources.");
    }
    return existing;
  }
  const qaEmulator=env.RBAC_QA_EMULATOR==="true";
  const account=serviceAccount();
  return initializeApp({
    credential:qaEmulator ? applicationDefault() : account ? cert(account) : applicationDefault(),
    projectId:qaEmulator ? (env.RBAC_QA_PROJECT_ID || "demo-sinurman") : env.FIREBASE_PROJECT_ID || env.GCLOUD_PROJECT,
    storageBucket:qaEmulator ? undefined : env.FIREBASE_STORAGE_BUCKET,
  });
}

export function firebaseAdmin() {
  const targets=firebaseRuntimeTargets(runtimeEnv());
  const app=firebaseAdminApp();
  return {
    app,
    auth:getAuth(app),
    // Explicitly use the named staging database; no implicit default DB fallback.
    firestore:targets.mode==="staging" ? getFirestore(app,targets.databaseId) : getFirestore(app),
    // getStorage(app).bucket() uses the bucket enforced above in staging.
    storage:getStorage(app),
  };
}

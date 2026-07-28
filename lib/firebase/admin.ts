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
  return initializeApp({
    credential:account?cert(account):applicationDefault(),
    projectId:process.env.FIREBASE_PROJECT_ID||process.env.GCLOUD_PROJECT,
    storageBucket:process.env.FIREBASE_STORAGE_BUCKET,
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

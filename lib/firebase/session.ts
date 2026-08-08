import { createHash, randomBytes } from "node:crypto";
import { firebaseAdmin } from "./admin";
import { isOwnerEmail } from "../security-config";

const cookieName = "sinurman_admin_session";
const sessionDays = 7;
const internalRoles = new Set(["Admin", "Kepala Asrama", "Musyrif", "Ustadz"]);

export type FirebaseSession = {
  uid:string;
  email:string;
  name:string;
  expiresAt:string;
  createdAt:string;
  lastSeenAt:string;
  userAgent:string;
  ipHash:string;
};

function sessionHash(token:string) { return createHash("sha256").update(token).digest("hex"); }

function cookieValue(request:Request) {
  const cookies=request.headers.get("cookie")??"";
  for(const part of cookies.split(";")) {
    const [name,...value]=part.trim().split("=");
    if(name===cookieName) return decodeURIComponent(value.join("="));
  }
  return "";
}

function requestFingerprint(request?:Request) {
  const userAgent=String(request?.headers.get("user-agent")??"Perangkat tidak diketahui").slice(0,180);
  const forwarded=String(request?.headers.get("x-forwarded-for")??request?.headers.get("x-real-ip")??"").split(",")[0].trim();
  return {userAgent,ipHash:forwarded?createHash("sha256").update(forwarded).digest("hex").slice(0,16):""};
}

async function internalAccess(email:string) {
  const firestore=firebaseAdmin().firestore;
  const [records,sharded,legacy]=await Promise.all([
    firestore.collection("_d1_tables").doc("users").collection("rows").get(),
    firestore.collection("_d1_tables").doc("users").get(),
    firestore.collection("_system").doc("d1-state-v1").get(),
  ]);
  const recordUsers=records.docs.map(document=>document.data().data) as Array<{email?:string;role?:string}>;
  const users=(recordUsers.length?recordUsers:sharded.data()?.rows??legacy.data()?.tables?.users??[]) as Array<{email?:string;role?:string}>;
  return users.find(user=>String(user.email??"").toLowerCase()===email&&internalRoles.has(String(user.role??"")));
}

export async function createFirebaseSession(idToken:string,request?:Request) {
  const decoded=await firebaseAdmin().auth.verifyIdToken(idToken,true);
  const email=String(decoded.email??"").trim().toLowerCase();
  if(!email||decoded.email_verified===false) throw new Error("Email Firebase belum terverifikasi.");
  const access=isOwnerEmail(email)?{role:"Admin"}:await internalAccess(email);
  if(!access) throw new Error("Akun belum diberi akses oleh Admin SINURMAN.");
  const firebaseClaims=decoded.firebase as {sign_in_second_factor?:string}|undefined;
  const firebaseUser=access.role==="Admin"?await firebaseAdmin().auth.getUser(decoded.uid):null;
  const enrolledMfa=Boolean(firebaseUser?.multiFactor?.enrolledFactors?.length);
  if(access.role==="Admin"&&enrolledMfa&&!firebaseClaims?.sign_in_second_factor) {
    throw new Error("Admin wajib menyelesaikan verifikasi dua langkah sebelum masuk.");
  }
  const token=Array.from(randomBytes(32),byte=>byte.toString(16).padStart(2,"0")).join("");
  const now=new Date();
  const session:FirebaseSession={
    uid:decoded.uid,email,name:String(decoded.name??email.split("@")[0]),
    expiresAt:new Date(now.getTime()+sessionDays*86400000).toISOString(),
    createdAt:now.toISOString(),lastSeenAt:now.toISOString(),...requestFingerprint(request),
  };
  await firebaseAdmin().firestore.collection("_auth_sessions").doc(sessionHash(token)).set(session);
  return {session,cookie:`${cookieName}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${sessionDays*86400}`};
}

export async function getFirebaseSession(request:Request) {
  const token=cookieValue(request);
  if(!token) return null;
  const reference=firebaseAdmin().firestore.collection("_auth_sessions").doc(sessionHash(token));
  const document=await reference.get();
  if(!document.exists) return null;
  const session=document.data() as FirebaseSession;
  if(!session.expiresAt||session.expiresAt<=new Date().toISOString()) {
    await reference.delete().catch(()=>undefined);return null;
  }
  if(!session.lastSeenAt||Date.now()-new Date(session.lastSeenAt).getTime()>5*60*1000) {
    await reference.update({lastSeenAt:new Date().toISOString()}).catch(()=>undefined);
  }
  return session;
}

export async function removeFirebaseSession(request:Request) {
  const token=cookieValue(request);
  if(token) await firebaseAdmin().firestore.collection("_auth_sessions").doc(sessionHash(token)).delete().catch(()=>undefined);
  return `${cookieName}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export async function revokeFirebaseSessions(uid:string) {
  if(!uid) return;
  const snapshot=await firebaseAdmin().firestore.collection("_auth_sessions").where("uid","==",uid).get();
  if(snapshot.empty) return;
  const batch=firebaseAdmin().firestore.batch();
  snapshot.docs.forEach(document=>batch.delete(document.ref));
  await batch.commit();
}

export async function listFirebaseSessions(request:Request,uid:string) {
  const current=sessionHash(cookieValue(request));
  const snapshot=await firebaseAdmin().firestore.collection("_auth_sessions").where("uid","==",uid).get();
  return snapshot.docs.map(document=>{
    const session=document.data() as FirebaseSession;
    return {id:document.id,current:document.id===current,createdAt:session.createdAt,lastSeenAt:session.lastSeenAt,expiresAt:session.expiresAt,userAgent:session.userAgent||"Perangkat tidak diketahui",ipHash:session.ipHash||""};
  }).sort((a,b)=>String(b.lastSeenAt).localeCompare(String(a.lastSeenAt)));
}

export async function removeFirebaseSessionById(uid:string,sessionId:string) {
  const reference=firebaseAdmin().firestore.collection("_auth_sessions").doc(sessionId);
  const snapshot=await reference.get();
  if(!snapshot.exists||(snapshot.data() as FirebaseSession).uid!==uid) throw new Error("Sesi tidak ditemukan.");
  await reference.delete();
}

export async function rotateFirebaseSession(request:Request,idToken:string) {
  const current=await getFirebaseSession(request);
  if(!current) throw new Error("Sesi saat ini sudah berakhir. Silakan masuk kembali.");
  const decoded=await firebaseAdmin().auth.verifyIdToken(idToken,true);
  if(decoded.uid!==current.uid) throw new Error("Akun Firebase tidak sesuai dengan sesi aktif.");
  await revokeFirebaseSessions(current.uid);
  return createFirebaseSession(idToken,request);
}

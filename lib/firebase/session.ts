import { createHash, randomBytes } from "node:crypto";
import { firebaseAdmin } from "./admin";

const cookieName = "sinurman_admin_session";
const sessionDays = 7;
const ownerEmail = "baikganteng88@gmail.com";
const internalRoles = new Set(["Admin", "Kepala Asrama", "Musyrif", "Ustadz"]);

export type FirebaseSession = {
  uid: string;
  email: string;
  name: string;
  expiresAt: string;
};

function sessionHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function cookieValue(request: Request) {
  const cookies = request.headers.get("cookie") ?? "";
  for (const part of cookies.split(";")) {
    const [name, ...value] = part.trim().split("=");
    if (name === cookieName) return decodeURIComponent(value.join("="));
  }
  return "";
}

export async function createFirebaseSession(idToken: string) {
  const decoded = await firebaseAdmin().auth.verifyIdToken(idToken, true);
  const email = String(decoded.email ?? "").trim().toLowerCase();
  if (!email || decoded.email_verified === false) {
    throw new Error("Email Firebase belum terverifikasi.");
  }
  if (email !== ownerEmail) {
    const state = await firebaseAdmin().firestore.collection("_system").doc("d1-state-v1").get();
    const users = (state.data()?.tables?.users ?? []) as Array<{ email?: string; role?: string }>;
    const registered = users.some(
      user => String(user.email ?? "").toLowerCase() === email && internalRoles.has(String(user.role ?? "")),
    );
    if (!registered) {
      throw new Error("Akun belum diberi akses oleh Admin SINURMAN.");
    }
  }
  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + sessionDays * 24 * 60 * 60 * 1000);
  const session: FirebaseSession = {
    uid: decoded.uid,
    email,
    name: String(decoded.name ?? email.split("@")[0]),
    expiresAt: expiresAt.toISOString(),
  };
  await firebaseAdmin().firestore
    .collection("_auth_sessions")
    .doc(sessionHash(token))
    .set({ ...session, createdAt: now.toISOString() });
  return {
    session,
    cookie: `${cookieName}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${sessionDays * 86400}`,
  };
}

export async function getFirebaseSession(request: Request) {
  const token = cookieValue(request);
  if (!token) return null;
  const reference = firebaseAdmin().firestore.collection("_auth_sessions").doc(sessionHash(token));
  const document = await reference.get();
  if (!document.exists) return null;
  const session = document.data() as FirebaseSession;
  if (!session.expiresAt || session.expiresAt <= new Date().toISOString()) {
    await reference.delete().catch(() => undefined);
    return null;
  }
  return session;
}

export async function removeFirebaseSession(request: Request) {
  const token = cookieValue(request);
  if (token) {
    await firebaseAdmin().firestore
      .collection("_auth_sessions")
      .doc(sessionHash(token))
      .delete()
      .catch(() => undefined);
  }
  return `${cookieName}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export async function revokeFirebaseSessions(uid: string) {
  if (!uid) return;
  const snapshot = await firebaseAdmin().firestore
    .collection("_auth_sessions")
    .where("uid", "==", uid)
    .get();
  if (snapshot.empty) return;
  const batch = firebaseAdmin().firestore.batch();
  snapshot.docs.forEach(document => batch.delete(document.ref));
  await batch.commit();
}

export async function rotateFirebaseSession(request: Request, idToken: string) {
  const current = await getFirebaseSession(request);
  if (!current) throw new Error("Sesi saat ini sudah berakhir. Silakan masuk kembali.");
  const decoded = await firebaseAdmin().auth.verifyIdToken(idToken, true);
  if (decoded.uid !== current.uid) throw new Error("Akun Firebase tidak sesuai dengan sesi aktif.");
  await revokeFirebaseSessions(current.uid);
  return createFirebaseSession(idToken);
}

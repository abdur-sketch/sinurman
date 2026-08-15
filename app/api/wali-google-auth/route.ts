import { firebaseAdmin } from "../../../lib/firebase/admin";
import { database, createGuardianSession, ensureDatabaseSchema, randomHex } from "../_lib";

export const runtime = "nodejs";

function genericPending() {
  return Response.json(
    { error: "Akun Google belum terhubung atau belum disetujui Admin SINURMAN." },
    { status: 403 },
  );
}

export async function POST(request: Request) {
  try {
    await ensureDatabaseSchema();
    const body = await request.json() as { idToken?: string };
    const idToken = String(body.idToken ?? "").trim();
    if (!idToken) return Response.json({ error: "Token Google tidak tersedia." }, { status: 400 });

    const decoded = await firebaseAdmin().auth.verifyIdToken(idToken, true);
    const provider = String((decoded.firebase as { sign_in_provider?: string } | undefined)?.sign_in_provider ?? "");
    const email = String(decoded.email ?? "").trim().toLowerCase();
    if (provider !== "google.com" || !email || decoded.email_verified === false) {
      return Response.json({ error: "Gunakan akun Google dengan email yang sudah terverifikasi." }, { status: 401 });
    }

    const db = database();
    const linked = await db.prepare(
      `SELECT a.id,a.phone,a.status,a.google_uid AS googleUid
       FROM guardian_accounts a JOIN students s ON s.guardian_phone=a.phone
       WHERE lower(s.guardian_email)=? AND s.status='Aktif'
       ORDER BY a.id LIMIT 1`,
    ).bind(email).first<{ id:number; phone:string; status:string; googleUid:string }>();

    const studentLink = await db.prepare(
      "SELECT guardian_phone AS phone FROM students WHERE lower(guardian_email)=? AND status='Aktif' ORDER BY id LIMIT 1",
    ).bind(email).first<{ phone:string }>();

    const byGoogle = await db.prepare(
      "SELECT id,phone,status FROM guardian_accounts WHERE google_uid=? LIMIT 1",
    ).bind(decoded.uid).first<{ id:number; phone:string; status:string }>();
    let account = byGoogle ?? linked;
    if (!account && studentLink?.phone) {
      const existing = await db.prepare(
        "SELECT id,phone,status FROM guardian_accounts WHERE phone=? LIMIT 1",
      ).bind(studentLink.phone).first<{ id:number; phone:string; status:string }>();
      if (existing) {
        account = existing;
        if (existing.status === "Menunggu Persetujuan") {
          await db.prepare("UPDATE guardian_accounts SET google_uid=?,google_email=?,updated_at=? WHERE id=?")
            .bind(decoded.uid, email, new Date().toISOString(), existing.id).run();
        }
      } else {
        const now = new Date().toISOString();
        await db.prepare(
          `INSERT INTO guardian_accounts
           (phone,pin_hash,pin_salt,status,failed_attempts,locked_until,google_uid,google_email,created_at,updated_at)
           VALUES (?,?,?,'Menunggu Persetujuan',0,'',?,?,?,?)`,
        ).bind(studentLink.phone, randomHex(32), randomHex(16), decoded.uid, email, now, now).run();
        account = await db.prepare(
          "SELECT id,phone,status FROM guardian_accounts WHERE phone=? LIMIT 1",
        ).bind(studentLink.phone).first<{ id:number; phone:string; status:string }>();
      }
    }
    if (!account) return genericPending();
    if (account.status === "Diblokir") {
      return Response.json({ error: "Akun Portal Wali diblokir. Hubungi Admin pesantren." }, { status: 403 });
    }
    if (account.status !== "Aktif") return genericPending();

    const now = new Date().toISOString();
    await db.prepare(
      "UPDATE guardian_accounts SET google_uid=?,google_email=?,updated_at=? WHERE id=?",
    ).bind(decoded.uid, email, now, account.id).run();
    const session = await createGuardianSession(account.id);
    return Response.json(
      { ok:true, redirectTo:"/portal-wali", phone:account.phone },
      { headers:{ "set-cookie":session.cookie } },
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Login Google Portal Wali gagal." },
      { status: 401 },
    );
  }
}

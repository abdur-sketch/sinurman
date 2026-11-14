import { database, ensureDatabaseSchema } from "../../../_lib";
import { registrationPinEnabled, verifyRegistrationPin, validRegistrationPin } from "../../../../../lib/spmb-pin.mjs";

const runtimeEnv = () => Reflect.get(Reflect.get(globalThis, "process") as object, "env") as Record<string, string | undefined>;
const registration = (value: unknown) => String(value ?? "").trim().toUpperCase().slice(0, 50);
const cookieValue = (request: Request) => request.headers.get("cookie")?.match(/(?:^|; )spmb_portal_session=([^;]+)/)?.[1] || "";
const hashToken = async (value: string) => {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), (item) => item.toString(16).padStart(2, "0")).join("");
};

export async function POST(request: Request) {
  const env = runtimeEnv();
  if (!registrationPinEnabled(env)) return Response.json({ error: "Login PIN SPMB belum diaktifkan." }, { status: 404 });
  try {
    await ensureDatabaseSchema();
    const body = await request.json() as { registrationNo?: unknown; pin?: unknown };
    const registrationNo = registration(body.registrationNo);
    const pin = String(body.pin ?? "").trim();
    if (!registrationNo || !validRegistrationPin(pin)) return Response.json({ error: "Nomor pendaftaran atau PIN tidak valid." }, { status: 401 });
    const account = await database().prepare(
      "SELECT id,admission_id,registration_no,pin_hash,pin_salt,status,failed_attempts,locked_until FROM spmb_participant_accounts WHERE registration_no=?",
    ).bind(registrationNo).first<{ id:number; admission_id:number; registration_no:string; pin_hash:string; pin_salt:string; status:string; failed_attempts:number; locked_until:string }>();
    const now = new Date();
    if (!account || account.status !== "Aktif" || (account.locked_until && account.locked_until > now.toISOString())) return Response.json({ error: "Nomor pendaftaran atau PIN tidak valid." }, { status: 401 });
    const valid = await verifyRegistrationPin(pin, account.pin_hash, account.pin_salt);
    if (!valid) {
      const attempts = Number(account.failed_attempts || 0) + 1;
      const lockedUntil = attempts >= 5 ? new Date(now.getTime() + 15 * 60_000).toISOString() : "";
      await database().prepare("UPDATE spmb_participant_accounts SET failed_attempts=?,locked_until=?,updated_at=? WHERE id=?").bind(attempts >= 5 ? 0 : attempts, lockedUntil, now.toISOString(), account.id).run();
      await database().prepare("INSERT INTO audit_logs (user_email,action,resource,record_id,detail,created_at) VALUES (?,?,?,?,?,?)").bind("spmb-participant", "Login gagal", "spmb_participant_accounts", account.id, "PIN peserta ditolak", now.toISOString()).run();
      return Response.json({ error: "Nomor pendaftaran atau PIN tidak valid." }, { status: 401 });
    }
    const token = crypto.randomUUID() + crypto.randomUUID();
    const expires = new Date(now.getTime() + 30 * 60_000);
    await database().batch([
      database().prepare("DELETE FROM spmb_portal_sessions WHERE admission_id=? OR expires_at<=?").bind(account.admission_id, now.toISOString()),
      database().prepare("INSERT INTO spmb_portal_sessions (token_hash,admission_id,expires_at,created_at,last_seen_at) VALUES (?,?,?,?,?)").bind(await hashToken(token), account.admission_id, expires.toISOString(), now.toISOString(), now.toISOString()),
      database().prepare("UPDATE spmb_participant_accounts SET failed_attempts=0,locked_until='',last_login_at=?,updated_at=? WHERE id=?").bind(now.toISOString(), now.toISOString(), account.id),
      database().prepare("INSERT INTO audit_logs (user_email,action,resource,record_id,detail,created_at) VALUES (?,?,?,?,?,?)").bind("spmb-participant", "Login berhasil", "spmb_participant_accounts", account.id, "Login PIN peserta berhasil", now.toISOString()),
    ]);
    return Response.json({ ok: true }, { headers: { "set-cookie": `spmb_portal_session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=1800` } });
  } catch {
    return Response.json({ error: "Login peserta belum dapat diproses." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const token = cookieValue(request);
    if (token) {
      await database().prepare("DELETE FROM spmb_portal_sessions WHERE token_hash=?").bind(await hashToken(token)).run();
    }
  } catch { /* logout remains idempotent */ }
  return new Response(null, { status: 204, headers: { "set-cookie": "spmb_portal_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0" } });
}

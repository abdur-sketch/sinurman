import { database, ensureDatabaseSchema, ensureUser, requirePermission } from "../../_lib";
import { generateRegistrationPin, hashRegistrationPin } from "../../../../lib/spmb-pin.mjs";

export async function GET(request: Request) {
  try {
    const user = await ensureUser(request); requirePermission(user, "admissions"); await ensureDatabaseSchema();
    const admissionId = Number(new URL(request.url).searchParams.get("admissionId"));
    if (!admissionId) return Response.json({ error: "Pendaftar tidak valid." }, { status: 400 });
    const row = await database().prepare("SELECT a.id,a.registration_no,a.name,a.status,p.status AS pin_status,p.failed_attempts,p.locked_until,p.last_login_at FROM admissions a LEFT JOIN spmb_participant_accounts p ON p.admission_id=a.id WHERE a.id=?").bind(admissionId).first<Record<string, unknown>>();
    if (!row) return Response.json({ error: "Pendaftar tidak ditemukan." }, { status: 404 });
    return Response.json({ account: { admissionId: row.id, registrationNo: row.registration_no, name: row.name, admissionStatus: row.status, status: row.pin_status || "Belum diaktifkan", failedAttempts: Number(row.failed_attempts || 0), lockedUntil: row.locked_until || "", lastLoginAt: row.last_login_at || "" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error && error.message.startsWith("FORBIDDEN") ? "Akses ditolak." : "Akun PIN belum dapat dimuat." }, { status: 403 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await ensureUser(request); requirePermission(user, "admissions"); await ensureDatabaseSchema();
    const body = await request.json() as { admissionId?: unknown; action?: unknown };
    const admissionId = Number(body.admissionId);
    const action = String(body.action || "activate");
    if (!admissionId || !["activate", "reset", "lock", "unlock"].includes(action)) return Response.json({ error: "Tindakan PIN tidak valid." }, { status: 400 });
    const admission = await database().prepare("SELECT id,registration_no,name FROM admissions WHERE id=?").bind(admissionId).first<{id:number;registration_no:string;name:string}>();
    if (!admission) return Response.json({ error: "Pendaftar tidak ditemukan." }, { status: 404 });
    const now = new Date().toISOString();
    if (action === "lock" || action === "unlock") {
      await database().prepare("UPDATE spmb_participant_accounts SET status=?,locked_until=?,updated_at=? WHERE admission_id=?").bind(action === "lock" ? "Dikunci" : "Aktif", "", now, admissionId).run();
      await database().prepare("INSERT INTO audit_logs (user_email,action,resource,record_id,detail,created_at) VALUES (?,?,?,?,?,?)").bind(user.email, action === "lock" ? "Kunci" : "Buka Kunci", "spmb_participant_accounts", admissionId, `Akun PIN ${admission.registration_no}`, now).run();
      return Response.json({ ok: true, status: action === "lock" ? "Dikunci" : "Aktif" });
    }
    const pin = generateRegistrationPin();
    const hashed = await hashRegistrationPin(pin);
    await database().prepare(
      "INSERT INTO spmb_participant_accounts (admission_id,registration_no,pin_hash,pin_salt,status,failed_attempts,locked_until,created_at,updated_at,last_login_at) VALUES (?,?,?,?, 'Aktif',0,'',?,?, '') ON CONFLICT(admission_id) DO UPDATE SET registration_no=excluded.registration_no,pin_hash=excluded.pin_hash,pin_salt=excluded.pin_salt,status='Aktif',failed_attempts=0,locked_until='',updated_at=excluded.updated_at",
    ).bind(admission.id, admission.registration_no, hashed.hash, hashed.salt, now, now).run();
    await database().prepare("INSERT INTO audit_logs (user_email,action,resource,record_id,detail,created_at) VALUES (?,?,?,?,?,?)").bind(user.email, action === "reset" ? "Reset PIN" : "Aktivasi PIN", "spmb_participant_accounts", admission.id, `${admission.registration_no} · PIN diterbitkan`, now).run();
    return Response.json({ ok: true, registrationNo: admission.registration_no, pin, status: "Aktif" });
  } catch (error) {
    return Response.json({ error: error instanceof Error && error.message.startsWith("FORBIDDEN") ? "Akses ditolak." : "PIN peserta belum dapat diubah." }, { status: 403 });
  }
}

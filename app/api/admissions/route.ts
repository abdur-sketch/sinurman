import { database, ensureUser, normalizeGuardianPhone } from "../_lib";
import { sendWhatsappNotification } from "../_notifications";

const applicationStatuses = [
  "Pendaftaran",
  "Verifikasi Dokumen",
  "Perlu Perbaikan",
  "Terverifikasi",
  "Tes",
  "Lulus",
  "Tidak Lulus",
] as const;

function text(value: unknown) {
  return String(value ?? "").trim();
}

function registrationNumber() {
  const year = new Date().getFullYear();
  return `PPDB-${year}-${crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase()}`;
}

function normalizeName(value: unknown) {
  return text(value).toLocaleLowerCase("id-ID").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

async function auditAdmission(result: "CREATED" | "IDEMPOTENT_REPLAY" | "DUPLICATE_BLOCKED", key: string, registrationId: number | null, actor: string) {
  try {
    await database().prepare("INSERT INTO audit_logs (user_email,action,resource,record_id,detail,created_at) VALUES (?,?,?,?,?,?)")
      .bind(actor, "Pendaftaran", "admissions", registrationId, `${result} idempotency=${key ? `${key.slice(0, 10)}…` : "none"}`, new Date().toISOString()).run();
  } catch { /* audit is best-effort and never causes a second insert */ }
}

export async function POST(request: Request) {
  let requestKey = "";
  try {
    const user = await ensureUser(request);
    if (!["Admin", "Wali Santri"].includes(user.role)) {
      return Response.json({ error: "Anda tidak memiliki akses pendaftaran PPDB." }, { status: 403 });
    }
    const body = await request.json() as Record<string, unknown>;
    const required = ["name", "nisn", "birth_place", "birth_date", "gender", "desired_level", "guardian_name", "guardian_phone", "previous_school", "address"];
    const missing = required.find((field) => !text(body[field]));
    if (missing) return Response.json({ error: "Semua data calon santri wajib dilengkapi." }, { status: 400 });
    if (!["SMP", "SMK"].includes(text(body.desired_level))) {
      return Response.json({ error: "Jenjang pilihan tidak valid." }, { status: 400 });
    }
    const key = text(request.headers.get("Idempotency-Key") || body.submission_id).slice(0, 120);
    requestKey = key;
    if (key) {
      const replay = await database().prepare("SELECT id,registration_no FROM admissions WHERE idempotency_key=?")
        .bind(key).first<{ id:number; registration_no:string }>();
      if (replay) {
        await auditAdmission("IDEMPOTENT_REPLAY", key, replay.id, user.email);
        return Response.json({ ok: true, id: replay.id, registrationNo: replay.registration_no, message: "Pendaftaran sebelumnya sudah tersimpan. Tidak dibuat ulang." });
      }
    }
    const normalizedPhone = normalizeGuardianPhone(body.guardian_phone);
    const candidates = await database().prepare(
      "SELECT id,registration_no,name,created_at FROM admissions WHERE desired_level=? AND substr(created_at,1,4)=? AND guardian_phone=? ORDER BY id ASC",
    ).bind(text(body.desired_level), String(new Date().getUTCFullYear()), normalizedPhone).all<{ id:number; registration_no:string; name:string; created_at:string }>();
    const duplicate = candidates.results.find((row) => normalizeName(row.name) === normalizeName(body.name));
    const allowOfficialResubmission = user.role === "Admin" && body.allow_duplicate === true;
    if (duplicate && !allowOfficialResubmission) {
      await auditAdmission("DUPLICATE_BLOCKED", key, duplicate.id, user.email);
      return Response.json({ code: "DUPLICATE_BLOCKED", error: `Calon santri dengan data yang sama sudah terdaftar dengan No. Pendaftaran ${duplicate.registration_no}. Silakan periksa data sebelumnya.`, existing: { id: duplicate.id, registrationNo: duplicate.registration_no, createdAt: duplicate.created_at } }, { status: 409 });
    }

    const now = new Date().toISOString();
    const registrationNo = registrationNumber();
    const result = await database().prepare(
      `INSERT INTO admissions
       (registration_no,name,applicant_email,nisn,birth_place,birth_date,gender,desired_level,guardian_name,guardian_phone,previous_school,address,status,score,verification_note,verified_by,verified_at,idempotency_key,created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    ).bind(
      registrationNo,
      text(body.name),
      "",
      text(body.nisn),
      text(body.birth_place),
      text(body.birth_date),
      text(body.gender),
      text(body.desired_level),
      text(body.guardian_name),
      normalizedPhone,
      text(body.previous_school),
      text(body.address),
      "Pendaftaran",
      0,
      "",
      "",
      "", key || `legacy-${crypto.randomUUID()}`,
      now,
    ).run();
    const id = Number(result.meta.last_row_id);
    await auditAdmission("CREATED", key, id, user.email);

    return Response.json({
      ok: true,
      id,
      registrationNo,
      message: "Pendaftaran berhasil dibuat. Silakan lengkapi dokumen.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/unique index|UNIQUE constraint|already exists/i.test(message) && requestKey) {
      try {
        const replay = await database().prepare("SELECT id,registration_no FROM admissions WHERE idempotency_key=?").bind(requestKey).first<{ id:number; registration_no:string }>();
        if (replay) return Response.json({ ok: true, id: replay.id, registrationNo: replay.registration_no, message: "Pendaftaran sebelumnya sudah tersimpan. Tidak dibuat ulang." });
      } catch { /* return safe error below */ }
    }
    return Response.json({ error: error instanceof Error ? error.message : "Pendaftaran gagal disimpan." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await ensureUser(request);
    if (user.role !== "Admin") {
      return Response.json({ error: "Hanya admin yang dapat memverifikasi pendaftaran." }, { status: 403 });
    }
    const body = await request.json() as Record<string, unknown>;
    const id = Number(body.id);
    const status = text(body.status);
    const note = text(body.verification_note);
    const score = Math.max(0, Math.min(100, Number(body.score ?? 0)));
    const wave = text(body.wave) || "Gelombang 1";
    const testDate = text(body.test_date);
    const testTime = text(body.test_time);
    const testLocation = text(body.test_location);
    if (!id || !applicationStatuses.includes(status as typeof applicationStatuses[number])) {
      return Response.json({ error: "Data atau status verifikasi tidak valid." }, { status: 400 });
    }
    const admission = await database().prepare(
      "SELECT name,registration_no,guardian_phone FROM admissions WHERE id=?",
    ).bind(id).first<{ name: string; registration_no: string; guardian_phone: string }>();
    if (!admission) return Response.json({ error: "Pendaftaran tidak ditemukan." }, { status: 404 });

    const now = new Date().toISOString();
    await database().prepare(
      "UPDATE admissions SET status=?,score=?,verification_note=?,wave=?,test_date=?,test_time=?,test_location=?,verified_by=?,verified_at=? WHERE id=?",
    ).bind(status, score, note, wave, testDate, testTime, testLocation, user.email, now, id).run();
    await database().prepare(
      "INSERT INTO audit_logs (user_email,action,resource,record_id,detail,created_at) VALUES (?,?,?,?,?,?)",
    ).bind(user.email, "Verifikasi", "admissions", id, `${admission.registration_no} menjadi ${status}`, now).run();
    if (admission.guardian_phone) {
      await sendWhatsappNotification({
        recipient: admission.guardian_phone,
        message: `SINURMAN PPDB: Status ${admission.name} (${admission.registration_no}) kini ${status}.${note ? ` Catatan: ${note}` : ""}`,
      });
    }
    return Response.json({ ok: true, message: "Status pendaftaran berhasil diperbarui." });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Verifikasi gagal disimpan." }, { status: 500 });
  }
}

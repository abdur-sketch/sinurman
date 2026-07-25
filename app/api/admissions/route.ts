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

export async function POST(request: Request) {
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

    const now = new Date().toISOString();
    const registrationNo = registrationNumber();
    const result = await database().prepare(
      `INSERT INTO admissions
       (registration_no,name,applicant_email,nisn,birth_place,birth_date,gender,desired_level,guardian_name,guardian_phone,previous_school,address,status,score,verification_note,verified_by,verified_at,created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    ).bind(
      registrationNo,
      text(body.name),
      user.email.toLowerCase(),
      text(body.nisn),
      text(body.birth_place),
      text(body.birth_date),
      text(body.gender),
      text(body.desired_level),
      text(body.guardian_name),
      normalizeGuardianPhone(body.guardian_phone),
      text(body.previous_school),
      text(body.address),
      "Pendaftaran",
      0,
      "",
      "",
      "",
      now,
    ).run();

    return Response.json({
      ok: true,
      id: Number(result.meta.last_row_id),
      registrationNo,
      message: "Pendaftaran berhasil dibuat. Silakan lengkapi dokumen.",
    });
  } catch (error) {
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
    if (!id || !applicationStatuses.includes(status as typeof applicationStatuses[number])) {
      return Response.json({ error: "Data atau status verifikasi tidak valid." }, { status: 400 });
    }
    const admission = await database().prepare(
      "SELECT name,registration_no,guardian_phone FROM admissions WHERE id=?",
    ).bind(id).first<{ name: string; registration_no: string; guardian_phone: string }>();
    if (!admission) return Response.json({ error: "Pendaftaran tidak ditemukan." }, { status: 404 });

    const now = new Date().toISOString();
    await database().prepare(
      "UPDATE admissions SET status=?,score=?,verification_note=?,verified_by=?,verified_at=? WHERE id=?",
    ).bind(status, score, note, user.email, now, id).run();
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

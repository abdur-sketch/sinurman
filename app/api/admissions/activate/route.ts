import { database, ensureUser } from "../../_lib";
import { publicCardToken, studentNumber } from "../../../../lib/student-card";

export async function POST(request: Request) {
  try {
    const user = await ensureUser(request);
    if (user.role !== "Admin") return Response.json({ error: "Hanya Admin yang dapat menetapkan santri." }, { status: 403 });
    const body = await request.json() as { admissionId?: number };
    const admissionId = Number(body.admissionId);
    if (!admissionId) return Response.json({ error: "Pendaftar tidak valid." }, { status: 400 });
    const db = database();
    const admission = await db.prepare(
      "SELECT id,student_id,name,nisn,desired_level,guardian_name,guardian_phone,status,created_at FROM admissions WHERE id=?",
    ).bind(admissionId).first<Record<string, unknown>>();
    if (!admission) return Response.json({ error: "Pendaftar tidak ditemukan." }, { status: 404 });
    if (admission.student_id) {
      const existing = await db.prepare("SELECT id,nis,card_public_token FROM students WHERE id=?").bind(admission.student_id).first<Record<string, unknown>>();
      if (existing) return Response.json({ ok: true, created: false, student: existing, message: "Pendaftar ini sudah menjadi santri." });
    }
    if (String(admission.status) !== "Lulus") {
      return Response.json({ error: "Hanya pendaftar berstatus Lulus yang dapat ditetapkan sebagai santri." }, { status: 409 });
    }
    const entryYear = String(admission.created_at || "").slice(0, 4) || String(new Date().getUTCFullYear());
    const nis = studentNumber(entryYear, String(admission.desired_level || "SMP"));
    const token = publicCardToken();
    const now = new Date().toISOString();
    let studentId = 0;
    try {
      const result = await db.prepare(
        `INSERT INTO students (name,nis,class_name,room,guardian_name,guardian_phone,status,created_at,admission_id,nisn,education_level,entry_year,photo_url,card_public_token)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      ).bind(admission.name, nis, "Belum ditetapkan", "", admission.guardian_name, admission.guardian_phone, "Aktif", now, admission.id, admission.nisn || "", admission.desired_level || "SMP", entryYear, "", token).run();
      studentId = Number(result.meta.last_row_id);
      await db.prepare("UPDATE admissions SET student_id=? WHERE id=?").bind(studentId, admission.id).run();
    } catch (error) {
      if (!/unique|constraint/i.test(error instanceof Error ? error.message : "")) throw error;
      const existing = await db.prepare("SELECT id,nis,card_public_token FROM students WHERE admission_id=?").bind(admission.id).first<Record<string, unknown>>();
      if (!existing) throw error;
      studentId = Number(existing.id);
      await db.prepare("UPDATE admissions SET student_id=? WHERE id=?").bind(studentId, admission.id).run();
      return Response.json({ ok: true, created: false, student: existing, message: "Pendaftar ini sudah menjadi santri." });
    }
    await db.prepare("INSERT INTO audit_logs (user_email,action,resource,record_id,detail,created_at) VALUES (?,?,?,?,?,?)")
      .bind(user.email, "Tetapkan", "admissions", admission.id, `${admission.name} menjadi santri ${nis}`, now).run();
    const student = await db.prepare("SELECT id,name,nis,class_name,room,status,nisn,education_level,entry_year,card_public_token FROM students WHERE id=?").bind(studentId).first<Record<string, unknown>>();
    return Response.json({ ok: true, created: true, student, message: "Calon santri berhasil ditetapkan. Kartu santri sudah tersedia." }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Penetapan santri gagal." }, { status: 500 });
  }
}

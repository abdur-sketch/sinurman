import { database, ensureDatabaseSchema } from "../_lib";

const levels = new Set(["SMP", "SMK"]);

function clean(value: unknown, max = 180) {
  return String(value ?? "").trim().slice(0, max);
}

function registrationNumber() {
  return `PPDB-${new Date().getFullYear()}-${crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase()}`;
}

export async function POST(request: Request) {
  try {
    await ensureDatabaseSchema();
    const body = await request.json() as Record<string, unknown>;
    if (clean(body.website)) return Response.json({ ok: true });
    const required = ["name","applicant_email","nisn","birth_place","birth_date","gender","desired_level","guardian_name","guardian_phone","previous_school","address"];
    if (required.some((field) => !clean(body[field]))) {
      return Response.json({ error: "Semua data wajib diisi sebelum pendaftaran dikirim." }, { status: 400 });
    }
    if (!levels.has(clean(body.desired_level))) {
      return Response.json({ error: "Jenjang pilihan tidak valid." }, { status: 400 });
    }
    const email = clean(body.applicant_email).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json({ error: "Alamat email tidak valid." }, { status: 400 });
    }
    const registrationNo = registrationNumber();
    const trackingToken = crypto.randomUUID().replaceAll("-", "");
    const now = new Date().toISOString();
    const result = await database().prepare(
      `INSERT INTO admissions
       (registration_no,name,applicant_email,nisn,birth_place,birth_date,gender,desired_level,guardian_name,guardian_phone,previous_school,address,status,score,verification_note,verified_by,verified_at,tracking_token,created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    ).bind(
      registrationNo, clean(body.name), email, clean(body.nisn, 30), clean(body.birth_place), clean(body.birth_date, 20),
      clean(body.gender, 20), clean(body.desired_level, 10), clean(body.guardian_name), clean(body.guardian_phone, 30),
      clean(body.previous_school), clean(body.address, 500), "Pendaftaran", 0, "", "", "", trackingToken, now,
    ).run();
    return Response.json({
      ok: true,
      id: Number(result.meta.last_row_id),
      registrationNo,
      trackingToken,
      message: "Pendaftaran berhasil. Simpan nomor dan kode pelacakan Anda.",
    }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Pendaftaran belum dapat diproses." }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    await ensureDatabaseSchema();
    const url = new URL(request.url);
    const registrationNo = clean(url.searchParams.get("registrationNo"), 40);
    const token = clean(url.searchParams.get("token"), 80);
    if (!registrationNo || !token) return Response.json({ error: "Nomor pendaftaran dan kode pelacakan wajib diisi." }, { status: 400 });
    const admission = await database().prepare(
      `SELECT id,registration_no,name,desired_level,previous_school,status,score,verification_note,created_at
       FROM admissions WHERE registration_no=? AND tracking_token=?`,
    ).bind(registrationNo, token).first<Record<string, unknown>>();
    if (!admission) return Response.json({ error: "Pendaftaran tidak ditemukan. Periksa kembali nomor dan kode pelacakan." }, { status: 404 });
    const documents = await database().prepare(
      "SELECT id,doc_type,file_name,status,verification_note,uploaded_at FROM admission_documents WHERE admission_id=? ORDER BY id DESC",
    ).bind(admission.id).all();
    return Response.json({ admission, documents: documents.results });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Status belum dapat dimuat." }, { status: 500 });
  }
}

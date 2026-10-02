import { database, ensureDatabaseSchema, normalizeGuardianPhone } from "../_lib";

const levels = new Set(["SMP", "SMK"]);

function clean(value: unknown, max = 180) {
  return String(value ?? "").trim().slice(0, max);
}

function registrationNumber() {
  return `PPDB-${new Date().getFullYear()}-${crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase()}`;
}

function normalizeName(value: unknown) {
  return clean(value, 180).toLocaleLowerCase("id-ID").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

function submissionKey(request: Request, body: Record<string, unknown>) {
  return clean(request.headers.get("Idempotency-Key") || body.submission_id, 120);
}

async function auditAdmission(result: "CREATED" | "IDEMPOTENT_REPLAY" | "DUPLICATE_BLOCKED" | "FAILED", key: string, registrationId: number | null, requestId: string) {
  try {
    await database().prepare(
      "INSERT INTO audit_logs (user_email,action,resource,record_id,detail,created_at) VALUES (?,?,?,?,?,?)",
    ).bind("public-spmb", "Pendaftaran", "admissions", registrationId, `${result} request_id=${requestId} idempotency=${key ? `${key.slice(0, 10)}…` : "none"}`, new Date().toISOString()).run();
  } catch { /* audit failure must not duplicate or roll back a registration */ }
}

export async function POST(request: Request) {
  let requestKey = "";
  try {
    await ensureDatabaseSchema();
    const body = await request.json() as Record<string, unknown>;
    if (clean(body.website)) return Response.json({ ok: true });
    const required = ["name","nisn","birth_place","birth_date","gender","desired_level","guardian_name","guardian_phone","previous_school","address"];
    if (required.some((field) => !clean(body[field]))) {
      return Response.json({ error: "Semua data wajib diisi sebelum pendaftaran dikirim." }, { status: 400 });
    }
    if (!levels.has(clean(body.desired_level))) {
      return Response.json({ error: "Jenjang pilihan tidak valid." }, { status: 400 });
    }
    const requestId = clean(request.headers.get("X-Request-Id"), 80) || crypto.randomUUID();
    const key = submissionKey(request, body);
    requestKey = key;
    if (key) {
      const replay = await database().prepare(
        "SELECT id,registration_no,tracking_token FROM admissions WHERE idempotency_key=?",
      ).bind(key).first<{ id:number; registration_no:string; tracking_token:string }>();
      if (replay) {
        await auditAdmission("IDEMPOTENT_REPLAY", key, replay.id, requestId);
        return Response.json({ ok: true, id: replay.id, registrationNo: replay.registration_no, trackingToken: replay.tracking_token, message: "Pendaftaran sebelumnya sudah tersimpan. Tidak dibuat ulang." }, { status: 200 });
      }
    }
    const normalizedPhone = normalizeGuardianPhone(body.guardian_phone);
    const normalizedName = normalizeName(body.name);
    const periodYear = String(new Date().getUTCFullYear());
    const possibleDuplicates = await database().prepare(
      "SELECT id,registration_no,name,guardian_phone,desired_level,created_at FROM admissions WHERE desired_level=? AND substr(created_at,1,4)=? AND guardian_phone=? ORDER BY id ASC",
    ).bind(clean(body.desired_level, 10), periodYear, normalizedPhone).all<{ id:number; registration_no:string; name:string; guardian_phone:string; desired_level:string; created_at:string }>();
    const duplicate = possibleDuplicates.results.find((row) => normalizeName(row.name) === normalizedName);
    if (duplicate) {
      await auditAdmission("DUPLICATE_BLOCKED", key, duplicate.id, requestId);
      return Response.json({ code: "DUPLICATE_BLOCKED", error: `Calon santri dengan data yang sama sudah terdaftar dengan No. Pendaftaran ${duplicate.registration_no}. Silakan periksa data sebelumnya.`, existing: { id: duplicate.id, registrationNo: duplicate.registration_no, createdAt: duplicate.created_at } }, { status: 409 });
    }
    const registrationNo = registrationNumber();
    const trackingToken = crypto.randomUUID().replaceAll("-", "");
    const now = new Date().toISOString();
    const result = await database().prepare(
      `INSERT INTO admissions
       (registration_no,name,applicant_email,nisn,birth_place,birth_date,gender,desired_level,guardian_name,guardian_phone,previous_school,address,status,score,verification_note,verified_by,verified_at,tracking_token,idempotency_key,created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    ).bind(
      registrationNo, clean(body.name), "", clean(body.nisn, 30), clean(body.birth_place), clean(body.birth_date, 20),
      clean(body.gender, 20), clean(body.desired_level, 10), clean(body.guardian_name), normalizedPhone,
      clean(body.previous_school), clean(body.address, 500), "Pendaftaran", 0, "", "", "", trackingToken, key || `legacy-${crypto.randomUUID()}`, now,
    ).run();
    const id = Number(result.meta.last_row_id);
    await auditAdmission("CREATED", key, id, requestId);
    return Response.json({
      ok: true,
      id,
      registrationNo,
      trackingToken,
      message: "Pendaftaran berhasil. Simpan nomor dan kode pelacakan Anda.",
    }, { status: 201 });
  } catch (error) {
    const body = error instanceof Error ? error.message : "";
    if (/unique index|UNIQUE constraint|already exists/i.test(body)) {
      try {
        const replay = requestKey ? await database().prepare("SELECT id,registration_no,tracking_token FROM admissions WHERE idempotency_key=?").bind(requestKey).first<{ id:number; registration_no:string; tracking_token:string }>() : null;
        if (replay) return Response.json({ ok: true, id: replay.id, registrationNo: replay.registration_no, trackingToken: replay.tracking_token, message: "Pendaftaran sebelumnya sudah tersimpan. Tidak dibuat ulang." }, { status: 200 });
      } catch { /* fall through to the safe error below */ }
    }
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
      `SELECT id,registration_no,name,desired_level,previous_school,status,score,verification_note,wave,test_date,test_time,test_location,created_at
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

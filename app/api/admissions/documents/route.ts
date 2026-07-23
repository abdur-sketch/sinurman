import { env } from "cloudflare:workers";
import { database, ensureUser } from "../../_lib";

const documentTypes = ["Kartu Keluarga", "Akta Kelahiran", "Rapor Terakhir", "Pas Foto", "KIP / SKTM"] as const;
const allowedTypes = new Set(["application/pdf", "image/jpeg", "image/png"]);
const maxSize = 5 * 1024 * 1024;

function safeName(value: string) {
  return value.normalize("NFKD").replace(/[^\w.-]+/g, "-").replace(/-+/g, "-").slice(-100);
}

async function admissionAccess(id: number, email: string, admin: boolean) {
  const row = await database().prepare(
    "SELECT id,applicant_email,status FROM admissions WHERE id=?",
  ).bind(id).first<{ id: number; applicant_email: string; status: string }>();
  if (!row || (!admin && row.applicant_email.toLowerCase() !== email.toLowerCase())) return null;
  return row;
}

export async function POST(request: Request) {
  try {
    const user = await ensureUser(request);
    const form = await request.formData();
    const admissionId = Number(form.get("admissionId"));
    const docType = String(form.get("docType") ?? "");
    const file = form.get("file");
    if (!admissionId || !documentTypes.includes(docType as typeof documentTypes[number]) || !(file instanceof File)) {
      return Response.json({ error: "Pendaftaran, jenis dokumen, atau berkas tidak valid." }, { status: 400 });
    }
    if (!allowedTypes.has(file.type)) {
      return Response.json({ error: "Format dokumen harus PDF, JPG, atau PNG." }, { status: 400 });
    }
    if (!file.size || file.size > maxSize) {
      return Response.json({ error: "Ukuran dokumen maksimal 5 MB." }, { status: 400 });
    }
    const admission = await admissionAccess(admissionId, user.email, user.role === "Admin");
    if (!admission) return Response.json({ error: "Pendaftaran tidak ditemukan atau bukan milik Anda." }, { status: 403 });
    if (!env.FILES) return Response.json({ error: "Penyimpanan dokumen belum tersedia." }, { status: 503 });

    const now = new Date().toISOString();
    const objectKey = `ppdb/${admissionId}/${crypto.randomUUID()}-${safeName(file.name)}`;
    await env.FILES.put(objectKey, await file.arrayBuffer(), {
      httpMetadata: { contentType: file.type },
      customMetadata: { admissionId: String(admissionId), docType, uploadedBy: user.email },
    });
    await database().prepare(
      `INSERT INTO admission_documents
       (admission_id,doc_type,file_name,object_key,content_type,size_bytes,status,verification_note,verified_by,verified_at,uploaded_at)
       VALUES (?,?,?,?,?,?,'Menunggu','','','',?)`,
    ).bind(admissionId, docType, file.name, objectKey, file.type, file.size, now).run();
    if (["Pendaftaran", "Perlu Perbaikan"].includes(admission.status)) {
      await database().prepare("UPDATE admissions SET status='Verifikasi Dokumen' WHERE id=?").bind(admissionId).run();
    }
    return Response.json({ ok: true, message: `${docType} berhasil diunggah.` });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Dokumen gagal diunggah." }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const user = await ensureUser(request);
    const id = Number(new URL(request.url).searchParams.get("id"));
    const document = await database().prepare(
      `SELECT d.*,a.applicant_email FROM admission_documents d
       JOIN admissions a ON a.id=d.admission_id WHERE d.id=?`,
    ).bind(id).first<Record<string, string | number>>();
    if (!document || (user.role !== "Admin" && String(document.applicant_email).toLowerCase() !== user.email.toLowerCase())) {
      return Response.json({ error: "Dokumen tidak ditemukan." }, { status: 404 });
    }
    const object = await env.FILES.get(String(document.object_key));
    if (!object) return Response.json({ error: "Berkas tidak ditemukan di penyimpanan." }, { status: 404 });
    return new Response(object.body, {
      headers: {
        "content-type": String(document.content_type),
        "content-disposition": `inline; filename="${safeName(String(document.file_name))}"`,
        "cache-control": "private, no-store",
      },
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Dokumen gagal dibuka." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await ensureUser(request);
    if (user.role !== "Admin") return Response.json({ error: "Hanya admin yang dapat memverifikasi dokumen." }, { status: 403 });
    const body = await request.json() as Record<string, unknown>;
    const id = Number(body.id);
    const status = String(body.status ?? "");
    const note = String(body.verification_note ?? "").trim();
    if (!id || !["Valid", "Ditolak", "Menunggu"].includes(status)) {
      return Response.json({ error: "Status dokumen tidak valid." }, { status: 400 });
    }
    if (status === "Ditolak" && !note) {
      return Response.json({ error: "Alasan penolakan dokumen wajib diisi." }, { status: 400 });
    }
    const now = new Date().toISOString();
    const result = await database().prepare(
      "UPDATE admission_documents SET status=?,verification_note=?,verified_by=?,verified_at=? WHERE id=?",
    ).bind(status, note, user.email, now, id).run();
    if (!result.meta.changes) return Response.json({ error: "Dokumen tidak ditemukan." }, { status: 404 });
    const document = await database().prepare(
      "SELECT admission_id FROM admission_documents WHERE id=?",
    ).bind(id).first<{ admission_id: number }>();
    if (status === "Ditolak" && document) {
      await database().prepare(
        "UPDATE admissions SET status='Perlu Perbaikan',verification_note=? WHERE id=?",
      ).bind(note, document.admission_id).run();
    }
    return Response.json({ ok: true, message: "Status dokumen berhasil diperbarui." });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Verifikasi dokumen gagal." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await ensureUser(request);
    const id = Number(new URL(request.url).searchParams.get("id"));
    const document = await database().prepare(
      `SELECT d.*,a.applicant_email FROM admission_documents d
       JOIN admissions a ON a.id=d.admission_id WHERE d.id=?`,
    ).bind(id).first<Record<string, string | number>>();
    if (!document || (user.role !== "Admin" && String(document.applicant_email).toLowerCase() !== user.email.toLowerCase())) {
      return Response.json({ error: "Dokumen tidak ditemukan." }, { status: 404 });
    }
    if (user.role !== "Admin" && String(document.status) === "Valid") {
      return Response.json({ error: "Dokumen yang sudah valid tidak dapat dihapus." }, { status: 409 });
    }
    await env.FILES.delete(String(document.object_key));
    await database().prepare("DELETE FROM admission_documents WHERE id=?").bind(id).run();
    return Response.json({ ok: true, message: "Dokumen berhasil dihapus." });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Dokumen gagal dihapus." }, { status: 500 });
  }
}

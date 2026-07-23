import { env } from "cloudflare:workers";
import { database, ensureDatabaseSchema } from "../../_lib";

const documentTypes = new Set(["Kartu Keluarga", "Akta Kelahiran", "Rapor Terakhir", "Pas Foto", "KIP / SKTM"]);
const contentTypes = new Set(["application/pdf", "image/jpeg", "image/png"]);
const maxSize = 5 * 1024 * 1024;

function safeName(value: string) {
  return value.normalize("NFKD").replace(/[^\w.-]+/g, "-").replace(/-+/g, "-").slice(-100);
}

export async function POST(request: Request) {
  try {
    await ensureDatabaseSchema();
    const form = await request.formData();
    const admissionId = Number(form.get("admissionId"));
    const trackingToken = String(form.get("trackingToken") ?? "");
    const docType = String(form.get("docType") ?? "");
    const file = form.get("file");
    if (!admissionId || trackingToken.length < 20 || !documentTypes.has(docType) || !(file instanceof File)) {
      return Response.json({ error: "Data unggahan tidak valid." }, { status: 400 });
    }
    if (!contentTypes.has(file.type)) return Response.json({ error: "Format harus PDF, JPG, atau PNG." }, { status: 400 });
    if (!file.size || file.size > maxSize) return Response.json({ error: "Ukuran berkas maksimal 5 MB." }, { status: 400 });
    const admission = await database().prepare(
      "SELECT id,status FROM admissions WHERE id=? AND tracking_token=?",
    ).bind(admissionId, trackingToken).first<{ id:number; status:string }>();
    if (!admission) return Response.json({ error: "Kode pelacakan tidak sesuai." }, { status: 403 });
    const key = `ppdb/${admissionId}/${crypto.randomUUID()}-${safeName(file.name)}`;
    await env.FILES.put(key, await file.arrayBuffer(), {
      httpMetadata: { contentType: file.type },
      customMetadata: { admissionId:String(admissionId), docType },
    });
    const now = new Date().toISOString();
    await database().prepare(
      `INSERT INTO admission_documents
       (admission_id,doc_type,file_name,object_key,content_type,size_bytes,status,verification_note,verified_by,verified_at,uploaded_at)
       VALUES (?,?,?,?,?,?,'Menunggu','','','',?)`,
    ).bind(admissionId, docType, file.name, key, file.type, file.size, now).run();
    await database().prepare(
      "UPDATE admissions SET status=CASE WHEN status IN ('Pendaftaran','Perlu Perbaikan') THEN 'Verifikasi Dokumen' ELSE status END WHERE id=?",
    ).bind(admissionId).run();
    return Response.json({ ok:true, message:`${docType} berhasil diunggah.` });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Berkas belum dapat diunggah." }, { status: 500 });
  }
}

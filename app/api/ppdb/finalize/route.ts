import { database, ensureDatabaseSchema } from "../../_lib";
import { ppdbRequirements } from "../../../../lib/ppdb-requirements";

export async function POST(request: Request) {
  try {
    await ensureDatabaseSchema();
    const body = await request.json() as { id?: unknown; trackingToken?: unknown };
    const id = Number(body.id);
    const token = String(body.trackingToken ?? "");
    const admission = await database().prepare("SELECT id,status,registration_requirement_version FROM admissions WHERE id=? AND tracking_token=?").bind(id, token).first<{ id:number; status:string; registration_requirement_version:number }>();
    if (!admission) return Response.json({ error: "Kode pelacakan tidak sesuai." }, { status: 403 });
    const requirements = ppdbRequirements(Number(admission.registration_requirement_version || 1));
    const documents = await database().prepare("SELECT doc_type FROM admission_documents WHERE admission_id=?").bind(id).all<{ doc_type:string }>();
    const uploaded = new Set(documents.results.map(row => row.doc_type));
    const missing = requirements.required.find(type => !uploaded.has(type));
    if (missing) return Response.json({ error: `${missing} wajib diunggah sebelum pendaftaran dikirim.`, missing }, { status: 422 });
    if (["Pendaftaran", "Perlu Perbaikan"].includes(admission.status)) {
      await database().prepare("UPDATE admissions SET status='Verifikasi Dokumen' WHERE id=?").bind(id).run();
    }
    return Response.json({ ok:true, documentStatus:"complete", requirementVersion:Number(admission.registration_requirement_version || 1) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Pendaftaran belum dapat difinalisasi." }, { status: 500 });
  }
}

import { database, ensureDatabaseSchema } from "../../../_lib";

async function hash(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes)).map((x) => x.toString(16).padStart(2, "0")).join("");
}

function cookie(request: Request) {
  return request.headers.get("cookie")?.match(/(?:^|; )spmb_portal_session=([^;]+)/)?.[1] || "";
}

export async function GET(request: Request) {
  try {
    await ensureDatabaseSchema();
    const token = cookie(request);
    if (!token) return Response.json({ error: "Sesi portal tidak ditemukan." }, { status: 401 });
    const session = await database().prepare("SELECT admission_id,expires_at FROM spmb_portal_sessions WHERE token_hash=?")
      .bind(await hash(token)).first<{ admission_id: number; expires_at: string }>();
    if (!session || session.expires_at < new Date().toISOString()) return Response.json({ error: "Sesi portal sudah berakhir." }, { status: 401 });
    const row = await database().prepare(
      "SELECT id,registration_no,name,desired_level,status,score,wave,test_date,test_time,test_location,public_note,verification_note,result_published_at,created_at FROM admissions WHERE id=?",
    ).bind(session.admission_id).first<Record<string, unknown>>();
    if (!row) return Response.json({ error: "Pendaftaran tidak ditemukan." }, { status: 404 });
    const rawStatus = String(row.status ?? "");
    const published = Boolean(row.result_published_at) && ["Lulus", "Tidak Lulus"].includes(rawStatus);
    const publicStatus = !published && ["Lulus", "Tidak Lulus"].includes(rawStatus) ? "Menunggu Pengumuman" : rawStatus;
    const admission = {
      id: row.id, registration_no: row.registration_no, name: row.name,
      desired_level: row.desired_level, status: publicStatus,
      score: published ? row.score : null, wave: row.wave,
      test_date: row.test_date, test_time: row.test_time, test_location: row.test_location,
      verification_note: row.public_note || row.verification_note || "", created_at: row.created_at,
    };
    const documents = await database().prepare(
      "SELECT id,doc_type,file_name,status,verification_note,uploaded_at FROM admission_documents WHERE admission_id=? ORDER BY id DESC",
    ).bind(session.admission_id).all();
    const stage = publicStatus;
    return Response.json({ admission, documents: documents.results, timeline: [
      { key: "received", label: "Pendaftaran Diterima", state: "Selesai" },
      { key: "docs", label: "Verifikasi Dokumen", state: stage === "Pendaftaran" ? "Sedang Diproses" : stage === "Perlu Perbaikan" ? "Perlu Tindakan" : "Selesai" },
      { key: "test", label: "Jadwal Seleksi", state: row.test_date ? "Selesai" : "Belum Dimulai" },
      { key: "result", label: "Pengumuman Kelulusan", state: published ? "Selesai" : "Belum Dimulai" },
      { key: "reentry", label: "Daftar Ulang", state: published && rawStatus === "Lulus" ? "Perlu Tindakan" : "Belum Dimulai" },
    ]});
  } catch {
    return Response.json({ error: "Status belum dapat dimuat." }, { status: 500 });
  }
}

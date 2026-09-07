import { database, ensureUser } from "../../_lib";

export async function GET(request: Request) {
  try {
    const user = await ensureUser(request);
    if (user.role !== "Admin") return Response.json({ error: "Surat SPMB hanya dapat diterbitkan Admin." }, { status: 403 });
    const id = Number(new URL(request.url).searchParams.get("id"));
    if (!id) return Response.json({ error: "Pendaftar tidak ditemukan." }, { status: 400 });
    const admission = await database().prepare("SELECT * FROM admissions WHERE id=?").bind(id).first<Record<string, unknown>>();
    if (!admission) return Response.json({ error: "Pendaftar tidak ditemukan." }, { status: 404 });
    const ranking = await database().prepare("SELECT COUNT(*) AS rank FROM admissions WHERE score>? AND (wave=? OR wave IS NULL)").bind(Number(admission.score || 0), String(admission.wave || "Gelombang 1")).first<{ rank: number }>();
    return Response.json({ admission, rank: Number(ranking?.rank || 0) + 1, generatedAt: new Date().toISOString() });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Surat SPMB gagal dimuat." }, { status: 500 });
  }
}

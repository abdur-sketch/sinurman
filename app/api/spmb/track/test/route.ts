import { database, ensureDatabaseSchema } from "../../../_lib";

const hash = async (value: string) => {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes)).map((x) => x.toString(16).padStart(2, "0")).join("");
};
const sessionCookie = (request: Request) => request.headers.get("cookie")?.match(/(?:^|; )spmb_portal_session=([^;]+)/)?.[1] || "";
const text = (value: unknown, max = 500) => String(value ?? "").trim().slice(0, max);

async function getSession(request: Request) {
  const token = sessionCookie(request);
  if (!token) return null;
  const row = await database().prepare("SELECT admission_id,expires_at FROM spmb_portal_sessions WHERE token_hash=?").bind(await hash(token)).first<{admission_id:number;expires_at:string}>();
  if (!row || row.expires_at <= new Date().toISOString()) return null;
  return row;
}

function isOpen(assignment: { status: string; opens_at: string; closes_at: string }) {
  const current = Date.now();
  const opens = assignment.opens_at ? Date.parse(assignment.opens_at) : 0;
  const closes = assignment.closes_at ? Date.parse(assignment.closes_at) : Number.POSITIVE_INFINITY;
  return assignment.status !== "Ditutup" && assignment.status !== "Dinilai" && current >= opens && current <= closes;
}

export async function GET(request: Request) {
  try {
    await ensureDatabaseSchema();
    const session = await getSession(request);
    if (!session) return Response.json({ error: "Sesi portal tidak ditemukan atau sudah berakhir." }, { status: 401 });
    const assignment = await database().prepare(
      "SELECT id,status,opens_at,closes_at,started_at,submitted_at,score,total_points,published FROM spmb_test_assignments WHERE admission_id=?",
    ).bind(session.admission_id).first<Record<string, unknown>>();
    if (!assignment) return Response.json({ available: false, message: "Belum ada soal tes yang ditugaskan." });
    if (!assignment.started_at && isOpen(assignment as {status:string;opens_at:string;closes_at:string})) {
      await database().prepare("UPDATE spmb_test_assignments SET started_at=?,status='Dikerjakan',updated_at=? WHERE id=? AND started_at='' ").bind(new Date().toISOString(), new Date().toISOString(), assignment.id).run();
      assignment.started_at = new Date().toISOString(); assignment.status = "Dikerjakan";
    }
    const questionRows = await database().prepare(
      `SELECT q.id,q.prompt,q.options_json,q.points FROM spmb_test_questions q
       JOIN spmb_test_assignment_questions aq ON aq.question_id=q.id
       WHERE aq.assignment_id=? ORDER BY q.id ASC`,
    ).bind(assignment.id).all();
    const answers = await database().prepare("SELECT question_id,answer FROM spmb_test_answers WHERE assignment_id=?").bind(assignment.id).all();
    return Response.json({
      available: isOpen(assignment as {status:string;opens_at:string;closes_at:string}) || Boolean(assignment.submitted_at),
      assignment: { id: assignment.id, status: assignment.status, opens_at: assignment.opens_at, closes_at: assignment.closes_at, submitted_at: assignment.submitted_at, score: assignment.published ? assignment.score : null, total_points: assignment.published ? assignment.total_points : null },
      questions: questionRows.results.map((row) => ({ id: row.id, prompt: row.prompt, options: JSON.parse(String(row.options_json || "[]")), points: row.points })),
      answers: answers.results,
    });
  } catch {
    return Response.json({ error: "Soal tes belum dapat dimuat." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await ensureDatabaseSchema();
    const session = await getSession(request);
    if (!session) return Response.json({ error: "Sesi portal tidak ditemukan atau sudah berakhir." }, { status: 401 });
    const body = await request.json() as { answers?: Array<{question_id?:unknown;answer?:unknown}> };
    const assignment = await database().prepare("SELECT id,status,opens_at,closes_at,submitted_at FROM spmb_test_assignments WHERE admission_id=?").bind(session.admission_id).first<{id:number;status:string;opens_at:string;closes_at:string;submitted_at:string}>();
    if (!assignment) return Response.json({ error: "Belum ada soal tes yang ditugaskan." }, { status: 404 });
    if (!isOpen(assignment)) return Response.json({ error: "Tes belum dibuka, sudah ditutup, atau sudah dikirim." }, { status: 409 });
    const submitted = Array.isArray(body.answers) ? body.answers.slice(0, 100) : [];
    const ids = submitted.map((item) => Number(item.question_id)).filter((id) => Number.isInteger(id) && id > 0);
    if (!ids.length) return Response.json({ error: "Jawaban tes belum diisi." }, { status: 400 });
    const questions = await database().prepare(`SELECT q.id,q.correct_option,q.points FROM spmb_test_questions q JOIN spmb_test_assignment_questions aq ON aq.question_id=q.id WHERE aq.assignment_id=? AND q.id IN (${ids.map(() => "?").join(",")})`).bind(assignment.id, ...ids).all<{id:number;correct_option:string;points:number}>();
    const byId = new Map(questions.results.map((question) => [question.id, question]));
    const timestamp = new Date().toISOString();
    let score = 0;
    const writes = submitted.flatMap((item) => {
      const question = byId.get(Number(item.question_id));
      if (!question) return [];
      const answer = text(item.answer, 300);
      const correct = answer === question.correct_option;
      if (correct) score += Number(question.points || 0);
      return [database().prepare("INSERT OR REPLACE INTO spmb_test_answers (assignment_id,question_id,answer,is_correct,points_awarded,answered_at) VALUES (?,?,?,?,?,?)").bind(assignment.id, question.id, answer, correct ? 1 : 0, correct ? question.points : 0, timestamp)];
    });
    await database().batch([
      ...writes,
      database().prepare("UPDATE spmb_test_assignments SET status='Dinilai',submitted_at=?,score=?,updated_at=? WHERE id=?").bind(timestamp, score, timestamp, assignment.id),
    ]);
    return Response.json({ ok: true, message: "Jawaban tes berhasil dikirim. Menunggu pengesahan admin." });
  } catch {
    return Response.json({ error: "Jawaban tes gagal disimpan." }, { status: 500 });
  }
}

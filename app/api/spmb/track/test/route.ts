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

function effectiveClose(assignment: { closes_at: string; started_at?: string; duration_minutes?: number }) {
  if (assignment.closes_at) return Date.parse(assignment.closes_at);
  if (assignment.started_at && Number(assignment.duration_minutes || 0) > 0) return Date.parse(assignment.started_at) + Number(assignment.duration_minutes) * 60_000;
  return Number.POSITIVE_INFINITY;
}
function isOpen(assignment: { status: string; opens_at: string; closes_at: string; started_at?: string; duration_minutes?: number }) {
  const current = Date.now();
  const opens = assignment.opens_at ? Date.parse(assignment.opens_at) : 0;
  const closes = effectiveClose(assignment);
  return assignment.status !== "Ditutup" && assignment.status !== "Dinilai" && current >= opens && current <= closes;
}

export async function GET(request: Request) {
  try {
    await ensureDatabaseSchema();
    const session = await getSession(request);
    if (!session) return Response.json({ error: "Sesi portal tidak ditemukan atau sudah berakhir." }, { status: 401 });
    const assignment = await database().prepare(
      "SELECT id,status,result_status,test_name,instructions,opens_at,closes_at,duration_minutes,question_count,shuffle_questions,shuffle_options,started_at,submitted_at,score,total_points,published FROM spmb_test_assignments WHERE admission_id=?",
    ).bind(session.admission_id).first<Record<string, unknown>>();
    if (!assignment) return Response.json({ available: false, message: "Belum ada soal tes yang ditugaskan." });
    if (!assignment.started_at && isOpen(assignment as {status:string;opens_at:string;closes_at:string;started_at:string;duration_minutes:number})) {
      await database().prepare("UPDATE spmb_test_assignments SET started_at=?,status='Dikerjakan',updated_at=? WHERE id=? AND started_at='' ").bind(new Date().toISOString(), new Date().toISOString(), assignment.id).run();
      assignment.started_at = new Date().toISOString(); assignment.status = "Dikerjakan";
    }
    const questionRows = await database().prepare(
      `SELECT aq.question_id,aq.snapshot_json,q.prompt,q.options_json,q.points FROM spmb_test_assignment_questions aq
       JOIN spmb_test_questions q ON q.id=aq.question_id
       WHERE aq.assignment_id=? ORDER BY q.id ASC`,
    ).bind(assignment.id).all();
    const answers = await database().prepare("SELECT question_id,answer FROM spmb_test_answers WHERE assignment_id=?").bind(assignment.id).all();
    const visibleQuestions = questionRows.results.map((row) => { const snapshot = row.snapshot_json ? JSON.parse(String(row.snapshot_json)) : { prompt: row.prompt, options: JSON.parse(String(row.options_json || "[]")), points: row.points }; const options = [...snapshot.options]; if (Number(assignment.shuffle_options)) options.sort(() => Math.random() - 0.5); return { id: row.question_id, prompt: snapshot.prompt, options, points: snapshot.points }; });
    if (Number(assignment.shuffle_questions)) visibleQuestions.sort(() => Math.random() - 0.5);
    return Response.json({
      available: isOpen(assignment as {status:string;opens_at:string;closes_at:string;started_at:string;duration_minutes:number}) || Boolean(assignment.submitted_at),
      assignment: { id: assignment.id, test_name: assignment.test_name, instructions: assignment.instructions, duration_minutes: assignment.duration_minutes, status: assignment.status, result_status: assignment.published ? assignment.result_status : "Menunggu Pengesahan", opens_at: assignment.opens_at, closes_at: effectiveClose(assignment as {closes_at:string;started_at:string;duration_minutes:number}) === Number.POSITIVE_INFINITY ? "" : new Date(effectiveClose(assignment as {closes_at:string;started_at:string;duration_minutes:number})).toISOString(), submitted_at: assignment.submitted_at, score: assignment.published ? assignment.score : null, total_points: assignment.published ? 100 : null },
      questions: isOpen(assignment as {status:string;opens_at:string;closes_at:string;started_at:string;duration_minutes:number}) && !assignment.submitted_at ? visibleQuestions : [],
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
    const assignment = await database().prepare("SELECT id,status,opens_at,closes_at,started_at,duration_minutes,total_points,submitted_at FROM spmb_test_assignments WHERE admission_id=?").bind(session.admission_id).first<{id:number;status:string;opens_at:string;closes_at:string;started_at:string;duration_minutes:number;total_points:number;submitted_at:string}>();
    if (!assignment) return Response.json({ error: "Belum ada soal tes yang ditugaskan." }, { status: 404 });
    if (!isOpen(assignment) || assignment.submitted_at) return Response.json({ error: "Tes belum dibuka, sudah ditutup, atau sudah dikirim." }, { status: 409 });
    const submitted = Array.isArray(body.answers) ? body.answers.slice(0, 100) : [];
    const ids = submitted.map((item) => Number(item.question_id)).filter((id) => Number.isInteger(id) && id > 0);
    if (!ids.length || new Set(ids).size !== ids.length || ids.length !== submitted.length) return Response.json({ error: "Jawaban tes belum diisi." }, { status: 400 });
    const questions = await database().prepare(`SELECT aq.question_id,aq.snapshot_json,q.correct_option,q.points FROM spmb_test_assignment_questions aq JOIN spmb_test_questions q ON q.id=aq.question_id WHERE aq.assignment_id=? AND q.id IN (${ids.map(() => "?").join(",")})`).bind(assignment.id, ...ids).all<{question_id:number;snapshot_json:string;correct_option:string;points:number}>();
    const byId = new Map(questions.results.map((question) => { const snapshot = question.snapshot_json ? JSON.parse(question.snapshot_json) : question; return [question.question_id, { correct_option: String(snapshot.correct_option ?? question.correct_option), points: Number(snapshot.points ?? question.points) }]; }));
    if (questions.results.length !== ids.length) return Response.json({ error: "Jawaban memuat soal yang tidak ditugaskan." }, { status: 400 });
    const timestamp = new Date().toISOString();
    let rawScore = 0;
    const writes = submitted.flatMap((item) => {
      const question = byId.get(Number(item.question_id));
      if (!question) return [];
      const answer = text(item.answer, 300);
      const correct = answer === question.correct_option;
      if (correct) rawScore += Number(question.points || 0);
      return [database().prepare("INSERT OR REPLACE INTO spmb_test_answers (assignment_id,question_id,answer,is_correct,points_awarded,answered_at) SELECT ?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM spmb_test_assignments WHERE id=? AND submitted_at=? AND status='Dinilai')").bind(assignment.id, Number(item.question_id), answer, correct ? 1 : 0, correct ? question.points : 0, timestamp, assignment.id, timestamp)];
    });
    const batch = await database().batch([
      database().prepare("UPDATE spmb_test_assignments SET status='Dinilai',result_status='Menunggu Pengesahan',submitted_at=?,score=?,updated_at=? WHERE id=? AND submitted_at='' AND status IN ('Ditugaskan','Dikerjakan') AND (opens_at='' OR opens_at<=?) AND (closes_at='' OR closes_at>=?) AND (duration_minutes=0 OR started_at='' OR datetime(started_at, '+' || duration_minutes || ' minutes')>=datetime(?))").bind(timestamp, assignment.total_points ? Math.round((rawScore / assignment.total_points) * 100) : 0, timestamp, assignment.id, timestamp, timestamp, timestamp),
      ...writes,
    ]);
    if (!batch[0]?.meta.changes) return Response.json({ error: "Tes sudah dikirim atau waktu pengerjaan berakhir." }, { status: 409 });
    return Response.json({ ok: true, message: "Jawaban tes berhasil dikirim. Menunggu pengesahan admin." });
  } catch {
    return Response.json({ error: "Jawaban tes gagal disimpan." }, { status: 500 });
  }
}

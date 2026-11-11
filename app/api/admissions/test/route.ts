import { database, ensureUser, requirePermission } from "../../_lib";

const text = (value: unknown, max = 4000) => String(value ?? "").trim().slice(0, max);
const now = () => new Date().toISOString();

function parseOptions(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => text(item, 300)).filter(Boolean).slice(0, 6);
}

async function admin(request: Request) {
  const user = await ensureUser(request);
  requirePermission(user, "admissions");
  if (user.role !== "Admin") throw new Error("FORBIDDEN_PERMISSION: Hanya Admin Pusat yang mengelola bank soal SPMB.");
  return user;
}

export async function GET(request: Request) {
  try {
    await admin(request);
    const admissionId = Number(new URL(request.url).searchParams.get("admissionId") || 0);
    const questions = await database().prepare(
      "SELECT id,prompt,options_json,correct_option,points,active,created_by,created_at,updated_at FROM spmb_test_questions ORDER BY id DESC",
    ).all();
    const assignments = await database().prepare(
      `SELECT a.id,a.admission_id,a.status,a.opens_at,a.closes_at,a.started_at,a.submitted_at,a.score,a.total_points,a.published,a.created_at,
              p.registration_no,p.name
       FROM spmb_test_assignments a JOIN admissions p ON p.id=a.admission_id
       ${admissionId ? "WHERE a.admission_id=?" : ""} ORDER BY a.id DESC`,
    ).bind(...(admissionId ? [admissionId] : [])).all();
    return Response.json({
      questions: questions.results.map((row) => ({ ...row, options: JSON.parse(String(row.options_json || "[]")) })),
      assignments: assignments.results,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Akses bank soal ditolak.";
    return Response.json({ error: message.replace("FORBIDDEN_PERMISSION: ", "") }, { status: message.startsWith("FORBIDDEN") ? 403 : 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await admin(request);
    const body = await request.json() as Record<string, unknown>;
    const action = text(body.action, 30);
    const timestamp = now();
    if (action === "question") {
      const prompt = text(body.prompt);
      const options = parseOptions(body.options);
      const correctOption = text(body.correct_option, 100);
      const points = Math.max(1, Math.min(100, Number(body.points || 1)));
      if (prompt.length < 5 || options.length < 2 || !options.includes(correctOption)) {
        return Response.json({ error: "Soal harus memiliki pertanyaan, minimal dua opsi, dan jawaban benar yang valid." }, { status: 400 });
      }
      const result = await database().prepare(
        "INSERT INTO spmb_test_questions (prompt,options_json,correct_option,points,active,created_by,created_at,updated_at) VALUES (?,?,?, ?,1,?,?,?)",
      ).bind(prompt, JSON.stringify(options), correctOption, points, user.email, timestamp, timestamp).run();
      return Response.json({ ok: true, id: Number(result.meta.last_row_id), message: "Soal tes berhasil ditambahkan." });
    }
    if (action === "assign") {
      const admissionId = Number(body.admission_id);
      const questionIds = Array.isArray(body.question_ids) ? body.question_ids.map(Number).filter((id) => Number.isInteger(id) && id > 0) : [];
      const opensAt = text(body.opens_at, 40);
      const closesAt = text(body.closes_at, 40);
      if (!admissionId || !questionIds.length) return Response.json({ error: "Pendaftar dan minimal satu soal wajib dipilih." }, { status: 400 });
      const admission = await database().prepare("SELECT id,status FROM admissions WHERE id=?").bind(admissionId).first<{id:number;status:string}>();
      if (!admission) return Response.json({ error: "Pendaftar tidak ditemukan." }, { status: 404 });
      const questions = await database().prepare(`SELECT id,points FROM spmb_test_questions WHERE active=1 AND id IN (${questionIds.map(() => "?").join(",")})`).bind(...questionIds).all<{id:number;points:number}>();
      if (questions.results.length !== new Set(questionIds).size) return Response.json({ error: "Ada soal yang tidak aktif atau tidak ditemukan." }, { status: 400 });
      const totalPoints = questions.results.reduce((sum, row) => sum + Number(row.points || 0), 0);
      const existing = await database().prepare("SELECT id,started_at,submitted_at,published FROM spmb_test_assignments WHERE admission_id=?").bind(admissionId).first<{id:number;started_at:string;submitted_at:string;published:number}>();
      if (existing && (existing.started_at || existing.submitted_at || existing.published)) return Response.json({ error: "Soal tidak dapat diubah setelah tes dibuka atau diselesaikan." }, { status: 409 });
      let assignmentId: number;
      if (existing) {
        assignmentId = existing.id;
        await database().batch([
          database().prepare("UPDATE spmb_test_assignments SET status='Ditugaskan',opens_at=?,closes_at=?,total_points=?,updated_at=? WHERE id=?").bind(opensAt, closesAt, totalPoints, timestamp, assignmentId),
          database().prepare("DELETE FROM spmb_test_assignment_questions WHERE assignment_id=?").bind(assignmentId),
        ]);
      } else {
        const created = await database().prepare("INSERT INTO spmb_test_assignments (admission_id,status,opens_at,closes_at,total_points,created_by,created_at,updated_at) VALUES (?,'Ditugaskan',?,?,?, ?,?,?)")
          .bind(admissionId, opensAt, closesAt, totalPoints, user.email, timestamp, timestamp).run();
        assignmentId = Number(created.meta.last_row_id);
      }
      await database().batch(questionIds.map((questionId) => database().prepare("INSERT INTO spmb_test_assignment_questions (assignment_id,question_id) VALUES (?,?)").bind(assignmentId, questionId)));
      return Response.json({ ok: true, assignmentId, message: "Soal berhasil ditugaskan ke calon santri." });
    }
    return Response.json({ error: "Aksi bank soal tidak dikenal." }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Aksi bank soal gagal.";
    return Response.json({ error: message.replace("FORBIDDEN_PERMISSION: ", "") }, { status: message.startsWith("FORBIDDEN") ? 403 : 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await admin(request);
    const body = await request.json() as Record<string, unknown>;
    const assignmentId = Number(body.assignment_id);
    const action = text(body.action, 30);
    if (!assignmentId || !["publish", "close", "reopen"].includes(action)) return Response.json({ error: "Perintah publikasi tes tidak valid." }, { status: 400 });
    const assignment = await database().prepare("SELECT id,admission_id,status,score,total_points FROM spmb_test_assignments WHERE id=?").bind(assignmentId).first<{id:number;admission_id:number;status:string;score:number;total_points:number}>();
    if (!assignment) return Response.json({ error: "Penugasan tes tidak ditemukan." }, { status: 404 });
    const timestamp = now();
    if (action === "publish") {
      const state = await database().prepare("SELECT submitted_at,published FROM spmb_test_assignments WHERE id=?").bind(assignmentId).first<{submitted_at:string;published:number}>();
      if (!state?.submitted_at || state.published) return Response.json({ error: "Hanya hasil tes selesai yang belum disahkan dapat dipublikasikan." }, { status: 409 });
      await database().prepare("UPDATE spmb_test_assignments SET published=1,status='Dinilai',updated_at=? WHERE id=?").bind(timestamp, assignmentId).run();
      await database().prepare("UPDATE admissions SET score=?,public_note='Hasil tes tersedia di portal pelacakan.',verified_by=?,verified_at=? WHERE id=?").bind(assignment.score, user.email, timestamp, assignment.admission_id).run();
      await database().prepare("INSERT INTO audit_logs (user_email,action,resource,record_id,detail,created_at) VALUES (?,?,?,?,?,?)").bind(user.email, "Publikasi Tes SPMB", "admissions", assignment.admission_id, `Nilai tes dipublikasikan melalui penugasan ${assignmentId}`, timestamp).run();
    } else {
      const state = await database().prepare("SELECT started_at,submitted_at,published FROM spmb_test_assignments WHERE id=?").bind(assignmentId).first<{started_at:string;submitted_at:string;published:number}>();
      if (action === "reopen" && (state?.started_at || state?.submitted_at || state?.published)) return Response.json({ error: "Tes yang sudah dibuka tidak dapat diulang tanpa prosedur reset terpisah." }, { status: 409 });
      await database().prepare("UPDATE spmb_test_assignments SET status=?,updated_at=? WHERE id=?").bind(action === "close" ? "Ditutup" : "Ditugaskan", timestamp, assignmentId).run();
    }
    return Response.json({ ok: true, message: "Status penugasan tes diperbarui." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Pembaruan tes gagal.";
    return Response.json({ error: message.replace("FORBIDDEN_PERMISSION: ", "") }, { status: message.startsWith("FORBIDDEN") ? 403 : 500 });
  }
}

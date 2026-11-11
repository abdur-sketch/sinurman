import { database, ensureUser, requirePermission } from "../../_lib";

const text = (value: unknown, max = 4000) => String(value ?? "").trim().slice(0, max);
const now = () => new Date().toISOString();
const categories = new Set(["Akademik", "Keagamaan", "Pengetahuan Umum", "Umum"]);
const difficulties = new Set(["Mudah", "Sedang", "Sulit"]);

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
      "SELECT id,prompt,options_json,correct_option,points,category,difficulty,active,archived_at,created_by,created_at,updated_at FROM spmb_test_questions ORDER BY id DESC",
    ).all();
    const assignments = await database().prepare(
      `SELECT a.id,a.admission_id,a.status,a.result_status,a.test_name,a.category,a.opens_at,a.closes_at,a.duration_minutes,a.question_count,a.passing_score,a.started_at,a.submitted_at,a.score,a.total_points,a.published,a.created_at,
              p.registration_no,p.name
       FROM spmb_test_assignments a JOIN admissions p ON p.id=a.admission_id
       ${admissionId ? "WHERE a.admission_id=?" : ""} ORDER BY a.id DESC`,
    ).bind(...(admissionId ? [admissionId] : [])).all();
    const admissions = await database().prepare("SELECT id,name,registration_no,status FROM admissions WHERE status NOT IN ('Tidak Lulus') ORDER BY id DESC").all();
    return Response.json({
      questions: questions.results.map((row) => ({ ...row, options: JSON.parse(String(row.options_json || "[]")) })),
      assignments: assignments.results,
      admissions: admissions.results,
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
    if (action === "question" || action === "edit-question") {
      const questionId = Number(body.id || 0);
      const prompt = text(body.prompt);
      const options = parseOptions(body.options);
      const correctOption = text(body.correct_option, 100);
      const points = Math.max(1, Math.min(100, Number(body.points || 1)));
      const category = text(body.category, 40) || "Umum";
      const difficulty = text(body.difficulty, 20) || "Sedang";
      if (prompt.length < 5 || options.length < 2 || !options.includes(correctOption) || !categories.has(category) || !difficulties.has(difficulty)) {
        return Response.json({ error: "Soal harus memiliki pertanyaan, minimal dua opsi, dan jawaban benar yang valid." }, { status: 400 });
      }
      if (action === "edit-question") {
        if (!questionId) return Response.json({ error: "Soal tidak ditemukan." }, { status: 404 });
        const used = await database().prepare("SELECT 1 FROM spmb_test_assignment_questions WHERE question_id=? LIMIT 1").bind(questionId).first();
        if (used) return Response.json({ error: "Soal yang sudah ditugaskan tidak dapat diubah; buat versi soal baru agar histori nilai tetap utuh." }, { status: 409 });
        await database().prepare("UPDATE spmb_test_questions SET prompt=?,options_json=?,correct_option=?,points=?,category=?,difficulty=?,updated_at=? WHERE id=?").bind(prompt, JSON.stringify(options), correctOption, points, category, difficulty, timestamp, questionId).run();
        return Response.json({ ok: true, message: "Soal berhasil diperbarui." });
      }
      const result = await database().prepare(
        "INSERT INTO spmb_test_questions (prompt,options_json,correct_option,points,category,difficulty,active,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,1,?,?,?)",
      ).bind(prompt, JSON.stringify(options), correctOption, points, category, difficulty, user.email, timestamp, timestamp).run();
      return Response.json({ ok: true, id: Number(result.meta.last_row_id), message: "Soal tes berhasil ditambahkan." });
    }
    if (action === "archive-question") {
      const questionId = Number(body.id);
      if (!questionId) return Response.json({ error: "Soal tidak ditemukan." }, { status: 404 });
      await database().prepare("UPDATE spmb_test_questions SET active=0,archived_at=?,updated_at=? WHERE id=?").bind(timestamp, timestamp, questionId).run();
      return Response.json({ ok: true, message: "Soal diarsipkan dan tidak akan dipakai untuk penugasan baru." });
    }
    if (action === "assign") {
      const admissionId = Number(body.admission_id);
      const questionIds = Array.isArray(body.question_ids) ? body.question_ids.map(Number).filter((id) => Number.isInteger(id) && id > 0) : [];
      const opensAt = text(body.opens_at, 40);
      const closesAt = text(body.closes_at, 40);
      const durationMinutes = Math.max(0, Math.min(600, Number(body.duration_minutes || 0)));
      const testName = text(body.test_name, 120) || "Tes SPMB";
      const category = text(body.category, 40) || "Umum";
      const instructions = text(body.instructions, 2000);
      const passingScore = Math.max(0, Math.min(100, Number(body.passing_score ?? 75)));
      const shuffleQuestions = body.shuffle_questions === true ? 1 : 0;
      const shuffleOptions = body.shuffle_options === true ? 1 : 0;
      if (!categories.has(category) || (opensAt && Number.isNaN(Date.parse(opensAt))) || (closesAt && Number.isNaN(Date.parse(closesAt))) || (opensAt && closesAt && Date.parse(closesAt) <= Date.parse(opensAt))) return Response.json({ error: "Jadwal atau kategori tes tidak valid." }, { status: 400 });
      if (!admissionId || !questionIds.length || new Set(questionIds).size !== questionIds.length) return Response.json({ error: "Pendaftar dan daftar soal yang unik wajib dipilih." }, { status: 400 });
      const admission = await database().prepare("SELECT id,status FROM admissions WHERE id=?").bind(admissionId).first<{id:number;status:string}>();
      if (!admission) return Response.json({ error: "Pendaftar tidak ditemukan." }, { status: 404 });
      const questions = await database().prepare(`SELECT id,prompt,options_json,correct_option,points,category,difficulty FROM spmb_test_questions WHERE active=1 AND archived_at='' AND id IN (${questionIds.map(() => "?").join(",")})`).bind(...questionIds).all<{id:number;prompt:string;options_json:string;correct_option:string;points:number;category:string;difficulty:string}>();
      if (questions.results.length !== new Set(questionIds).size) return Response.json({ error: "Ada soal yang tidak aktif atau tidak ditemukan." }, { status: 400 });
      const totalPoints = questions.results.reduce((sum, row) => sum + Number(row.points || 0), 0);
      const existing = await database().prepare("SELECT id,started_at,submitted_at,published FROM spmb_test_assignments WHERE admission_id=?").bind(admissionId).first<{id:number;started_at:string;submitted_at:string;published:number}>();
      if (existing && (existing.started_at || existing.submitted_at || existing.published)) return Response.json({ error: "Soal tidak dapat diubah setelah tes dibuka atau diselesaikan." }, { status: 409 });
      let assignmentId: number;
      if (existing) {
        assignmentId = existing.id;
        await database().batch([
          database().prepare("UPDATE spmb_test_assignments SET status='Ditugaskan',test_name=?,category=?,opens_at=?,closes_at=?,duration_minutes=?,question_count=?,shuffle_questions=?,shuffle_options=?,instructions=?,passing_score=?,total_points=?,updated_at=? WHERE id=?").bind(testName, category, opensAt, closesAt, durationMinutes, questionIds.length, shuffleQuestions, shuffleOptions, instructions, passingScore, totalPoints, timestamp, assignmentId),
          database().prepare("DELETE FROM spmb_test_assignment_questions WHERE assignment_id=?").bind(assignmentId),
        ]);
      } else {
        const created = await database().prepare("INSERT INTO spmb_test_assignments (admission_id,status,test_name,category,opens_at,closes_at,duration_minutes,question_count,shuffle_questions,shuffle_options,instructions,passing_score,total_points,created_by,created_at,updated_at) VALUES (?,'Ditugaskan',?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
          .bind(admissionId, testName, category, opensAt, closesAt, durationMinutes, questionIds.length, shuffleQuestions, shuffleOptions, instructions, passingScore, totalPoints, user.email, timestamp, timestamp).run();
        assignmentId = Number(created.meta.last_row_id);
      }
      await database().batch(questions.results.map((question) => database().prepare("INSERT INTO spmb_test_assignment_questions (assignment_id,question_id,snapshot_json) VALUES (?,?,?)").bind(assignmentId, question.id, JSON.stringify({ prompt: question.prompt, options: JSON.parse(question.options_json), correct_option: question.correct_option, points: question.points, category: question.category, difficulty: question.difficulty }))));
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
    const assignment = await database().prepare("SELECT id,admission_id,status,score,total_points,passing_score FROM spmb_test_assignments WHERE id=?").bind(assignmentId).first<{id:number;admission_id:number;status:string;score:number;total_points:number;passing_score:number}>();
    if (!assignment) return Response.json({ error: "Penugasan tes tidak ditemukan." }, { status: 404 });
    const timestamp = now();
    if (action === "publish") {
      const state = await database().prepare("SELECT submitted_at,published FROM spmb_test_assignments WHERE id=?").bind(assignmentId).first<{submitted_at:string;published:number}>();
      if (!state?.submitted_at || state.published) return Response.json({ error: "Hanya hasil tes selesai yang belum disahkan dapat dipublikasikan." }, { status: 409 });
      const resultStatus = Number(assignment.score) >= Number(assignment.passing_score) ? "Lulus" : "Tidak Lulus";
      await database().prepare("UPDATE spmb_test_assignments SET published=1,status='Dinilai',result_status=?,updated_at=? WHERE id=?").bind(resultStatus, timestamp, assignmentId).run();
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

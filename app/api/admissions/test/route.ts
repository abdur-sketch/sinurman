import { database, ensureUser, requirePermission } from "../../_lib";

const text = (value: unknown, max = 4000) => String(value ?? "").trim().slice(0, max);
const now = () => new Date().toISOString();
const categories = new Set(["Akademik", "Keagamaan", "Pengetahuan Umum", "Umum"]);
const difficulties = new Set(["Mudah", "Sedang", "Sulit"]);

function csvCell(value: unknown) {
  const raw = String(value ?? "");
  const textValue = /^[\s]*[=+@-]/.test(raw) ? `'${raw}` : raw;
  return /[",\n\r]/.test(textValue) ? `"${textValue.replaceAll('"', '""')}"` : textValue;
}

function parseCsv(input: string) {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (character === '"') {
      if (quoted && input[index + 1] === '"') { cell += '"'; index += 1; }
      else quoted = !quoted;
    } else if (character === "," && !quoted) { row.push(cell); cell = ""; }
    else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && input[index + 1] === "\n") index += 1;
      row.push(cell); cell = "";
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
    } else cell += character;
  }
  if (quoted) throw new Error("CSV memiliki tanda kutip yang tidak berpasangan.");
  if (cell || row.length) { row.push(cell); if (row.some((value) => value.trim())) rows.push(row); }
  return rows;
}

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
    const params = new URL(request.url).searchParams;
    const admissionId = Number(params.get("admissionId") || 0);
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
    const detailId = Number(params.get("detail") || 0);
    if (detailId) {
      const detail = await database().prepare(`SELECT a.id,a.admission_id,a.status,a.result_status,a.test_name,a.category,a.opens_at,a.closes_at,a.duration_minutes,a.question_count,a.passing_score,a.started_at,a.submitted_at,a.score,a.total_points,a.published,p.name,p.registration_no,p.desired_level AS unit
        FROM spmb_test_assignments a JOIN admissions p ON p.id=a.admission_id WHERE a.id=?`).bind(detailId).first<Record<string, unknown>>();
      if (!detail) return Response.json({ error: "Penugasan tes tidak ditemukan." }, { status: 404 });
      const answers = await database().prepare(`SELECT aq.question_id,aq.snapshot_json,ans.answer,ans.is_correct,ans.points_awarded,ans.answered_at
        FROM spmb_test_assignment_questions aq LEFT JOIN spmb_test_answers ans ON ans.assignment_id=aq.assignment_id AND ans.question_id=aq.question_id WHERE aq.assignment_id=? ORDER BY aq.question_id ASC`).bind(detailId).all();
      const rows = answers.results.map((row) => {
        const snapshot = row.snapshot_json ? JSON.parse(String(row.snapshot_json)) as Record<string, unknown> : {};
        const answer = row.answer == null ? "" : String(row.answer);
        const correct = String(snapshot.correct_option ?? "");
        return { question_id: row.question_id, prompt: snapshot.prompt ?? "", answer, correct_option: correct, status: !answer ? "Tidak dijawab" : Number(row.is_correct) ? "Benar" : "Salah", points: Number(snapshot.points ?? 0), points_awarded: Number(row.points_awarded ?? 0), answered_at: row.answered_at ?? "" };
      });
      const started = detail.started_at ? Date.parse(String(detail.started_at)) : 0;
      const submitted = detail.submitted_at ? Date.parse(String(detail.submitted_at)) : 0;
      return Response.json({ assignment: detail, answers: rows, summary: { correct: rows.filter((row) => row.status === "Benar").length, incorrect: rows.filter((row) => row.status === "Salah").length, unanswered: rows.filter((row) => row.status === "Tidak dijawab").length, duration_seconds: started && submitted ? Math.max(0, Math.round((submitted - started) / 1000)) : 0 } });
    }
    if (params.get("stats") === "1" || params.get("format") === "stats-csv") {
      const unit = params.get("unit") || "";
      const wave = text(params.get("wave"), 80);
      const status = text(params.get("status"), 30);
      const year = text(params.get("year"), 10);
      const from = text(params.get("from"), 30);
      const to = text(params.get("to"), 30);
      const allowedUnits = new Set(["", "SMP IT", "SMK"]);
      if (!allowedUnits.has(unit)) return Response.json({ error: "Filter unit tidak valid." }, { status: 400 });
      const filters: string[] = [], bindings: string[] = [];
      if (unit) { filters.push("p.desired_level=?"); bindings.push(unit); }
      if (wave) { filters.push("p.wave=?"); bindings.push(wave); }
      if (status) { filters.push("a.status=?"); bindings.push(status); }
      if (year) { filters.push("substr(p.created_at,1,4)=?"); bindings.push(year); }
      if (from) { filters.push("p.created_at>=?"); bindings.push(from); }
      if (to) { filters.push("p.created_at<=?"); bindings.push(to); }
      const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
      const query = `SELECT COUNT(*) total, COALESCE(SUM(CASE WHEN a.status='Ditugaskan' THEN 1 ELSE 0 END),0) assigned, COALESCE(SUM(CASE WHEN a.status='Dikerjakan' THEN 1 ELSE 0 END),0) in_progress, COALESCE(SUM(CASE WHEN a.submitted_at<>'' THEN 1 ELSE 0 END),0) completed, COALESCE(SUM(CASE WHEN a.submitted_at<>'' AND a.published=0 THEN 1 ELSE 0 END),0) pending, COALESCE(SUM(CASE WHEN a.result_status='Lulus' THEN 1 ELSE 0 END),0) passed, COALESCE(SUM(CASE WHEN a.result_status='Tidak Lulus' THEN 1 ELSE 0 END),0) failed, AVG(CASE WHEN a.published=1 THEN a.score END) average_score, MAX(CASE WHEN a.published=1 THEN a.score END) highest_score, MIN(CASE WHEN a.published=1 THEN a.score END) lowest_score, ROUND(100.0*SUM(CASE WHEN a.published=1 AND a.result_status='Lulus' THEN 1 ELSE 0 END)/NULLIF(SUM(CASE WHEN a.published=1 THEN 1 ELSE 0 END),0),2) pass_rate FROM spmb_test_assignments a JOIN admissions p ON p.id=a.admission_id ${where}`;
      const stats = await database().prepare(query).bind(...bindings).first<Record<string, unknown>>();
      if (params.get("format") === "stats-csv") {
        const headers = ["unit","total","assigned","in_progress","completed","pending","passed","failed","average_score","highest_score","lowest_score","pass_rate"];
        const values = [unit || "Semua", ...headers.slice(1).map((key) => stats?.[key] ?? "")];
        const csv = [headers, values].map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
        return new Response(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": "attachment; filename=spmb-statistik-tes.csv" } });
      }
      return Response.json({ stats });
    }
    if (params.get("format") === "csv" || params.get("format") === "template") {
      const headers = ["id", "prompt", "option_1", "option_2", "option_3", "option_4", "option_5", "option_6", "correct_option", "points", "category", "difficulty", "active"];
      const rows = params.get("format") === "template" ? [] : questions.results.map((row) => {
        const options = JSON.parse(String(row.options_json || "[]")) as string[];
        return [row.id, row.prompt, ...Array.from({ length: 6 }, (_, index) => options[index] || ""), row.correct_option, row.points, row.category, row.difficulty, row.active];
      });
      const csv = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
      return new Response(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename=spmb-bank-soal-${params.get("format")}.csv` } });
    }
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
    if (action === "import-csv") {
      const csv = text(body.csv, 1_000_000);
      let rows: string[][];
      try { rows = parseCsv(csv); } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Format CSV tidak valid." }, { status: 400 }); }
      if (rows.length < 2) return Response.json({ error: "CSV kosong atau hanya berisi header." }, { status: 400 });
      if (rows.length - 1 > 500) return Response.json({ error: "Maksimal 500 baris soal per impor." }, { status: 400 });
      const headers = rows[0].map((header) => header.trim().toLowerCase());
      const required = ["prompt", "option_1", "option_2", "correct_option", "points", "category", "difficulty"];
      const missing = required.filter((header) => !headers.includes(header));
      if (missing.length) return Response.json({ error: `Kolom wajib belum ada: ${missing.join(", ")}` }, { status: 400 });
      const index = (name: string) => headers.indexOf(name);
      const existingQuestions = await database().prepare("SELECT prompt,options_json FROM spmb_test_questions").all<{prompt:string;options_json:string}>();
      const signatures = new Set(existingQuestions.results.map((question) => `${question.prompt.toLowerCase()}|${(JSON.parse(question.options_json || "[]") as string[]).map((option) => option.toLowerCase()).join("|")}`));
      const errors: string[] = [], inserts: Array<[string, string, string, number, string, string]> = [];
      rows.slice(1).forEach((values, offset) => {
        const line = offset + 2;
        const prompt = text(values[index("prompt")], 4000);
        const options = Array.from({ length: 6 }, (_, optionIndex) => text(values[index(`option_${optionIndex + 1}`)], 300)).filter(Boolean);
        const correctOption = text(values[index("correct_option")], 100);
        const points = Number(values[index("points")] || 1);
        const category = text(values[index("category")], 40) || "Umum";
        const difficulty = text(values[index("difficulty")], 20) || "Sedang";
        const signature = `${prompt.toLowerCase()}|${options.map((option) => option.toLowerCase()).join("|")}`;
        if (prompt.length < 5 || options.length < 2 || !options.includes(correctOption) || !Number.isFinite(points) || points < 1 || points > 100 || !categories.has(category) || !difficulties.has(difficulty)) errors.push(`Baris ${line}: pertanyaan, opsi, jawaban, poin, kategori, atau kesulitan tidak valid.`);
        else if (signatures.has(signature)) errors.push(`Baris ${line}: soal duplikat dengan bank soal atau baris lain.`);
        else { signatures.add(signature); inserts.push([prompt, JSON.stringify(options), correctOption, Math.round(points), category, difficulty]); }
      });
      if (errors.length) return Response.json({ ok: false, imported: 0, errors }, { status: 400 });
      if (inserts.length > 500) return Response.json({ error: "Maksimal 500 soal per impor." }, { status: 400 });
      if (inserts.length) await database().batch(inserts.map(([prompt, optionsJson, correctOption, points, category, difficulty]) => database().prepare("INSERT INTO spmb_test_questions (prompt,options_json,correct_option,points,category,difficulty,active,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,1,?,?,?)").bind(prompt, optionsJson, correctOption, points, category, difficulty, user.email, timestamp, timestamp)));
      return Response.json({ ok: true, imported: inserts.length, errors: [] });
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
      const resultStatus = Number(assignment.score) >= Number(assignment.passing_score) ? "Lulus" : "Tidak Lulus";
      // The conditional first statement is the compare-and-set gate. D1 batches are
      // atomic, so only the request that changes published 0 -> 1 may write the
      // admission result and audit row; concurrent requests become no-ops.
      const publication = await database().batch([
        database().prepare("UPDATE spmb_test_assignments SET published=1,status='Dinilai',result_status=?,updated_at=? WHERE id=? AND submitted_at<>'' AND published=0").bind(resultStatus, timestamp, assignmentId),
        database().prepare("UPDATE admissions SET score=?,public_note='Hasil tes tersedia di portal pelacakan.',verified_by=?,verified_at=? WHERE id=? AND EXISTS (SELECT 1 FROM spmb_test_assignments WHERE id=? AND published=1 AND updated_at=? AND admission_id=?)").bind(assignment.score, user.email, timestamp, assignment.admission_id, assignmentId, timestamp, assignment.admission_id),
        database().prepare("INSERT INTO audit_logs (user_email,action,resource,record_id,detail,created_at) SELECT ?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM spmb_test_assignments WHERE id=? AND published=1 AND updated_at=? AND admission_id=?)").bind(user.email, "Publikasi Tes SPMB", "admissions", assignment.admission_id, `Nilai tes dipublikasikan melalui penugasan ${assignmentId}`, timestamp, assignmentId, timestamp, assignment.admission_id),
      ]);
      if (!publication[0]?.meta.changes) return Response.json({ error: "Hasil tes sudah disahkan atau belum disubmit." }, { status: 409 });
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

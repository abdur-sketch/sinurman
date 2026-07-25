import { canWrite, database, ensureUser, normalizeGuardianPhone } from "../_lib";
import { notifyRecordChange } from "../_notifications";
import { quranRangeAmount } from "../../quran-data";

const resourceConfig = {
  students: {
    table: "students",
    columns: ["name", "nis", "class_name", "room", "guardian_name", "guardian_phone", "guardian_email", "status", "created_at"],
    required: ["name", "nis", "class_name", "room", "guardian_name", "guardian_phone"],
  },
  employees: {
    table: "employees",
    columns: ["employee_no","name","gender","birth_place","birth_date","phone","email","position","work_unit","employment_type","education","join_date","address","status","created_at","updated_at"],
    required: ["employee_no","name","gender","position","work_unit","employment_type","join_date"],
  },
  tahfidz: {
    table: "tahfidz_records",
    columns: ["student_id", "surah", "verses", "surah_from", "surah_to", "verse_from", "verse_to", "amount", "grade", "teacher", "recorded_at"],
    required: ["student_id", "surah_from", "surah_to", "verse_from", "verse_to", "amount", "grade"],
  },
  mutabaah: {
    table: "mutabaah_records",
    columns: ["student_id", "activity", "completed", "record_date", "recorded_by"],
    required: ["student_id", "activity", "record_date"],
  },
  health: {
    table: "health_records",
    columns: ["student_id", "complaint", "diagnosis", "treatment", "status", "recorded_at"],
    required: ["student_id", "complaint", "diagnosis", "treatment"],
  },
  transactions: {
    table: "transactions",
    columns: ["student_id", "type", "category", "amount", "status", "note", "recorded_at"],
    required: ["student_id", "type", "category", "amount"],
  },
  inventory: {
    table: "inventory_items",
    columns: ["name", "location", "quantity", "unit", "condition", "updated_at"],
    required: ["name", "location", "quantity", "unit"],
  },
  announcements: {
    table: "announcements",
    columns: ["title", "category", "content", "audience", "published_at", "author"],
    required: ["title", "category", "content"],
  },
  characters: {
    table: "character_reports",
    columns: ["student_id", "category", "score", "note", "semester", "recorded_at"],
    required: ["student_id", "category", "score"],
  },
  attendance: {
    table: "attendance_records",
    columns: ["student_id", "record_date", "status", "note", "recorded_by"],
    required: ["student_id", "record_date", "status"],
  },
  subjects: {
    table: "academic_subjects",
    columns: ["code","name","education_level","class_name","teacher","semester","academic_year","minimum_score","created_at"],
    required: ["code","name","education_level","class_name","teacher","semester","academic_year","minimum_score"],
  },
  grades: {
    table: "academic_grades",
    columns: ["student_id","subject_id","assignment_score","midterm_score","exam_score","final_score","predicate","note","semester","academic_year","recorded_by","recorded_at"],
    required: ["student_id","subject_id","assignment_score","midterm_score","exam_score"],
  },
  permits: {
    table: "leave_permits",
    columns: ["student_id", "start_date", "end_date", "reason", "status", "approved_by"],
    required: ["student_id", "start_date", "end_date", "reason"],
  },
  schedules: {
    table: "schedules",
    columns: ["education_level", "class_name", "title", "category", "teacher", "location", "day_name", "start_time", "end_time"],
    required: ["education_level", "class_name", "title", "category", "teacher", "location", "day_name", "start_time", "end_time"],
  },
  rooms: {
    table: "rooms",
    columns: ["name", "capacity", "supervisor", "status"],
    required: ["name", "capacity", "supervisor"],
  },
  admissions: {
    table: "admissions",
    columns: ["registration_no", "name", "applicant_email", "nisn", "birth_place", "birth_date", "gender", "desired_level", "guardian_name", "guardian_phone", "previous_school", "address", "status", "score", "verification_note", "verified_by", "verified_at", "created_at"],
    required: ["registration_no", "name", "guardian_name", "guardian_phone", "previous_school"],
  },
  counseling: {
    table: "counseling_records",
    columns: ["student_id", "type", "category", "description", "points", "status", "counselor", "recorded_at"],
    required: ["student_id", "type", "category", "description"],
  },
  bills: {
    table: "bills",
    columns: ["student_id", "invoice_no", "category", "amount", "due_date", "status", "payment_url", "payment_method", "payment_reference", "paid_at", "created_at"],
    required: ["student_id", "invoice_no", "category", "amount", "due_date"],
  },
  users: {
    table: "users",
    columns: ["email", "name", "role", "room_scope", "created_at"],
    required: ["email", "name", "role"],
  },
} as const;

type Resource = keyof typeof resourceConfig;

export async function POST(request: Request) {
  try {
    const user = await ensureUser(request);
    const payload = (await request.json()) as {
      action?: "create" | "update" | "delete";
      resource?: Resource;
      id?: number;
      data?: Record<string, unknown>;
    };
    const action = payload.action ?? "create";
    const resource = payload.resource;
    if (!resource || !(resource in resourceConfig)) {
      return Response.json({ error: "Modul tidak valid." }, { status: 400 });
    }
    if (!canWrite(user.role, resource)) {
      return Response.json({ error: "Peran Anda tidak memiliki izin untuk tindakan ini." }, { status: 403 });
    }
    const db = database();
    const config = resourceConfig[resource];
    if (user.role === "Musyrif" || user.role === "Kepala Asrama") {
      const studentResources = new Set<Resource>(["tahfidz","mutabaah","health","characters","attendance","permits","counseling","grades"]);
      if (studentResources.has(resource)) {
        let studentId = Number(payload.data?.student_id ?? 0);
        if (!studentId && payload.id) {
          const record = await db.prepare(`SELECT student_id FROM ${config.table} WHERE id=?`).bind(payload.id).first<{ student_id:number }>();
          studentId = Number(record?.student_id ?? 0);
        }
        const assigned = studentId
          ? await db.prepare("SELECT id FROM students WHERE id=? AND room=?").bind(studentId, user.roomScope || "__BELUM_DITUGASKAN__").first()
          : null;
        if (!assigned) return Response.json({ error: "Santri ini berada di luar penugasan kamar Anda." }, { status: 403 });
      }
    }
    if (action === "delete") {
      if (!payload.id) return Response.json({ error: "ID wajib diisi." }, { status: 400 });
      await db.prepare(`DELETE FROM ${config.table} WHERE id = ?`).bind(payload.id).run();
      await db.prepare("INSERT INTO audit_logs (user_email, action, resource, record_id, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)")
        .bind(user.email, "Hapus", resource, payload.id, `Menghapus data ${resource}`, new Date().toISOString()).run();
      return Response.json({ ok: true });
    }

    const source:Record<string,unknown> = { ...(payload.data ?? {}) };
    if (resource === "students" && source.guardian_phone !== undefined) {
      source.guardian_phone = normalizeGuardianPhone(source.guardian_phone);
      if (!/^62\d{8,13}$/.test(String(source.guardian_phone))) {
        return Response.json({ error:"Nomor WhatsApp wali tidak valid." }, { status:400 });
      }
    }
    if (resource === "tahfidz") {
      const surahFrom=String(source.surah_from??"").trim();
      const surahTo=String(source.surah_to??"").trim();
      const verseFrom=Number(source.verse_from??0);
      const verseTo=Number(source.verse_to??0);
      if(!surahFrom||!surahTo) return Response.json({error:"Surat awal dan surat akhir wajib diisi."},{status:400});
      if(!Number.isInteger(verseFrom)||!Number.isInteger(verseTo)||verseFrom<1||verseTo<1) return Response.json({error:"Ayat awal dan ayat akhir harus berupa angka mulai dari 1."},{status:400});
      if(surahFrom===surahTo&&verseTo<verseFrom) return Response.json({error:"Ayat akhir tidak boleh lebih kecil dari ayat awal."},{status:400});
      try { source.amount=quranRangeAmount(surahFrom,verseFrom,surahTo,verseTo); }
      catch(error) { return Response.json({error:error instanceof Error?error.message:"Rentang hafalan tidak valid."},{status:400}); }
      source.surah=surahFrom===surahTo?surahFrom:`${surahFrom} s.d. ${surahTo}`;
      source.verses=`${verseFrom}-${verseTo}`;
    }
    if (resource === "grades") {
      const scores=["assignment_score","midterm_score","exam_score"].map(key=>Number(source[key]));
      if(scores.some(score=>!Number.isFinite(score)||score<0||score>100)) return Response.json({error:"Semua komponen nilai harus berada pada rentang 0–100."},{status:400});
      const finalScore=Math.round(scores[0]*0.3+scores[1]*0.3+scores[2]*0.4);
      source.final_score=finalScore;
      source.predicate=finalScore>=90?"A":finalScore>=80?"B":finalScore>=70?"C":"D";
    }
    if (action === "update") {
      if (!payload.id) return Response.json({ error: "ID wajib diisi." }, { status: 400 });
      const columns = config.columns.filter((column) => source[column] !== undefined);
      if (!columns.length) return Response.json({ error: "Tidak ada perubahan." }, { status: 400 });
      const values = columns.map((column) => source[column]);
      await db.prepare(`UPDATE ${config.table} SET ${columns.map(c => `${c} = ?`).join(", ")} WHERE id = ?`)
        .bind(...values, payload.id).run();
      await db.prepare("INSERT INTO audit_logs (user_email, action, resource, record_id, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)")
        .bind(user.email, "Ubah", resource, payload.id, `Memperbarui data ${resource}`, new Date().toISOString()).run();
      if(["permits","attendance","tahfidz","health","bills","grades","characters","counseling"].includes(resource)) {
        const updated=await db.prepare(`SELECT * FROM ${config.table} WHERE id=?`).bind(payload.id).first<Record<string,unknown>>();
        if(updated) try{await notifyRecordChange(resource,updated);}catch{/* notification must not block the record */}
      }
      return Response.json({ ok: true });
    }

    for (const field of config.required) {
      if (source[field] === undefined || source[field] === "") {
        return Response.json({ error: `${field} wajib diisi.` }, { status: 400 });
      }
    }
    const now = new Date().toISOString();
    const defaults: Record<string, unknown> = {
      status: resource === "students" ? "Aktif" : resource === "transactions" ? "Berhasil" : resource === "health" ? "Dipantau" : undefined,
      created_at: now,
      recorded_at: now,
      updated_at: now,
      published_at: now,
      teacher: user.name,
      author: user.name,
      audience: "Semua",
      semester: "Ganjil 2026/2027",
      note: "",
      condition: "Baik",
      record_date: now.slice(0,10),
      recorded_by: user.name,
      approved_by: user.name,
      counselor: user.name,
      score: 0,
      points: 0,
      payment_url: "",
      role: "Wali Santri",
      academic_year: "2026/2027",
    };
    const data = { ...defaults, ...source };
    const columns = config.columns.filter((column) => data[column] !== undefined);
    const values = columns.map((column) => data[column]);
    const placeholders = columns.map(() => "?").join(", ");
    const result = await db.prepare(`INSERT INTO ${config.table} (${columns.join(", ")}) VALUES (${placeholders})`)
      .bind(...values).run();
    await db.prepare("INSERT INTO audit_logs (user_email, action, resource, record_id, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(user.email, "Tambah", resource, result.meta.last_row_id, `Menambahkan data ${resource}`, now).run();
    if(["attendance","tahfidz","health","bills","grades","characters","counseling"].includes(resource)) {
      try{await notifyRecordChange(resource,data);}catch{/* notification must not block the record */}
    }
    return Response.json({ ok: true, id: result.meta.last_row_id }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Tindakan gagal.";
    return Response.json({ error: message.includes("UNIQUE") ? "Data unik tersebut sudah digunakan." : message }, { status: 500 });
  }
}

import { canWrite, database, ensureUser } from "../_lib";

const resourceConfig = {
  students: {
    table: "students",
    columns: ["name", "nis", "class_name", "room", "guardian_name", "guardian_phone", "status", "created_at"],
    required: ["name", "nis", "class_name", "room", "guardian_name", "guardian_phone"],
  },
  tahfidz: {
    table: "tahfidz_records",
    columns: ["student_id", "surah", "verses", "amount", "grade", "teacher", "recorded_at"],
    required: ["student_id", "surah", "verses", "amount", "grade"],
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
  permits: {
    table: "leave_permits",
    columns: ["student_id", "start_date", "end_date", "reason", "status", "approved_by"],
    required: ["student_id", "start_date", "end_date", "reason"],
  },
  schedules: {
    table: "schedules",
    columns: ["title", "category", "teacher", "location", "day_name", "start_time", "end_time"],
    required: ["title", "category", "teacher", "location", "day_name", "start_time", "end_time"],
  },
  rooms: {
    table: "rooms",
    columns: ["name", "capacity", "supervisor", "status"],
    required: ["name", "capacity", "supervisor"],
  },
  admissions: {
    table: "admissions",
    columns: ["registration_no", "name", "guardian_name", "guardian_phone", "previous_school", "status", "score", "created_at"],
    required: ["registration_no", "name", "guardian_name", "guardian_phone", "previous_school"],
  },
  counseling: {
    table: "counseling_records",
    columns: ["student_id", "type", "category", "description", "points", "status", "counselor", "recorded_at"],
    required: ["student_id", "type", "category", "description"],
  },
  bills: {
    table: "bills",
    columns: ["student_id", "invoice_no", "category", "amount", "due_date", "status", "payment_url", "created_at"],
    required: ["student_id", "invoice_no", "category", "amount", "due_date"],
  },
  users: {
    table: "users",
    columns: ["email", "name", "role", "created_at"],
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
    if (action === "delete") {
      if (!payload.id) return Response.json({ error: "ID wajib diisi." }, { status: 400 });
      await db.prepare(`DELETE FROM ${config.table} WHERE id = ?`).bind(payload.id).run();
      await db.prepare("INSERT INTO audit_logs (user_email, action, resource, record_id, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)")
        .bind(user.email, "Hapus", resource, payload.id, `Menghapus data ${resource}`, new Date().toISOString()).run();
      return Response.json({ ok: true });
    }

    const source = payload.data ?? {};
    if (action === "update") {
      if (!payload.id) return Response.json({ error: "ID wajib diisi." }, { status: 400 });
      const columns = config.columns.filter((column) => source[column] !== undefined);
      if (!columns.length) return Response.json({ error: "Tidak ada perubahan." }, { status: 400 });
      const values = columns.map((column) => source[column]);
      await db.prepare(`UPDATE ${config.table} SET ${columns.map(c => `${c} = ?`).join(", ")} WHERE id = ?`)
        .bind(...values, payload.id).run();
      await db.prepare("INSERT INTO audit_logs (user_email, action, resource, record_id, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)")
        .bind(user.email, "Ubah", resource, payload.id, `Memperbarui data ${resource}`, new Date().toISOString()).run();
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
    };
    const data = { ...defaults, ...source };
    const columns = config.columns.filter((column) => data[column] !== undefined);
    const values = columns.map((column) => data[column]);
    const placeholders = columns.map(() => "?").join(", ");
    const result = await db.prepare(`INSERT INTO ${config.table} (${columns.join(", ")}) VALUES (${placeholders})`)
      .bind(...values).run();
    await db.prepare("INSERT INTO audit_logs (user_email, action, resource, record_id, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(user.email, "Tambah", resource, result.meta.last_row_id, `Menambahkan data ${resource}`, now).run();
    return Response.json({ ok: true, id: result.meta.last_row_id }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Tindakan gagal.";
    return Response.json({ error: message.includes("UNIQUE") ? "Data unik tersebut sudah digunakan." : message }, { status: 500 });
  }
}

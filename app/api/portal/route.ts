import { database, ensureUser, guardianOwnsStudent, type AuthenticatedUser } from "../_lib";

async function canAccessStudent(user: Pick<AuthenticatedUser,"email"|"role"|"guardianPhone">, studentId: number) {
  if (user.role === "Admin") return true;
  if (user.role !== "Wali Santri") return false;
  return guardianOwnsStudent(user, studentId);
}

export async function POST(request: Request) {
  try {
    const user = await ensureUser(request);
    const payload = await request.json() as {
      action?: "contact" | "permit" | "reply";
      studentId?: number;
      subject?: string;
      message?: string;
      startDate?: string;
      endDate?: string;
      reason?: string;
      messageId?: number;
      reply?: string;
    };
    const now = new Date().toISOString();
    const db = database();

    if (payload.action === "reply") {
      if (user.role !== "Admin" || !payload.messageId || !payload.reply?.trim()) {
        return Response.json({ error: "Balasan hanya dapat dikirim oleh Admin." }, { status: 403 });
      }
      await db.prepare("UPDATE guardian_messages SET reply=?, status='Dibalas', replied_at=? WHERE id=?")
        .bind(payload.reply.trim(), now, payload.messageId).run();
      return Response.json({ ok: true });
    }

    const studentId = Number(payload.studentId);
    if (!studentId || !(await canAccessStudent(user, studentId))) {
      return Response.json({ error: "Santri tidak terhubung dengan akun ini." }, { status: 403 });
    }

    if (payload.action === "contact") {
      if (!payload.subject?.trim() || !payload.message?.trim()) {
        return Response.json({ error: "Subjek dan pesan wajib diisi." }, { status: 400 });
      }
      await db.prepare("INSERT INTO guardian_messages (student_id, sender_email, subject, message, status, reply, created_at, replied_at) VALUES (?, ?, ?, ?, 'Baru', '', ?, '')")
        .bind(studentId, user.email, payload.subject.trim(), payload.message.trim(), now).run();
      return Response.json({ ok: true }, { status: 201 });
    }

    if (payload.action === "permit") {
      if (!payload.startDate || !payload.endDate || !payload.reason?.trim()) {
        return Response.json({ error: "Tanggal dan alasan izin wajib diisi." }, { status: 400 });
      }
      if (payload.endDate < payload.startDate) {
        return Response.json({ error: "Tanggal selesai tidak boleh sebelum tanggal mulai." }, { status: 400 });
      }
      await db.prepare("INSERT INTO leave_permits (student_id, start_date, end_date, reason, status, approved_by) VALUES (?, ?, ?, ?, 'Diajukan', '-')")
        .bind(studentId, payload.startDate, payload.endDate, payload.reason.trim()).run();
      return Response.json({ ok: true }, { status: 201 });
    }

    return Response.json({ error: "Tindakan portal tidak valid." }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Tindakan gagal." }, { status: 500 });
  }
}

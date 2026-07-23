import { database, ensureUser } from "../_lib";

export async function POST(request: Request) {
  try {
    const user = await ensureUser(request);
    if (user.role === "Wali Santri") {
      return Response.json({ error: "Peran Anda tidak dapat mengirim notifikasi." }, { status: 403 });
    }
    const payload = (await request.json()) as {
      studentId?: number;
      recipient?: string;
      message?: string;
      channel?: string;
    };
    if (!payload.recipient || !payload.message) {
      return Response.json({ error: "Penerima dan pesan wajib diisi." }, { status: 400 });
    }
    const now = new Date().toISOString();
    await database()
      .prepare("INSERT INTO notification_logs (student_id, channel, recipient, message, status, sent_at) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(payload.studentId ?? null, payload.channel ?? "WhatsApp", payload.recipient, payload.message, "Disiapkan", now)
      .run();
    const phone = payload.recipient.replace(/\D/g, "").replace(/^0/, "62");
    const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(payload.message)}`;
    return Response.json({ ok: true, whatsappUrl });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Notifikasi gagal." }, { status: 500 });
  }
}

import { ensureUser } from "../_lib";
import { sendWhatsappNotification } from "../_notifications";

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
    const {whatsappUrl,automatic,status}=await sendWhatsappNotification({studentId:payload.studentId,recipient:payload.recipient,message:payload.message,channel:payload.channel});
    return Response.json({ ok: true, whatsappUrl, automatic, status });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Notifikasi gagal." }, { status: 500 });
  }
}

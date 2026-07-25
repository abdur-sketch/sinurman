import { database, ensureUser, normalizeGuardianPhone, setGuardianPin } from "../_lib";

export async function POST(request: Request) {
  try {
    const user = await ensureUser(request);
    if (user.role !== "Admin") {
      return Response.json({ error: "Hanya Admin yang dapat mengatur PIN wali." }, { status: 403 });
    }
    const body = await request.json() as { phone?: string; pin?: string };
    const pin = String(body.pin ?? "");
    const phone = await setGuardianPin(body.phone, pin);
    const now = new Date().toISOString();
    await database().prepare(
      "INSERT INTO audit_logs (user_email,action,resource,record_id,detail,created_at) VALUES (?,?,?,NULL,?,?)",
    ).bind(user.email, "Ubah", "guardian_accounts", `PIN Portal Wali diatur untuk ${phone}`, now).run();
    return Response.json({ ok: true, phone, message: "PIN Portal Wali berhasil disimpan." });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "PIN wali gagal disimpan." },
      { status: 400 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await ensureUser(request);
    if (user.role !== "Admin") {
      return Response.json({ error: "Hanya Admin yang dapat mengubah akses wali." }, { status: 403 });
    }
    const body = await request.json() as { phone?: string; status?: string };
    const phone = normalizeGuardianPhone(body.phone);
    const status = body.status === "Diblokir" ? "Diblokir" : "Aktif";
    const result = await database().prepare("UPDATE guardian_accounts SET status=?,updated_at=? WHERE phone=?")
      .bind(status, new Date().toISOString(), phone).run();
    if (!result.meta.changes) return Response.json({ error: "Akun wali belum dibuat." }, { status: 404 });
    if (status === "Diblokir") {
      const account = await database().prepare("SELECT id FROM guardian_accounts WHERE phone=?").bind(phone).first<{id:number}>();
      if (account) await database().prepare("DELETE FROM guardian_sessions WHERE account_id=?").bind(account.id).run();
    }
    return Response.json({ ok: true, status });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Status akun gagal diperbarui." },
      { status: 400 },
    );
  }
}

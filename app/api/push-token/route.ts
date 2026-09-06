import { database, ensureUser } from "../_lib";

export async function POST(request: Request) {
  try {
    const user = await ensureUser(request);
    const body = await request.json() as { token?: string };
    const token = String(body.token || "").trim();
    if (!token || token.length < 40) return Response.json({ error: "Token perangkat tidak valid." }, { status: 400 });
    const now = new Date().toISOString();
    await database().prepare(`INSERT INTO push_tokens (token,user_email,role,user_agent,enabled,created_at,updated_at) VALUES (?,?,?,?,1,?,?) ON CONFLICT(token) DO UPDATE SET user_email=excluded.user_email,role=excluded.role,user_agent=excluded.user_agent,enabled=1,updated_at=excluded.updated_at`)
      .bind(token, user.email, user.role, String(request.headers.get("user-agent") || "").slice(0, 180), now, now).run();
    return Response.json({ ok: true, message: "Notifikasi perangkat berhasil diaktifkan." });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Token perangkat gagal disimpan." }, { status: 401 });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await ensureUser(request);
    const body = await request.json() as { token?: string };
    const token = String(body.token || "").trim();
    if (token) await database().prepare("UPDATE push_tokens SET enabled=0,updated_at=? WHERE token=? AND user_email=?").bind(new Date().toISOString(), token, user.email).run();
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Token perangkat gagal dinonaktifkan." }, { status: 401 });
  }
}

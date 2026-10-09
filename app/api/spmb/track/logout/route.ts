import { database, ensureDatabaseSchema } from "../../../_lib";

async function hash(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes)).map((x) => x.toString(16).padStart(2, "0")).join("");
}

export async function POST(request: Request) {
  await ensureDatabaseSchema();
  const token = request.headers.get("cookie")?.match(/(?:^|; )spmb_portal_session=([^;]+)/)?.[1] || "";
  if (token) await database().prepare("DELETE FROM spmb_portal_sessions WHERE token_hash=?").bind(await hash(token)).run();
  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      "content-type": "application/json",
      "set-cookie": "spmb_portal_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0",
    },
  });
}

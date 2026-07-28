import { env } from "cloudflare:workers";
import { database, ensureUser } from "../../_lib";

const logoKey = "branding/sinurman-logo";
const allowedTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
const maxSize = 2 * 1024 * 1024;

export async function GET() {
  try {
    const object = await env.FILES.get(logoKey);
    if (!object) return new Response(null, { status: 404 });
    return new Response(object.body, {
      headers: {
        "content-type": object.httpMetadata?.contentType || "image/png",
        "cache-control": "no-store, max-age=0",
        "x-content-type-options": "nosniff",
      },
    });
  } catch {
    return new Response(null, { status: 404 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await ensureUser(request);
    if (user.role !== "Admin") {
      return Response.json({ error: "Hanya Admin yang dapat mengganti logo sekolah." }, { status: 403 });
    }
    const form = await request.formData();
    const file = form.get("logo");
    if (!(file instanceof File) || !file.size) {
      return Response.json({ error: "Pilih berkas logo terlebih dahulu." }, { status: 400 });
    }
    if (!allowedTypes.has(file.type)) {
      return Response.json({ error: "Format logo harus PNG, JPG, atau WebP." }, { status: 400 });
    }
    if (file.size > maxSize) {
      return Response.json({ error: "Ukuran logo maksimal 2 MB." }, { status: 400 });
    }
    await env.FILES.put(logoKey, await file.arrayBuffer(), {
      httpMetadata: { contentType: file.type },
      customMetadata: { uploadedBy: user.email, originalName: file.name },
    });
    await database().prepare(
      "INSERT INTO audit_logs (user_email,action,resource,record_id,detail,created_at) VALUES (?,?,?,NULL,?,?)",
    ).bind(user.email, "Ubah", "branding", `Logo sekolah diganti: ${file.name}`, new Date().toISOString()).run();
    return Response.json({ ok: true, message: "Logo sekolah berhasil diperbarui." });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Logo sekolah gagal diperbarui." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await ensureUser(request);
    if (user.role !== "Admin") {
      return Response.json({ error: "Hanya Admin yang dapat menghapus logo sekolah." }, { status: 403 });
    }
    await env.FILES.delete(logoKey);
    await database().prepare(
      "INSERT INTO audit_logs (user_email,action,resource,record_id,detail,created_at) VALUES (?,?,?,NULL,?,?)",
    ).bind(user.email, "Hapus", "branding", "Logo sekolah dikembalikan ke logo bawaan", new Date().toISOString()).run();
    return Response.json({ ok: true, message: "Logo bawaan SINURMAN digunakan kembali." });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Logo sekolah gagal dihapus." },
      { status: 500 },
    );
  }
}

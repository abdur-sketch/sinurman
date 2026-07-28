import { database, ensureUser, type Role } from "../_lib";
import { firebaseAdmin } from "../../../lib/firebase/admin";
import { revokeFirebaseSessions } from "../../../lib/firebase/session";

export const runtime = "nodejs";

const ownerEmail = "baikganteng88@gmail.com";
const managedRoles = new Set<Role>(["Admin", "Kepala Asrama", "Musyrif", "Ustadz"]);

function normalizeEmail(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function validatePassword(value: unknown, required: boolean) {
  const password = String(value ?? "");
  if (!password && !required) return "";
  if (password.length < 8) throw new Error("Kata sandi minimal 8 karakter.");
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    throw new Error("Kata sandi harus memuat huruf dan angka.");
  }
  return password;
}

async function requireAdmin(request: Request) {
  const user = await ensureUser(request);
  if (user.role !== "Admin") throw new Error("Hanya Admin yang dapat mengatur pengguna.");
  return user;
}

async function targetById(id: number) {
  return database().prepare(
    "SELECT id,email,name,role,room_scope AS roomScope,created_at AS createdAt FROM users WHERE id=?",
  ).bind(id).first<{
    id:number;
    email:string;
    name:string;
    role:Role;
    roomScope:string;
    createdAt:string;
  }>();
}

async function audit(actor: string, action: string, id: number | null, detail: string) {
  await database().prepare(
    "INSERT INTO audit_logs (user_email,action,resource,record_id,detail,created_at) VALUES (?,?,?,?,?,?)",
  ).bind(actor, action, "users", id, detail, new Date().toISOString()).run();
}

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const rows = await database().prepare(
      "SELECT id,email,name,role,room_scope AS roomScope,created_at AS createdAt FROM users ORDER BY id",
    ).all<{id:number;email:string;name:string;role:Role;roomScope:string;createdAt:string}>();
    const users = await Promise.all(rows.results.map(async row => {
      try {
        const account = await firebaseAdmin().auth.getUserByEmail(row.email);
        return {
          ...row,
          uid: account.uid,
          status: account.disabled ? "Diblokir" : "Aktif",
          emailVerified: account.emailVerified,
        };
      } catch {
        return { ...row, uid: "", status: "Belum memiliki akun login", emailVerified: false };
      }
    }));
    return Response.json({ users });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Pengguna gagal dimuat.";
    return Response.json({ error: message }, { status: message.includes("Hanya Admin") ? 403 : 500 });
  }
}

export async function POST(request: Request) {
  let createdUid = "";
  try {
    const actor = await requireAdmin(request);
    const body = await request.json() as {
      email?:string;
      name?:string;
      role?:Role;
      roomScope?:string;
      password?:string;
    };
    const email = normalizeEmail(body.email);
    const name = String(body.name ?? "").trim();
    const role = body.role as Role;
    const roomScope = String(body.roomScope ?? "").trim();
    const password = validatePassword(body.password, true);
    if (!email || !email.includes("@")) throw new Error("Email pengguna tidak valid.");
    if (!name) throw new Error("Nama pengguna wajib diisi.");
    if (!managedRoles.has(role)) throw new Error("Peran pengguna internal tidak valid.");
    if ((role === "Musyrif" || role === "Kepala Asrama") && !roomScope) {
      throw new Error("Kamar/asrama penugasan wajib dipilih untuk peran ini.");
    }
    const duplicate = await database().prepare("SELECT id FROM users WHERE lower(email)=?").bind(email).first();
    if (duplicate) throw new Error("Email tersebut sudah terdaftar di SINURMAN.");
    try {
      await firebaseAdmin().auth.getUserByEmail(email);
      throw new Error("Email tersebut sudah memiliki akun Firebase.");
    } catch (error) {
      const code = String((error as {code?:string})?.code ?? "");
      if (code !== "auth/user-not-found" && !(error instanceof Error && error.message.toLowerCase().includes("no user record"))) throw error;
    }
    const account = await firebaseAdmin().auth.createUser({
      email,
      password,
      displayName: name,
      emailVerified: true,
      disabled: false,
    });
    createdUid = account.uid;
    const result = await database().prepare(
      "INSERT INTO users (email,name,role,room_scope,created_at) VALUES (?,?,?,?,?)",
    ).bind(email, name, role, roomScope, new Date().toISOString()).run();
    await audit(actor.email, "Tambah", Number(result.meta.last_row_id ?? 0), `Membuat akun ${email} sebagai ${role}`);
    return Response.json({ ok:true, id:result.meta.last_row_id, message:"Akun login berhasil dibuat." }, { status:201 });
  } catch (error) {
    if (createdUid) await firebaseAdmin().auth.deleteUser(createdUid).catch(() => undefined);
    const message = error instanceof Error ? error.message : "Akun gagal dibuat.";
    const status = message.includes("Hanya Admin") ? 403
      : message.includes("sudah") || message.includes("wajib") || message.includes("valid") || message.includes("minimal") || message.includes("harus") ? 400
      : 500;
    return Response.json({ error:message }, { status });
  }
}

export async function PATCH(request: Request) {
  try {
    const actor = await requireAdmin(request);
    const body = await request.json() as {
      id?:number;
      action?:"update"|"toggle"|"reset-password";
      name?:string;
      role?:Role;
      roomScope?:string;
      password?:string;
    };
    const id = Number(body.id ?? 0);
    const target = await targetById(id);
    if (!target) throw new Error("Pengguna tidak ditemukan.");
    const account = await firebaseAdmin().auth.getUserByEmail(target.email);
    if (body.action === "toggle") {
      if (target.email.toLowerCase() === ownerEmail) throw new Error("Akun pemilik utama tidak dapat diblokir.");
      const disabled = !account.disabled;
      await firebaseAdmin().auth.updateUser(account.uid, { disabled });
      if (disabled) {
        await firebaseAdmin().auth.revokeRefreshTokens(account.uid);
        await revokeFirebaseSessions(account.uid);
      }
      await audit(actor.email, "Ubah", id, `${disabled ? "Memblokir" : "Mengaktifkan"} akun ${target.email}`);
      return Response.json({ ok:true, message:`Akun berhasil ${disabled ? "diblokir" : "diaktifkan"}.` });
    }
    if (body.action === "reset-password") {
      const password = validatePassword(body.password, true);
      await firebaseAdmin().auth.updateUser(account.uid, { password });
      await firebaseAdmin().auth.revokeRefreshTokens(account.uid);
      await revokeFirebaseSessions(account.uid);
      await audit(actor.email, "Ubah", id, `Mengatur ulang kata sandi akun ${target.email}`);
      return Response.json({ ok:true, message:"Kata sandi sementara berhasil disimpan. Pengguna harus login kembali." });
    }
    const name = String(body.name ?? "").trim();
    const role = body.role as Role;
    const roomScope = String(body.roomScope ?? "").trim();
    if (!name) throw new Error("Nama pengguna wajib diisi.");
    if (!managedRoles.has(role)) throw new Error("Peran pengguna internal tidak valid.");
    if (target.email.toLowerCase() === ownerEmail && role !== "Admin") {
      throw new Error("Peran pemilik utama harus tetap Admin.");
    }
    if ((role === "Musyrif" || role === "Kepala Asrama") && !roomScope) {
      throw new Error("Kamar/asrama penugasan wajib dipilih untuk peran ini.");
    }
    await firebaseAdmin().auth.updateUser(account.uid, { displayName:name });
    await database().prepare("UPDATE users SET name=?,role=?,room_scope=? WHERE id=?")
      .bind(name, role, roomScope, id).run();
    if (target.role !== role || target.roomScope !== roomScope) {
      await firebaseAdmin().auth.revokeRefreshTokens(account.uid);
      await revokeFirebaseSessions(account.uid);
    }
    await audit(actor.email, "Ubah", id, `Memperbarui ${target.email} sebagai ${role}`);
    return Response.json({ ok:true, message:"Hak akses pengguna berhasil diperbarui." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Akun gagal diperbarui.";
    return Response.json({ error:message }, { status:message.includes("Hanya Admin") ? 403 : 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const actor = await requireAdmin(request);
    const body = await request.json() as { id?:number };
    const id = Number(body.id ?? 0);
    const target = await targetById(id);
    if (!target) throw new Error("Pengguna tidak ditemukan.");
    if (target.email.toLowerCase() === ownerEmail) throw new Error("Akun pemilik utama tidak dapat dihapus.");
    if (target.email.toLowerCase() === actor.email.toLowerCase()) throw new Error("Anda tidak dapat menghapus akun yang sedang dipakai.");
    try {
      const account = await firebaseAdmin().auth.getUserByEmail(target.email);
      await revokeFirebaseSessions(account.uid);
      await firebaseAdmin().auth.deleteUser(account.uid);
    } catch (error) {
      const code = String((error as {code?:string})?.code ?? "");
      if (code !== "auth/user-not-found" && !(error instanceof Error && error.message.toLowerCase().includes("no user record"))) throw error;
    }
    await database().prepare("DELETE FROM users WHERE id=?").bind(id).run();
    await audit(actor.email, "Hapus", id, `Menghapus akses akun ${target.email}`);
    return Response.json({ ok:true, message:"Akun dan akses login berhasil dihapus." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Akun gagal dihapus.";
    return Response.json({ error:message }, { status:message.includes("Hanya Admin") ? 403 : 400 });
  }
}

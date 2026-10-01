import { database, defaultPermissions, ensureUser, normalizeGuardianPhone, TOOL_PERMISSIONS, INTERNAL_ROLES, type Role, type ToolPermission } from "../_lib";
import { isOwnerEmail } from "../../../lib/security-config";

export const runtime = "nodejs";

const managedRoles = new Set<Role>(INTERNAL_ROLES);

async function firebaseServices() {
  if (process.env.FIREBASE_RUNTIME !== "true") {
    throw new Error("Pengelolaan akun sekolah tersedia pada Firebase App Hosting.");
  }
  const [{ firebaseAdmin }, { revokeFirebaseSessions }] = await Promise.all([
    import("../../../lib/firebase/admin"),
    import("../../../lib/firebase/session"),
  ]);
  return { firebaseAdmin, revokeFirebaseSessions };
}

function internalEmailFromPhone(phone: string) {
  return `${phone}@internal.sinurman.local`;
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
    "SELECT id,email,phone,name,role,room_scope AS roomScope,permission_json AS permissionJson,role_review_required AS roleReviewRequired,employee_id AS employeeId,created_at AS createdAt FROM users WHERE id=?",
  ).bind(id).first<{
    id:number;
    email:string;
    phone:string;
    name:string;
    role:Role;
    roomScope:string;
    permissionJson?:string;
    employeeId?:number;
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
    const { firebaseAdmin } = await firebaseServices();
    const rows = await database().prepare(
      "SELECT id,email,phone,name,role,room_scope AS roomScope,permission_json AS permissionJson,role_review_required AS roleReviewRequired,employee_id AS employeeId,created_at AS createdAt FROM users ORDER BY id",
    ).all<{id:number;email:string;phone:string;name:string;role:Role;roomScope:string;permissionJson?:string;employeeId?:number;createdAt:string}>();
    const users = await Promise.all(rows.results.map(async row => {
      try {
        const account = await firebaseAdmin().auth.getUserByEmail(row.email);
        let permissionIds: ToolPermission[] = row.role === "Admin" ? [...TOOL_PERMISSIONS] : [];
        if (row.role !== "Admin") {
          try { const parsed=JSON.parse(String(row.permissionJson||"")); if(Array.isArray(parsed)) permissionIds=parsed.filter((item):item is ToolPermission=>TOOL_PERMISSIONS.includes(item)); } catch {/* deny malformed non-admin permissions */}
        }
        return {
          ...row,
          permissionIds,
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
  let firebaseAdmin: Awaited<ReturnType<typeof firebaseServices>>["firebaseAdmin"] | null = null;
  try {
    const actor = await requireAdmin(request);
    ({ firebaseAdmin } = await firebaseServices());
    const body = await request.json() as {
      name?:string;
      phone?:string;
      role?:Role;
      roomScope?:string;
      password?:string;
      permissions?:string[];
    };
    const phone = normalizeGuardianPhone(body.phone);
    const email = internalEmailFromPhone(phone);
    const name = String(body.name ?? "").trim();
    const role = body.role as Role;
    const roomScope = String(body.roomScope ?? "").trim();
    const permissions=Array.isArray(body.permissions)?body.permissions.filter(item=>TOOL_PERMISSIONS.includes(item as ToolPermission)) as ToolPermission[]:defaultPermissions(role);
    const password = validatePassword(body.password, true);
    if (!/^62\d{8,13}$/.test(phone)) throw new Error("Nomor HP harus memakai format Indonesia, contoh 628123456789.");
    if (!name) throw new Error("Nama pengguna wajib diisi.");
    if (!managedRoles.has(role)) throw new Error("Peran pengguna internal tidak valid.");
    const duplicate = await database().prepare("SELECT id FROM users WHERE phone=? OR lower(email)=?").bind(phone,email).first();
    if (duplicate) throw new Error("Nomor HP tersebut sudah terdaftar di SINURMAN.");
    try {
      await firebaseAdmin().auth.getUserByEmail(email);
      throw new Error("Nomor HP tersebut sudah memiliki akun internal.");
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
      "INSERT INTO users (email,phone,name,role,room_scope,permission_json,created_at) VALUES (?,?,?,?,?,?,?)",
    ).bind(email, phone, name, role, roomScope, JSON.stringify(permissions), new Date().toISOString()).run();
    await audit(actor.email, "Tambah", Number(result.meta.last_row_id ?? 0), `Membuat akun ${phone} sebagai ${role}`);
    return Response.json({ ok:true, id:result.meta.last_row_id, message:"Akun login berhasil dibuat." }, { status:201 });
  } catch (error) {
    if (createdUid && firebaseAdmin) await firebaseAdmin().auth.deleteUser(createdUid).catch(() => undefined);
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
    const { firebaseAdmin, revokeFirebaseSessions } = await firebaseServices();
    const body = await request.json() as {
      id?:number;
      action?:"update"|"toggle"|"reset-password";
      name?:string;
      phone?:string;
      role?:Role;
      roomScope?:string;
      password?:string;
      permissions?:string[];
    };
    const id = Number(body.id ?? 0);
    const target = await targetById(id);
    if (!target) throw new Error("Pengguna tidak ditemukan.");
    const account = await firebaseAdmin().auth.getUserByEmail(target.email);
    if (body.action === "toggle") {
      if (isOwnerEmail(target.email)) throw new Error("Akun pemilik utama tidak dapat diblokir.");
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
    const requestedPhone = normalizeGuardianPhone(body.phone);
    const role = body.role as Role;
    const roomScope = String(body.roomScope ?? "").trim();
    const permissions=Array.isArray(body.permissions)
      ? body.permissions.filter(item=>TOOL_PERMISSIONS.includes(item as ToolPermission)) as ToolPermission[]
      : role === "Admin" ? [...TOOL_PERMISSIONS] : (() => { try { const parsed=JSON.parse(String(target.permissionJson||"")); return Array.isArray(parsed) ? parsed.filter((item):item is ToolPermission=>TOOL_PERMISSIONS.includes(item)) : []; } catch { return []; } })();
    if (!name) throw new Error("Nama pengguna wajib diisi.");
    if (!managedRoles.has(role)) throw new Error("Peran pengguna internal tidak valid.");
    if (isOwnerEmail(target.email) && role !== "Admin") {
      throw new Error("Peran pemilik utama harus tetap Admin.");
    }
    if (requestedPhone && !/^62\d{8,13}$/.test(requestedPhone)) {
      throw new Error("Nomor HP harus memakai format Indonesia, contoh 628123456789.");
    }
    if (requestedPhone && isOwnerEmail(target.email)) {
      throw new Error("Akun pemilik utama tetap menggunakan email utama.");
    }
    let nextEmail = target.email;
    let migratedLogin = false;
    if (requestedPhone && requestedPhone !== target.phone) {
      nextEmail = internalEmailFromPhone(requestedPhone);
      const duplicate = await database().prepare("SELECT id FROM users WHERE phone=? AND id<>?").bind(requestedPhone,id).first();
      if (duplicate) throw new Error("Nomor HP tersebut sudah dipakai akun lain.");
      try {
        await firebaseAdmin().auth.getUserByEmail(nextEmail);
        throw new Error("Nomor HP tersebut sudah dipakai akun Firebase.");
      } catch (error) {
        const code = String((error as {code?:string})?.code ?? "");
        if (code !== "auth/user-not-found" && !(error instanceof Error && error.message.toLowerCase().includes("no user record"))) throw error;
      }
      await firebaseAdmin().auth.updateUser(account.uid, { displayName:name, email:nextEmail, emailVerified:true });
      migratedLogin = true;
    } else {
      await firebaseAdmin().auth.updateUser(account.uid, { displayName:name });
    }
    const oldPermissions=target.permissionJson||JSON.stringify(defaultPermissions(target.role));
    await database().prepare("UPDATE users SET email=?,phone=?,name=?,role=?,room_scope=?,permission_json=?,role_review_required=0 WHERE id=?")
      .bind(nextEmail, requestedPhone || target.phone || "", name, role, roomScope, JSON.stringify(permissions), id).run();
    if (migratedLogin || target.role !== role || target.roomScope !== roomScope) {
      await firebaseAdmin().auth.revokeRefreshTokens(account.uid);
      await revokeFirebaseSessions(account.uid);
    }
    const roleChanged = target.role !== role;
    await audit(actor.email, roleChanged ? "USER_ROLE_UPDATED" : "USER_PERMISSION_UPDATED", id, roleChanged
      ? `Mengubah ${requestedPhone || target.email} dari ${target.role} menjadi ${role}; permission baru=${JSON.stringify(permissions)}`
      : `Memperbarui ${requestedPhone || target.email} sebagai ${role}; permission lama=${oldPermissions}; permission baru=${JSON.stringify(permissions)}`);
    return Response.json({ ok:true, message:"Hak akses pengguna berhasil diperbarui." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Akun gagal diperbarui.";
    return Response.json({ error:message }, { status:message.includes("Hanya Admin") ? 403 : 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const actor = await requireAdmin(request);
    const { firebaseAdmin, revokeFirebaseSessions } = await firebaseServices();
    const body = await request.json() as { id?:number };
    const id = Number(body.id ?? 0);
    const target = await targetById(id);
    if (!target) throw new Error("Pengguna tidak ditemukan.");
    if (isOwnerEmail(target.email)) throw new Error("Akun pemilik utama tidak dapat dihapus.");
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

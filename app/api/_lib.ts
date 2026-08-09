import { env } from "cloudflare:workers";
import { isOwnerEmail } from "../../lib/security-config";

export type Role = "Admin" | "Kepala Asrama" | "Musyrif" | "Ustadz" | "Wali Santri";
export type AuthenticatedUser = {
  id: number;
  email: string;
  name: string;
  role: Role;
  roomScope: string;
  guardianPhone?: string;
  authProvider?: "firebase" | "chatgpt" | "guardian";
};
// Firebase Hosting strips non-reserved cookies before proxying to Cloud Run.
const guardianCookieName = process.env.FIREBASE_RUNTIME === "true" ? "__session" : "sinurman_wali_session";

export function database() {
  if (!env.DB) throw new Error("Database SINURMAN belum tersedia.");
  return env.DB;
}

let schemaReady: Promise<void> | null = null;

export function ensureDatabaseSchema() {
  if (schemaReady) return schemaReady;
  const db = database();
  schemaReady = (async () => {
    const definitions = [
      "CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT,email TEXT NOT NULL UNIQUE,name TEXT NOT NULL,role TEXT NOT NULL,room_scope TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL)",
      "CREATE TABLE IF NOT EXISTS students (id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,nis TEXT NOT NULL UNIQUE,class_name TEXT NOT NULL,room TEXT NOT NULL,guardian_name TEXT NOT NULL,guardian_phone TEXT NOT NULL,guardian_email TEXT NOT NULL DEFAULT '',status TEXT NOT NULL DEFAULT 'Aktif',created_at TEXT NOT NULL)",
      "CREATE TABLE IF NOT EXISTS tahfidz_records (id INTEGER PRIMARY KEY AUTOINCREMENT,student_id INTEGER NOT NULL,surah TEXT NOT NULL,verses TEXT NOT NULL,surah_from TEXT NOT NULL DEFAULT '',surah_to TEXT NOT NULL DEFAULT '',verse_from INTEGER NOT NULL DEFAULT 0,verse_to INTEGER NOT NULL DEFAULT 0,amount INTEGER NOT NULL,grade TEXT NOT NULL,teacher TEXT NOT NULL,recorded_at TEXT NOT NULL,workflow_status TEXT NOT NULL DEFAULT 'Dipublikasikan',period_key TEXT NOT NULL DEFAULT '')",
      "CREATE TABLE IF NOT EXISTS tahsin_records (id INTEGER PRIMARY KEY AUTOINCREMENT,student_id INTEGER NOT NULL,level TEXT NOT NULL,makhraj_score INTEGER NOT NULL,tajwid_score INTEGER NOT NULL,fluency_score INTEGER NOT NULL,length_score INTEGER NOT NULL,adab_score INTEGER NOT NULL,note TEXT NOT NULL DEFAULT '',teacher TEXT NOT NULL,recorded_at TEXT NOT NULL,workflow_status TEXT NOT NULL DEFAULT 'Dipublikasikan',period_key TEXT NOT NULL DEFAULT '')",
      "CREATE TABLE IF NOT EXISTS mutabaah_records (id INTEGER PRIMARY KEY AUTOINCREMENT,student_id INTEGER NOT NULL,activity TEXT NOT NULL,completed INTEGER NOT NULL DEFAULT 0,record_date TEXT NOT NULL,recorded_by TEXT NOT NULL,workflow_status TEXT NOT NULL DEFAULT 'Dipublikasikan',period_key TEXT NOT NULL DEFAULT '')",
      "CREATE TABLE IF NOT EXISTS health_records (id INTEGER PRIMARY KEY AUTOINCREMENT,student_id INTEGER NOT NULL,complaint TEXT NOT NULL,diagnosis TEXT NOT NULL,treatment TEXT NOT NULL,status TEXT NOT NULL,recorded_at TEXT NOT NULL,workflow_status TEXT NOT NULL DEFAULT 'Dipublikasikan',period_key TEXT NOT NULL DEFAULT '')",
      "CREATE TABLE IF NOT EXISTS transactions (id INTEGER PRIMARY KEY AUTOINCREMENT,student_id INTEGER NOT NULL,type TEXT NOT NULL,category TEXT NOT NULL,amount INTEGER NOT NULL,status TEXT NOT NULL,note TEXT NOT NULL,recorded_at TEXT NOT NULL)",
      "CREATE TABLE IF NOT EXISTS character_reports (id INTEGER PRIMARY KEY AUTOINCREMENT,student_id INTEGER NOT NULL,category TEXT NOT NULL,score INTEGER NOT NULL,note TEXT NOT NULL,semester TEXT NOT NULL,recorded_at TEXT NOT NULL,workflow_status TEXT NOT NULL DEFAULT 'Dipublikasikan',period_key TEXT NOT NULL DEFAULT '')",
      "CREATE TABLE IF NOT EXISTS inventory_items (id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,location TEXT NOT NULL,quantity INTEGER NOT NULL,unit TEXT NOT NULL,condition TEXT NOT NULL,updated_at TEXT NOT NULL)",
      "CREATE TABLE IF NOT EXISTS announcements (id INTEGER PRIMARY KEY AUTOINCREMENT,title TEXT NOT NULL,category TEXT NOT NULL,content TEXT NOT NULL,audience TEXT NOT NULL,published_at TEXT NOT NULL,author TEXT NOT NULL)",
      "CREATE TABLE IF NOT EXISTS notification_logs (id INTEGER PRIMARY KEY AUTOINCREMENT,student_id INTEGER,channel TEXT NOT NULL,recipient TEXT NOT NULL,message TEXT NOT NULL,status TEXT NOT NULL,sent_at TEXT NOT NULL)",
      "CREATE TABLE IF NOT EXISTS attendance_records (id INTEGER PRIMARY KEY AUTOINCREMENT,student_id INTEGER NOT NULL,record_date TEXT NOT NULL,status TEXT NOT NULL,note TEXT NOT NULL,recorded_by TEXT NOT NULL,workflow_status TEXT NOT NULL DEFAULT 'Dipublikasikan',period_key TEXT NOT NULL DEFAULT '')",
      "CREATE TABLE IF NOT EXISTS academic_subjects (id INTEGER PRIMARY KEY AUTOINCREMENT,code TEXT NOT NULL UNIQUE,name TEXT NOT NULL,education_level TEXT NOT NULL,class_name TEXT NOT NULL,teacher TEXT NOT NULL,semester TEXT NOT NULL,academic_year TEXT NOT NULL,minimum_score INTEGER NOT NULL DEFAULT 75,created_at TEXT NOT NULL)",
      "CREATE TABLE IF NOT EXISTS academic_grades (id INTEGER PRIMARY KEY AUTOINCREMENT,student_id INTEGER NOT NULL,subject_id INTEGER NOT NULL,assignment_score INTEGER NOT NULL,midterm_score INTEGER NOT NULL,exam_score INTEGER NOT NULL,final_score INTEGER NOT NULL,predicate TEXT NOT NULL,note TEXT NOT NULL,semester TEXT NOT NULL,academic_year TEXT NOT NULL,recorded_by TEXT NOT NULL,recorded_at TEXT NOT NULL,workflow_status TEXT NOT NULL DEFAULT 'Dipublikasikan',period_key TEXT NOT NULL DEFAULT '')",
      "CREATE TABLE IF NOT EXISTS leave_permits (id INTEGER PRIMARY KEY AUTOINCREMENT,student_id INTEGER NOT NULL,start_date TEXT NOT NULL,end_date TEXT NOT NULL,reason TEXT NOT NULL,status TEXT NOT NULL,approved_by TEXT NOT NULL)",
      "CREATE TABLE IF NOT EXISTS schedules (id INTEGER PRIMARY KEY AUTOINCREMENT,education_level TEXT NOT NULL DEFAULT 'SMP',class_name TEXT NOT NULL DEFAULT 'VII A',title TEXT NOT NULL,category TEXT NOT NULL,teacher TEXT NOT NULL,location TEXT NOT NULL,day_name TEXT NOT NULL,start_time TEXT NOT NULL,end_time TEXT NOT NULL)",
      "CREATE TABLE IF NOT EXISTS rooms (id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL UNIQUE,capacity INTEGER NOT NULL,supervisor TEXT NOT NULL,status TEXT NOT NULL)",
      "CREATE TABLE IF NOT EXISTS admissions (id INTEGER PRIMARY KEY AUTOINCREMENT,registration_no TEXT NOT NULL UNIQUE,name TEXT NOT NULL,applicant_email TEXT NOT NULL DEFAULT '',nisn TEXT NOT NULL DEFAULT '',birth_place TEXT NOT NULL DEFAULT '',birth_date TEXT NOT NULL DEFAULT '',gender TEXT NOT NULL DEFAULT '',desired_level TEXT NOT NULL DEFAULT 'SMP',guardian_name TEXT NOT NULL,guardian_phone TEXT NOT NULL,previous_school TEXT NOT NULL,address TEXT NOT NULL DEFAULT '',status TEXT NOT NULL,score INTEGER NOT NULL DEFAULT 0,verification_note TEXT NOT NULL DEFAULT '',verified_by TEXT NOT NULL DEFAULT '',verified_at TEXT NOT NULL DEFAULT '',tracking_token TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL)",
      "CREATE TABLE IF NOT EXISTS admission_documents (id INTEGER PRIMARY KEY AUTOINCREMENT,admission_id INTEGER NOT NULL,doc_type TEXT NOT NULL,file_name TEXT NOT NULL,object_key TEXT NOT NULL UNIQUE,content_type TEXT NOT NULL,size_bytes INTEGER NOT NULL,status TEXT NOT NULL DEFAULT 'Menunggu',verification_note TEXT NOT NULL DEFAULT '',verified_by TEXT NOT NULL DEFAULT '',verified_at TEXT NOT NULL DEFAULT '',uploaded_at TEXT NOT NULL)",
      "CREATE TABLE IF NOT EXISTS counseling_records (id INTEGER PRIMARY KEY AUTOINCREMENT,student_id INTEGER NOT NULL,type TEXT NOT NULL,category TEXT NOT NULL,description TEXT NOT NULL,points INTEGER NOT NULL DEFAULT 0,status TEXT NOT NULL,counselor TEXT NOT NULL,recorded_at TEXT NOT NULL)",
      "CREATE TABLE IF NOT EXISTS bills (id INTEGER PRIMARY KEY AUTOINCREMENT,student_id INTEGER NOT NULL,invoice_no TEXT NOT NULL UNIQUE,category TEXT NOT NULL,amount INTEGER NOT NULL,due_date TEXT NOT NULL,status TEXT NOT NULL,payment_url TEXT NOT NULL,payment_method TEXT NOT NULL DEFAULT '',payment_reference TEXT NOT NULL DEFAULT '',paid_at TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL)",
      "CREATE TABLE IF NOT EXISTS guardian_messages (id INTEGER PRIMARY KEY AUTOINCREMENT,student_id INTEGER NOT NULL,sender_email TEXT NOT NULL,subject TEXT NOT NULL,message TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'Baru',reply TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL,replied_at TEXT NOT NULL DEFAULT '')",
      "CREATE TABLE IF NOT EXISTS guardian_requests (id INTEGER PRIMARY KEY AUTOINCREMENT,student_id INTEGER NOT NULL,requester_email TEXT NOT NULL,type TEXT NOT NULL,visit_date TEXT NOT NULL,start_time TEXT NOT NULL,end_time TEXT NOT NULL,purpose TEXT NOT NULL,visitor_name TEXT NOT NULL,visitor_phone TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'Diajukan',qr_token TEXT NOT NULL UNIQUE,used_at TEXT NOT NULL DEFAULT '',approved_by TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL)",
      "CREATE TABLE IF NOT EXISTS wallet_accounts (id INTEGER PRIMARY KEY AUTOINCREMENT,student_id INTEGER NOT NULL UNIQUE,card_token TEXT NOT NULL UNIQUE,balance INTEGER NOT NULL DEFAULT 0,daily_limit INTEGER NOT NULL DEFAULT 50000,status TEXT NOT NULL DEFAULT 'Aktif',updated_at TEXT NOT NULL)",
      "CREATE TABLE IF NOT EXISTS wallet_entries (id INTEGER PRIMARY KEY AUTOINCREMENT,student_id INTEGER NOT NULL,entry_type TEXT NOT NULL,amount INTEGER NOT NULL,balance_after INTEGER NOT NULL,reference TEXT NOT NULL,note TEXT NOT NULL,actor_email TEXT NOT NULL,created_at TEXT NOT NULL)",
      "CREATE TABLE IF NOT EXISTS wallet_topups (id INTEGER PRIMARY KEY AUTOINCREMENT,topup_no TEXT NOT NULL UNIQUE,student_id INTEGER NOT NULL,amount INTEGER NOT NULL,method TEXT NOT NULL,provider TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'Menunggu Pembayaran',payment_url TEXT NOT NULL DEFAULT '',payment_reference TEXT NOT NULL DEFAULT '',created_by TEXT NOT NULL,created_at TEXT NOT NULL,expires_at TEXT NOT NULL,paid_at TEXT NOT NULL DEFAULT '')",
      "CREATE TABLE IF NOT EXISTS wallet_topup_settlements (id INTEGER PRIMARY KEY AUTOINCREMENT,topup_id INTEGER NOT NULL UNIQUE,reference TEXT NOT NULL,created_at TEXT NOT NULL)",
      "CREATE TABLE IF NOT EXISTS canteen_products (id INTEGER PRIMARY KEY AUTOINCREMENT,sku TEXT NOT NULL UNIQUE,name TEXT NOT NULL,category TEXT NOT NULL,price INTEGER NOT NULL,stock INTEGER NOT NULL,status TEXT NOT NULL DEFAULT 'Aktif',updated_at TEXT NOT NULL)",
      "CREATE TABLE IF NOT EXISTS canteen_sales (id INTEGER PRIMARY KEY AUTOINCREMENT,receipt_no TEXT NOT NULL UNIQUE,student_id INTEGER NOT NULL,total INTEGER NOT NULL,status TEXT NOT NULL DEFAULT 'Berhasil',cashier_email TEXT NOT NULL,created_at TEXT NOT NULL,reversed_at TEXT NOT NULL DEFAULT '')",
      "CREATE TABLE IF NOT EXISTS canteen_sale_items (id INTEGER PRIMARY KEY AUTOINCREMENT,sale_id INTEGER NOT NULL,product_id INTEGER NOT NULL,product_name TEXT NOT NULL,quantity INTEGER NOT NULL,unit_price INTEGER NOT NULL,subtotal INTEGER NOT NULL)",
      "CREATE TABLE IF NOT EXISTS audit_logs (id INTEGER PRIMARY KEY AUTOINCREMENT,user_email TEXT NOT NULL,action TEXT NOT NULL,resource TEXT NOT NULL,record_id INTEGER,detail TEXT NOT NULL,created_at TEXT NOT NULL)",
      "CREATE TABLE IF NOT EXISTS academic_periods (id INTEGER PRIMARY KEY AUTOINCREMENT,period_key TEXT NOT NULL UNIQUE,academic_year TEXT NOT NULL,semester TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'Terbuka',locked_by TEXT NOT NULL DEFAULT '',locked_at TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL,updated_at TEXT NOT NULL)",
      "CREATE TABLE IF NOT EXISTS employees (id INTEGER PRIMARY KEY AUTOINCREMENT,employee_no TEXT NOT NULL UNIQUE,name TEXT NOT NULL,gender TEXT NOT NULL,birth_place TEXT NOT NULL DEFAULT '',birth_date TEXT NOT NULL DEFAULT '',phone TEXT NOT NULL DEFAULT '',email TEXT NOT NULL DEFAULT '',position TEXT NOT NULL,work_unit TEXT NOT NULL,employment_type TEXT NOT NULL,education TEXT NOT NULL DEFAULT '',join_date TEXT NOT NULL,address TEXT NOT NULL DEFAULT '',status TEXT NOT NULL DEFAULT 'Aktif',created_at TEXT NOT NULL,updated_at TEXT NOT NULL)",
      "CREATE TABLE IF NOT EXISTS school_classes (id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL UNIQUE,education_level TEXT NOT NULL,grade_order INTEGER NOT NULL,major TEXT NOT NULL DEFAULT '',homeroom_teacher TEXT NOT NULL DEFAULT '',capacity INTEGER NOT NULL DEFAULT 32,next_class_name TEXT NOT NULL DEFAULT '',academic_year TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'Aktif',created_at TEXT NOT NULL,updated_at TEXT NOT NULL)",
      "CREATE TABLE IF NOT EXISTS student_promotions (id INTEGER PRIMARY KEY AUTOINCREMENT,student_id INTEGER NOT NULL,student_name TEXT NOT NULL,nis TEXT NOT NULL,from_class TEXT NOT NULL,to_class TEXT NOT NULL,action TEXT NOT NULL,academic_year_from TEXT NOT NULL,academic_year_to TEXT NOT NULL,processed_by TEXT NOT NULL,processed_at TEXT NOT NULL)",
      "CREATE UNIQUE INDEX IF NOT EXISTS student_promotions_year_idx ON student_promotions(student_id,academic_year_from)",
      "CREATE INDEX IF NOT EXISTS student_promotions_student_idx ON student_promotions(student_id)",
      "CREATE TABLE IF NOT EXISTS guardian_accounts (id INTEGER PRIMARY KEY AUTOINCREMENT,phone TEXT NOT NULL UNIQUE,pin_hash TEXT NOT NULL,pin_salt TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'Aktif',failed_attempts INTEGER NOT NULL DEFAULT 0,locked_until TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL,updated_at TEXT NOT NULL)",
      "CREATE TABLE IF NOT EXISTS guardian_sessions (id INTEGER PRIMARY KEY AUTOINCREMENT,account_id INTEGER NOT NULL,token_hash TEXT NOT NULL UNIQUE,expires_at TEXT NOT NULL,created_at TEXT NOT NULL,last_seen_at TEXT NOT NULL)",
      "CREATE TABLE IF NOT EXISTS guardian_pin_resets (id INTEGER PRIMARY KEY AUTOINCREMENT,phone TEXT NOT NULL UNIQUE,code_hash TEXT NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,expires_at TEXT NOT NULL,created_at TEXT NOT NULL)",
      "CREATE INDEX IF NOT EXISTS guardian_sessions_account_idx ON guardian_sessions(account_id)",
      "CREATE INDEX IF NOT EXISTS guardian_sessions_expiry_idx ON guardian_sessions(expires_at)",
      "CREATE INDEX IF NOT EXISTS students_guardian_phone_idx ON students(guardian_phone)",
      "CREATE INDEX IF NOT EXISTS students_class_room_idx ON students(class_name,room)",
      "CREATE INDEX IF NOT EXISTS tahfidz_student_period_idx ON tahfidz_records(student_id,period_key,workflow_status)",
      "CREATE INDEX IF NOT EXISTS tahsin_student_period_idx ON tahsin_records(student_id,period_key,workflow_status)",
      "CREATE INDEX IF NOT EXISTS mutabaah_student_period_idx ON mutabaah_records(student_id,period_key,workflow_status)",
      "CREATE INDEX IF NOT EXISTS health_student_period_idx ON health_records(student_id,period_key,workflow_status)",
      "CREATE INDEX IF NOT EXISTS character_student_period_idx ON character_reports(student_id,period_key,workflow_status)",
      "CREATE INDEX IF NOT EXISTS attendance_student_period_idx ON attendance_records(student_id,period_key,workflow_status)",
      "CREATE INDEX IF NOT EXISTS grades_student_period_idx ON academic_grades(student_id,period_key,workflow_status)",
      "CREATE INDEX IF NOT EXISTS audit_logs_created_idx ON audit_logs(created_at)",
    ];
    await db.batch(definitions.map((sql) => db.prepare(sql)));

    const upgrades: Record<string, Record<string, string>> = {
      users: { room_scope: "TEXT NOT NULL DEFAULT ''" },
      students: { guardian_email: "TEXT NOT NULL DEFAULT ''" },
      tahfidz_records: {
        surah_from: "TEXT NOT NULL DEFAULT ''",
        surah_to: "TEXT NOT NULL DEFAULT ''",
        verse_from: "INTEGER NOT NULL DEFAULT 0",
        verse_to: "INTEGER NOT NULL DEFAULT 0",
        workflow_status: "TEXT NOT NULL DEFAULT 'Dipublikasikan'",
        period_key: "TEXT NOT NULL DEFAULT ''",
      },
      mutabaah_records: { workflow_status: "TEXT NOT NULL DEFAULT 'Dipublikasikan'", period_key: "TEXT NOT NULL DEFAULT ''" },
      health_records: { workflow_status: "TEXT NOT NULL DEFAULT 'Dipublikasikan'", period_key: "TEXT NOT NULL DEFAULT ''" },
      character_reports: { workflow_status: "TEXT NOT NULL DEFAULT 'Dipublikasikan'", period_key: "TEXT NOT NULL DEFAULT ''" },
      attendance_records: { workflow_status: "TEXT NOT NULL DEFAULT 'Dipublikasikan'", period_key: "TEXT NOT NULL DEFAULT ''" },
      academic_grades: { workflow_status: "TEXT NOT NULL DEFAULT 'Dipublikasikan'", period_key: "TEXT NOT NULL DEFAULT ''" },
      schedules: { education_level: "TEXT NOT NULL DEFAULT 'SMP'", class_name: "TEXT NOT NULL DEFAULT 'VII A'" },
      bills: {
        payment_method: "TEXT NOT NULL DEFAULT ''",
        payment_reference: "TEXT NOT NULL DEFAULT ''",
        paid_at: "TEXT NOT NULL DEFAULT ''",
      },
      admissions: {
        applicant_email: "TEXT NOT NULL DEFAULT ''",
        nisn: "TEXT NOT NULL DEFAULT ''",
        birth_place: "TEXT NOT NULL DEFAULT ''",
        birth_date: "TEXT NOT NULL DEFAULT ''",
        gender: "TEXT NOT NULL DEFAULT ''",
        desired_level: "TEXT NOT NULL DEFAULT 'SMP'",
        address: "TEXT NOT NULL DEFAULT ''",
        verification_note: "TEXT NOT NULL DEFAULT ''",
        verified_by: "TEXT NOT NULL DEFAULT ''",
        verified_at: "TEXT NOT NULL DEFAULT ''",
        tracking_token: "TEXT NOT NULL DEFAULT ''",
      },
    };
    for (const [table, columns] of Object.entries(upgrades)) {
      const info = await db.prepare(`PRAGMA table_info(${table})`).all<{ name: string }>();
      const existing = new Set(info.results.map((column) => column.name));
      const missing = Object.entries(columns).filter(([name]) => !existing.has(name));
      if (missing.length) {
        await db.batch(missing.map(([name, definition]) => db.prepare(`ALTER TABLE ${table} ADD ${name} ${definition}`)));
      }
    }
    await db.prepare("UPDATE tahfidz_records SET surah_from=surah WHERE surah_from=''").run();
    await db.prepare("UPDATE tahfidz_records SET surah_to=surah WHERE surah_to=''").run();
    await db.prepare("UPDATE tahfidz_records SET verse_from=CASE WHEN instr(replace(verses,'–','-'),'-')>0 THEN CAST(substr(replace(verses,'–','-'),1,instr(replace(verses,'–','-'),'-')-1) AS INTEGER) ELSE CAST(verses AS INTEGER) END WHERE verse_from=0").run();
    await db.prepare("UPDATE tahfidz_records SET verse_to=CASE WHEN instr(replace(verses,'–','-'),'-')>0 THEN CAST(substr(replace(verses,'–','-'),instr(replace(verses,'–','-'),'-')+1) AS INTEGER) ELSE CAST(verses AS INTEGER) END WHERE verse_to=0").run();
    await db.prepare("UPDATE students SET guardian_phone=CASE WHEN substr(replace(replace(replace(replace(replace(guardian_phone,'+',''),' ',''),'-',''),'(',''),')',''),1,1)='0' THEN '62'||substr(replace(replace(replace(replace(replace(guardian_phone,'+',''),' ',''),'-',''),'(',''),')',''),2) WHEN substr(replace(replace(replace(replace(replace(guardian_phone,'+',''),' ',''),'-',''),'(',''),')',''),1,1)='8' THEN '62'||replace(replace(replace(replace(replace(guardian_phone,'+',''),' ',''),'-',''),'(',''),')','') ELSE replace(replace(replace(replace(replace(guardian_phone,'+',''),' ',''),'-',''),'(',''),')','') END WHERE guardian_phone<>''").run();
  })().catch((error) => {
    schemaReady = null;
    throw error;
  });
  return schemaReady;
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(value: string) {
  const pairs = value.match(/.{1,2}/g) ?? [];
  return new Uint8Array(pairs.map((pair) => Number.parseInt(pair, 16)));
}

async function sha256(value: string) {
  return bytesToHex(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))));
}

async function deriveGuardianPin(pin: string, salt: string) {
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", iterations: 100_000, salt: hexToBytes(salt) },
    material,
    256,
  );
  return bytesToHex(new Uint8Array(bits));
}

function randomHex(size: number) {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

function cookieValue(request: Request, name: string) {
  const cookie = request.headers.get("cookie") ?? "";
  for (const part of cookie.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return "";
}

export function normalizeGuardianPhone(value: unknown) {
  let digits = String(value ?? "").replace(/\D/g, "");
  if (digits.startsWith("0")) digits = `62${digits.slice(1)}`;
  else if (digits.startsWith("8")) digits = `62${digits}`;
  return digits;
}

export async function getGuardianSession(request: Request) {
  await ensureDatabaseSchema();
  const token = cookieValue(request, guardianCookieName);
  if (!token || token.length < 40) return null;
  const tokenHash = await sha256(token);
  const now = new Date().toISOString();
  return database().prepare(
    `SELECT a.id,a.phone,a.status,s.id AS sessionId,s.expires_at AS expiresAt
     FROM guardian_sessions s JOIN guardian_accounts a ON a.id=s.account_id
     WHERE s.token_hash=? AND s.expires_at>? AND a.status='Aktif'`,
  ).bind(tokenHash, now).first<{ id:number; phone:string; status:string; sessionId:number; expiresAt:string }>();
}

export async function createGuardianSession(accountId: number) {
  const token = randomHex(32);
  const tokenHash = await sha256(token);
  const now = new Date();
  const expires = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  await database().batch([
    database().prepare("DELETE FROM guardian_sessions WHERE expires_at<=?").bind(now.toISOString()),
    database().prepare("INSERT INTO guardian_sessions (account_id,token_hash,expires_at,created_at,last_seen_at) VALUES (?,?,?,?,?)")
      .bind(accountId, tokenHash, expires.toISOString(), now.toISOString(), now.toISOString()),
  ]);
  return {
    token,
    cookie: `${guardianCookieName}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}`,
  };
}

export async function removeGuardianSession(request: Request) {
  const token = cookieValue(request, guardianCookieName);
  if (token) await database().prepare("DELETE FROM guardian_sessions WHERE token_hash=?").bind(await sha256(token)).run();
  return `${guardianCookieName}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export async function setGuardianPin(phoneInput: unknown, pin: string) {
  await ensureDatabaseSchema();
  const phone = normalizeGuardianPhone(phoneInput);
  if (!/^62\d{8,13}$/.test(phone)) throw new Error("Nomor HP wali tidak valid.");
  if (!/^\d{6}$/.test(pin)) throw new Error("PIN harus terdiri dari 6 angka.");
  const linked = await database().prepare("SELECT COUNT(*) AS total FROM students WHERE guardian_phone=?").bind(phone).first<{total:number}>();
  if (!Number(linked?.total ?? 0)) throw new Error("Nomor HP belum terhubung dengan Data Santri.");
  const salt = randomHex(16);
  const hash = await deriveGuardianPin(pin, salt);
  const now = new Date().toISOString();
  await database().prepare(
    `INSERT INTO guardian_accounts (phone,pin_hash,pin_salt,status,failed_attempts,locked_until,created_at,updated_at)
     VALUES (?,?,?,'Aktif',0,'',?,?)
     ON CONFLICT(phone) DO UPDATE SET pin_hash=excluded.pin_hash,pin_salt=excluded.pin_salt,status='Aktif',failed_attempts=0,locked_until='',updated_at=excluded.updated_at`,
  ).bind(phone, hash, salt, now, now).run();
  const account = await database().prepare("SELECT id FROM guardian_accounts WHERE phone=?").bind(phone).first<{id:number}>();
  if (account) await database().prepare("DELETE FROM guardian_sessions WHERE account_id=?").bind(account.id).run();
  return phone;
}

export async function registerGuardianAccount(phoneInput: unknown, pin: string) {
  await ensureDatabaseSchema();
  const phone = normalizeGuardianPhone(phoneInput);
  if (!/^62\d{8,13}$/.test(phone)) throw new Error("Nomor HP wali tidak valid.");
  if (!/^\d{6}$/.test(pin)) throw new Error("PIN harus terdiri dari 6 angka.");
  const linked = await database().prepare(
    "SELECT COUNT(*) AS total FROM students WHERE guardian_phone=? AND status='Aktif'",
  ).bind(phone).first<{ total:number }>();
  if (!Number(linked?.total ?? 0)) {
    throw new Error("Nomor HP belum terhubung dengan Data Santri. Hubungi Admin pesantren.");
  }
  const existing = await database().prepare(
    "SELECT id,status FROM guardian_accounts WHERE phone=?",
  ).bind(phone).first<{ id:number; status:string }>();
  if (existing?.status === "Aktif") {
    throw new Error("Akun sudah aktif. Silakan masuk atau hubungi Admin untuk mereset PIN.");
  }
  if (existing?.status === "Diblokir") {
    throw new Error("Akun diblokir. Hubungi Admin pesantren.");
  }

  const salt = randomHex(16);
  const hash = await deriveGuardianPin(pin, salt);
  const now = new Date().toISOString();
  if (existing) {
    await database().prepare(
      "UPDATE guardian_accounts SET pin_hash=?,pin_salt=?,status='Menunggu Persetujuan',failed_attempts=0,locked_until='',updated_at=? WHERE id=?",
    ).bind(hash, salt, now, existing.id).run();
    await database().prepare("DELETE FROM guardian_sessions WHERE account_id=?").bind(existing.id).run();
  } else {
    await database().prepare(
      `INSERT INTO guardian_accounts
       (phone,pin_hash,pin_salt,status,failed_attempts,locked_until,created_at,updated_at)
       VALUES (?,?,?,'Menunggu Persetujuan',0,'',?,?)`,
    ).bind(phone, hash, salt, now, now).run();
  }
  return { phone, status: "Menunggu Persetujuan", created: !existing };
}

export async function verifyGuardianPin(phoneInput: unknown, pin: string) {
  await ensureDatabaseSchema();
  const phone = normalizeGuardianPhone(phoneInput);
  const account = await database().prepare("SELECT * FROM guardian_accounts WHERE phone=?").bind(phone).first<{
    id:number; phone:string; pin_hash:string; pin_salt:string; status:string; failed_attempts:number; locked_until:string;
  }>();
  if (!account || account.status !== "Aktif") return { ok:false as const, message:"Nomor HP atau PIN tidak sesuai." };
  const now = new Date();
  if (account.locked_until && account.locked_until > now.toISOString()) {
    return { ok:false as const, message:"Akun terkunci sementara. Coba kembali setelah 15 menit." };
  }
  const candidate = await deriveGuardianPin(pin, account.pin_salt);
  let difference = candidate.length ^ account.pin_hash.length;
  for (let index = 0; index < Math.min(candidate.length, account.pin_hash.length); index += 1) {
    difference |= candidate.charCodeAt(index) ^ account.pin_hash.charCodeAt(index);
  }
  if (difference !== 0) {
    const attempts = Number(account.failed_attempts ?? 0) + 1;
    const lockedUntil = attempts >= 5 ? new Date(now.getTime() + 15 * 60 * 1000).toISOString() : "";
    await database().prepare("UPDATE guardian_accounts SET failed_attempts=?,locked_until=?,updated_at=? WHERE id=?")
      .bind(attempts >= 5 ? 0 : attempts, lockedUntil, now.toISOString(), account.id).run();
    return { ok:false as const, message:lockedUntil ? "Terlalu banyak percobaan. Akun dikunci selama 15 menit." : "Nomor HP atau PIN tidak sesuai." };
  }
  await database().prepare("UPDATE guardian_accounts SET failed_attempts=0,locked_until='',updated_at=? WHERE id=?")
    .bind(now.toISOString(), account.id).run();
  return { ok:true as const, accountId:account.id, phone:account.phone };
}

export async function currentIdentity(request: Request) {
  if (process.env.FIREBASE_RUNTIME === "true") {
    const { getFirebaseSession } = await import("../../lib/firebase/session");
    const firebaseSession = await getFirebaseSession(request);
    if (firebaseSession) {
      return { email: firebaseSession.email, name: firebaseSession.name, authProvider: "firebase" as const };
    }
  } else {
    const email = request.headers.get("oai-authenticated-user-email");
    if (email) {
      const encodedName = request.headers.get("oai-authenticated-user-full-name");
      const encoding = request.headers.get("oai-authenticated-user-full-name-encoding");
      let name = email.split("@")[0];
      if (encodedName && encoding === "percent-encoded-utf-8") {
        try { name = decodeURIComponent(encodedName); } catch { /* use fallback */ }
      }
      return { email, name, authProvider: "chatgpt" as const };
    }
  }
  const guardian = await getGuardianSession(request);
  if (guardian) {
    const student = await database().prepare("SELECT guardian_name FROM students WHERE guardian_phone=? ORDER BY id LIMIT 1")
      .bind(guardian.phone).first<{guardian_name:string}>();
    return {
      email: `wali:${guardian.phone}`,
      name: student?.guardian_name || `Wali ${guardian.phone.slice(-4)}`,
      guardianPhone: guardian.phone,
      guardianAccountId: guardian.id,
      authProvider: "guardian" as const,
    };
  }
  throw new Error("Silakan masuk untuk membuka SINURMAN.");
}

export async function ensureUser(request: Request) {
  await ensureDatabaseSchema();
  const db = database();
  const identity = await currentIdentity(request);
  if (identity.guardianPhone) {
    return {
      id: -Number(identity.guardianAccountId),
      email: identity.email,
      name: identity.name,
      role: "Wali Santri" as const,
      roomScope: "",
      guardianPhone: identity.guardianPhone,
      authProvider: "guardian" as const,
    };
  }

  const enforceAdminMfa=async(user:AuthenticatedUser) => {
    if(process.env.FIREBASE_RUNTIME!=="true"||user.role!=="Admin"||["GET","HEAD","OPTIONS"].includes(request.method))return user;
    const pathname=new URL(request.url).pathname;
    if(pathname==="/api/account-security"||pathname==="/api/firebase-auth")return user;
    // The primary owner must be able to complete guardian onboarding before MFA
    // enrollment. Other administrative mutations remain protected by MFA.
    if(pathname==="/api/guardian-accounts"&&isOwnerEmail(user.email))return user;
    const {firebaseAdmin}=await import("../../lib/firebase/admin");
    const account=await firebaseAdmin().auth.getUserByEmail(user.email);
    if(!account.multiFactor?.enrolledFactors?.length) throw new Error("MFA_REQUIRED: Aktifkan Authenticator dari Profil Akun sebelum melakukan perubahan Admin.");
    return user;
  };
  const existing = await db
    .prepare("SELECT id, email, name, role, room_scope AS roomScope FROM users WHERE email = ?")
    .bind(identity.email)
    .first<{ id: number; email: string; name: string; role: Role; roomScope: string }>();

  if (existing) {
    if (isOwnerEmail(identity.email) && existing.role !== "Admin") {
      await db.prepare("UPDATE users SET role='Admin' WHERE id=?").bind(existing.id).run();
      return enforceAdminMfa({ ...existing, role: "Admin" as const, authProvider: identity.authProvider } as AuthenticatedUser);
    }
    return enforceAdminMfa({ ...existing, authProvider: identity.authProvider } as AuthenticatedUser);
  }

  const count = await db.prepare("SELECT COUNT(*) AS total FROM users").first<{ total: number }>();
  const role: Role = isOwnerEmail(identity.email) || Number(count?.total ?? 0) === 0 ? "Admin" : "Wali Santri";
  const now = new Date().toISOString();
  await db
    .prepare("INSERT INTO users (email, name, role, room_scope, created_at) VALUES (?, ?, ?, '', ?)")
    .bind(identity.email, identity.name, role, now)
    .run();
  const created = (await db
    .prepare("SELECT id, email, name, role, room_scope AS roomScope FROM users WHERE email = ?")
    .bind(identity.email)
    .first()) as AuthenticatedUser;
  return enforceAdminMfa({ ...created, authProvider: identity.authProvider });
}

export async function guardianOwnsStudent(user: Pick<AuthenticatedUser,"email"|"role"|"guardianPhone">, studentId: number) {
  if (user.role === "Admin") return true;
  if (user.role !== "Wali Santri") return false;
  const query = user.guardianPhone
    ? database().prepare("SELECT id FROM students WHERE id=? AND guardian_phone=?").bind(studentId, user.guardianPhone)
    : database().prepare("SELECT id FROM students WHERE id=? AND lower(guardian_email)=lower(?)").bind(studentId, user.email);
  return Boolean(await query.first());
}

export function canWrite(role: Role, resource: string) {
  if (role === "Admin") return true;
  if (role === "Kepala Asrama") {
    return ["tahfidz", "tahsin", "mutabaah", "health", "characters", "attendance", "permits", "counseling", "grades"].includes(resource);
  }
  if (role === "Musyrif") {
    return ["tahfidz", "tahsin", "mutabaah", "health", "characters", "attendance", "permits", "counseling", "grades"].includes(resource);
  }
  if (role === "Ustadz") {
    return ["tahfidz", "tahsin", "mutabaah", "health", "characters", "attendance", "permits", "counseling", "schedules", "grades"].includes(resource);
  }
  return false;
}

export async function seedIfNeeded() {
  await ensureDatabaseSchema();
  const db = database();
  const count = await db.prepare("SELECT COUNT(*) AS total FROM students").first<{ total: number }>();
  const now = new Date().toISOString();
  if (Number(count?.total ?? 0) === 0) await db.batch([
    db.prepare("INSERT INTO students (name, nis, class_name, room, guardian_name, guardian_phone, guardian_email, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind("Muhammad Fikri", "SN-240181", "VIII A", "Ibnu Sina 03", "Ahmad Hidayat", "6281234567801", "wali.fikri@sinurman.id", "Aktif", now),
    db.prepare("INSERT INTO students (name, nis, class_name, room, guardian_name, guardian_phone, guardian_email, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind("Ahmad Fauzan", "SN-240182", "VIII A", "Ibnu Sina 03", "Siti Rahmah", "6281234567802", "wali.fauzan@sinurman.id", "Aktif", now),
    db.prepare("INSERT INTO students (name, nis, class_name, room, guardian_name, guardian_phone, guardian_email, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind("Rizky Maulana", "SN-240194", "VIII B", "Al-Farabi 02", "Hendra Maulana", "6281234567803", "wali.rizky@sinurman.id", "Aktif", now),
    db.prepare("INSERT INTO students (name, nis, class_name, room, guardian_name, guardian_phone, guardian_email, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind("Nabil Hidayat", "SN-240207", "VII C", "Al-Khawarizmi 01", "Nur Hidayat", "6281234567804", "wali.nabil@sinurman.id", "Izin", now),
    db.prepare("INSERT INTO students (name, nis, class_name, room, guardian_name, guardian_phone, guardian_email, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind("Faris Abdullah", "SN-240212", "IX A", "Ibnu Khaldun 02", "Abdullah Karim", "6281234567805", "wali.faris@sinurman.id", "Aktif", now),
  ]);
  const studentClasses = await db.prepare(
    "SELECT DISTINCT class_name FROM students WHERE class_name<>'' AND class_name NOT LIKE 'Alumni%'",
  ).all<{ class_name:string }>();
  const standardClasses = [
    "VII A","VIII A","IX A",
    "X RPL","XI RPL","XII RPL",
    "X TKJ","XI TKJ","XII TKJ",
  ];
  const classNames = [...new Set([
    ...studentClasses.results.map(row => row.class_name),
    ...standardClasses,
  ])];
  await db.batch(classNames.map(className => {
    const educationLevel = /^(X|XI|XII)\s/.test(className) ? "SMK" : "SMP";
    const gradeOrder = className.startsWith("XII") ? 12
      : className.startsWith("XI") ? 11
      : className.startsWith("X ") ? 10
      : className.startsWith("IX") ? 9
      : className.startsWith("VIII") ? 8
      : 7;
    const major = educationLevel === "SMK" ? className.replace(/^(XII|XI|X)\s+/, "") : "";
    return db.prepare(
      `INSERT OR IGNORE INTO school_classes
       (name,education_level,grade_order,major,homeroom_teacher,capacity,next_class_name,academic_year,status,created_at,updated_at)
       VALUES (?,?,?,?,?,32,?,'2026/2027','Aktif',?,?)`,
    ).bind(className,educationLevel,gradeOrder,major,"","",now,now);
  }));
  if (Number(count?.total ?? 0) === 0) await db.batch([
    db.prepare("INSERT INTO tahfidz_records (student_id, surah, verses, amount, grade, teacher, recorded_at) VALUES (1, ?, ?, ?, ?, ?, ?)")
      .bind("Al-Mulk", "1–15", 15, "Mumtaz", "Ustadz Hasan", now),
    db.prepare("INSERT INTO tahfidz_records (student_id, surah, verses, amount, grade, teacher, recorded_at) VALUES (2, ?, ?, ?, ?, ?, ?)")
      .bind("Al-Qalam", "1–12", 12, "Jayyid Jiddan", "Ustadz Hasan", now),
    db.prepare("INSERT INTO tahfidz_records (student_id, surah, verses, amount, grade, teacher, recorded_at) VALUES (3, ?, ?, ?, ?, ?, ?)")
      .bind("Al-Haqqah", "20–30", 11, "Jayyid", "Ustadz Fauzi", now),
    db.prepare("INSERT INTO health_records (student_id, complaint, diagnosis, treatment, status, recorded_at) VALUES (4, ?, ?, ?, ?, ?)")
      .bind("Demam & pusing", "Demam ringan", "Istirahat dan paracetamol", "Dipantau", now),
    db.prepare("INSERT INTO health_records (student_id, complaint, diagnosis, treatment, status, recorded_at) VALUES (3, ?, ?, ?, ?, ?)")
      .bind("Batuk", "Iritasi tenggorokan", "Obat batuk", "Membaik", now),
    db.prepare("INSERT INTO transactions (student_id, type, category, amount, status, note, recorded_at) VALUES (1, ?, ?, ?, ?, ?, ?)")
      .bind("Masuk", "SPP", 750000, "Lunas", "SPP Juli 2026", now),
    db.prepare("INSERT INTO transactions (student_id, type, category, amount, status, note, recorded_at) VALUES (1, ?, ?, ?, ?, ?, ?)")
      .bind("Masuk", "Uang Saku", 500000, "Berhasil", "Top up wali santri", now),
  ]);
  const walletCount = await db.prepare("SELECT COUNT(*) AS total FROM wallet_accounts").first<{ total:number }>();
  if (Number(walletCount?.total ?? 0) === 0) {
    const studentRows = await db.prepare("SELECT id FROM students ORDER BY id").all<{ id:number }>();
    await db.batch(studentRows.results.map((student) => {
      const token = `SNP-${crypto.randomUUID().replaceAll("-","").slice(0,20).toUpperCase()}`;
      return db.prepare("INSERT INTO wallet_accounts (student_id,card_token,balance,daily_limit,status,updated_at) VALUES (?,?,0,50000,?,?)")
        .bind(student.id,token,"Aktif",now);
    }));
  }
  const productCount = await db.prepare("SELECT COUNT(*) AS total FROM canteen_products").first<{ total:number }>();
  if (Number(productCount?.total ?? 0) === 0) await db.batch([
    db.prepare("INSERT INTO canteen_products (sku,name,category,price,stock,status,updated_at) VALUES (?,?,?,?,?,?,?)").bind("KTN-001","Air Mineral","Minuman",3000,120,"Aktif",now),
    db.prepare("INSERT INTO canteen_products (sku,name,category,price,stock,status,updated_at) VALUES (?,?,?,?,?,?,?)").bind("KTN-002","Susu Kotak","Minuman",7000,65,"Aktif",now),
    db.prepare("INSERT INTO canteen_products (sku,name,category,price,stock,status,updated_at) VALUES (?,?,?,?,?,?,?)").bind("KTN-003","Roti Cokelat","Makanan",6000,48,"Aktif",now),
    db.prepare("INSERT INTO canteen_products (sku,name,category,price,stock,status,updated_at) VALUES (?,?,?,?,?,?,?)").bind("KTN-004","Nasi Ayam","Makanan",15000,35,"Aktif",now),
    db.prepare("INSERT INTO canteen_products (sku,name,category,price,stock,status,updated_at) VALUES (?,?,?,?,?,?,?)").bind("KTN-005","Buku Tulis","Alat Tulis",5000,80,"Aktif",now),
    db.prepare("INSERT INTO canteen_products (sku,name,category,price,stock,status,updated_at) VALUES (?,?,?,?,?,?,?)").bind("KTN-006","Pulpen","Alat Tulis",3000,95,"Aktif",now),
  ]);
  if (Number(count?.total ?? 0) === 0) await db.batch([
    db.prepare("INSERT INTO inventory_items (name, location, quantity, unit, condition, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
      .bind("Ranjang Susun", "Asrama", 248, "unit", "Baik", now),
    db.prepare("INSERT INTO inventory_items (name, location, quantity, unit, condition, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
      .bind("Lemari Santri", "Asrama", 486, "unit", "Baik", now),
    db.prepare("INSERT INTO inventory_items (name, location, quantity, unit, condition, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
      .bind("Proyektor", "Ruang Kelas", 14, "unit", "Perawatan", now),
    db.prepare("INSERT INTO announcements (title, category, content, audience, published_at, author) VALUES (?, ?, ?, ?, ?, ?)")
      .bind("Jadwal Ujian Tahfidz Semester", "Akademik", "Ujian tahfidz dilaksanakan mulai 29 Juli 2026.", "Semua", now, "Admin"),
    db.prepare("INSERT INTO announcements (title, category, content, audience, published_at, author) VALUES (?, ?, ?, ?, ?, ?)")
      .bind("Jadwal Kunjungan Wali Santri", "Kunjungan", "Kunjungan dibuka pada Ahad pekan pertama dan ketiga.", "Wali Santri", now, "Admin"),
  ]);

  const attendanceCount = await db.prepare("SELECT COUNT(*) AS total FROM attendance_records").first<{ total:number }>();
  if (Number(attendanceCount?.total ?? 0) === 0) await db.batch([
    db.prepare("INSERT INTO attendance_records (student_id, record_date, status, note, recorded_by) VALUES (1, ?, ?, ?, ?)")
      .bind(now.slice(0,10), "Hadir", "Apel pagi", "Ustadz Hasan"),
    db.prepare("INSERT INTO attendance_records (student_id, record_date, status, note, recorded_by) VALUES (2, ?, ?, ?, ?)")
      .bind(now.slice(0,10), "Hadir", "Apel pagi", "Ustadz Hasan"),
    db.prepare("INSERT INTO attendance_records (student_id, record_date, status, note, recorded_by) VALUES (4, ?, ?, ?, ?)")
      .bind(now.slice(0,10), "Sakit", "Istirahat di klinik", "Ustadz Hasan"),
    db.prepare("INSERT INTO leave_permits (student_id, start_date, end_date, reason, status, approved_by) VALUES (4, ?, ?, ?, ?, ?)")
      .bind(now.slice(0,10), now.slice(0,10), "Pemeriksaan kesehatan", "Disetujui", "Admin"),
  ]);
  const subjectCount = await db.prepare("SELECT COUNT(*) AS total FROM academic_subjects").first<{ total:number }>();
  if (Number(subjectCount?.total ?? 0) === 0) await db.batch([
    db.prepare("INSERT INTO academic_subjects (code,name,education_level,class_name,teacher,semester,academic_year,minimum_score,created_at) VALUES (?,?,?,?,?,?,?,?,?)")
      .bind("SMP-VII-MTK","Matematika","SMP","VII A","Ibu Nur Aini","Ganjil","2026/2027",75,now),
    db.prepare("INSERT INTO academic_subjects (code,name,education_level,class_name,teacher,semester,academic_year,minimum_score,created_at) VALUES (?,?,?,?,?,?,?,?,?)")
      .bind("SMP-VIII-IPA","IPA","SMP","VIII A","Bapak Arif","Ganjil","2026/2027",75,now),
    db.prepare("INSERT INTO academic_subjects (code,name,education_level,class_name,teacher,semester,academic_year,minimum_score,created_at) VALUES (?,?,?,?,?,?,?,?,?)")
      .bind("SMK-X-RPL","Pemrograman Web","SMK","X RPL","Bapak Dimas","Ganjil","2026/2027",78,now),
  ]);
  const scheduleCount = await db.prepare("SELECT COUNT(*) AS total FROM schedules").first<{ total:number }>();
  if (Number(scheduleCount?.total ?? 0) < 50) {
    const classes = [
      ["SMP","VII A"],["SMP","VIII A"],["SMP","IX A"],
      ["SMK","X RPL"],["SMK","XI RPL"],["SMK","XII RPL"],
      ["SMK","X TKJ"],["SMK","XI TKJ"],["SMK","XII TKJ"],
    ];
    const days = ["Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
    const slots = [["07:00","07:40"],["07:40","08:20"],["08:30","09:10"],["09:10","09:50"],["10:10","10:50"],["10:50","11:30"]];
    const smpSubjects = [
      ["Tahfidz","Matematika","Bahasa Indonesia","IPA","PAI","Bahasa Inggris"],
      ["Tahfidz","IPS","Matematika","Bahasa Arab","Informatika","PJOK"],
      ["Tahfidz","Bahasa Indonesia","IPA","Matematika","Fiqih","Seni Budaya"],
      ["Tahfidz","Bahasa Inggris","IPS","Matematika","Akidah Akhlak","Informatika"],
      ["Tahfidz","PAI","Bahasa Indonesia","IPA","Prakarya","Literasi"],
      ["Tahfidz","PJOK","Projek P5","Projek P5","Muhadharah","Evaluasi Pekanan"],
    ];
    const smkSubjects = [
      ["Tahfidz","Matematika","Bahasa Indonesia","Produktif 1","Produktif 1","PAI"],
      ["Tahfidz","Bahasa Inggris","Produktif 2","Produktif 2","PKK","Bahasa Arab"],
      ["Tahfidz","Matematika","Informatika","Produktif 1","Produktif 1","Fiqih"],
      ["Tahfidz","Bahasa Indonesia","Produktif 2","Produktif 2","IPAS","BK"],
      ["Tahfidz","PAI","Bahasa Inggris","PKK","Projek P5","Projek P5"],
      ["Tahfidz","PJOK","Praktik Kejuruan","Praktik Kejuruan","Muhadharah","Evaluasi Pekanan"],
    ];
    const teachers: Record<string,string> = {
      Tahfidz:"Ustadz Hasan",Matematika:"Ibu Nur Aini","Bahasa Indonesia":"Ibu Salma",IPA:"Bapak Arif",IPS:"Bapak Rizal",PAI:"Ustadz Fauzi","Bahasa Inggris":"Ibu Nadia","Bahasa Arab":"Ustadz Karim",Informatika:"Bapak Ilham",PJOK:"Bapak Fadli","Akidah Akhlak":"Ustadz Rahmat",Fiqih:"Ustadz Fauzi","Seni Budaya":"Ibu Hana",Prakarya:"Ibu Hana",Literasi:"Ibu Salma",BK:"Ibu Laila",IPAS:"Bapak Arif",PKK:"Bapak Dimas","Projek P5":"Tim Projek",Muhadharah:"Ustadz Hasan","Evaluasi Pekanan":"Wali Kelas","Praktik Kejuruan":"Guru Produktif",
    };
    const existingSchedules = await db.prepare(
      "SELECT class_name,day_name,start_time FROM schedules",
    ).all<{class_name:string;day_name:string;start_time:string}>();
    const scheduleKeys = new Set(
      existingSchedules.results.map(row => `${row.class_name}|${row.day_name}|${row.start_time}`),
    );
    const statements: D1PreparedStatement[] = [];
    for (const [level,className] of classes) {
      for (let dayIndex=0; dayIndex<days.length; dayIndex++) {
        for (let slotIndex=0; slotIndex<slots.length; slotIndex++) {
          let subject=(level==="SMP"?smpSubjects:smkSubjects)[dayIndex][slotIndex];
          if(subject.startsWith("Produktif")) subject=className.includes("RPL")?(subject==="Produktif 1"?"Pemrograman Web":"Basis Data"):(subject==="Produktif 1"?"Jaringan Komputer":"Administrasi Sistem");
          if(subject==="Praktik Kejuruan") subject=className.includes("RPL")?"Praktik Pemrograman":"Praktik Jaringan";
          const category=subject==="Tahfidz"?"Tahfidz":subject.includes("Pemrograman")||subject.includes("Jaringan")||subject==="Basis Data"||subject==="Administrasi Sistem"||subject==="PKK"?"Produktif":"Pelajaran Umum";
          const teacher=teachers[subject]??(category==="Produktif"?"Bapak Dimas":"Wali Kelas");
          const key = `${className}|${days[dayIndex]}|${slots[slotIndex][0]}`;
          if (!scheduleKeys.has(key)) {
            scheduleKeys.add(key);
            statements.push(db.prepare(
              "INSERT INTO schedules (education_level,class_name,title,category,teacher,location,day_name,start_time,end_time) VALUES (?,?,?,?,?,?,?,?,?)",
            ).bind(level,className,subject,category,teacher,`Kelas ${className}`,days[dayIndex],slots[slotIndex][0],slots[slotIndex][1]));
          }
        }
      }
    }
    for(let index=0;index<statements.length;index+=75) await db.batch(statements.slice(index,index+75));
  }
  const roomCount = await db.prepare("SELECT COUNT(*) AS total FROM rooms").first<{ total:number }>();
  if (Number(roomCount?.total ?? 0) === 0) await db.batch([
    db.prepare("INSERT INTO rooms (name, capacity, supervisor, status) VALUES (?, ?, ?, ?)")
      .bind("Ibnu Sina 03", 24, "Ustadz Rahmat", "Aktif"),
    db.prepare("INSERT INTO rooms (name, capacity, supervisor, status) VALUES (?, ?, ?, ?)")
      .bind("Al-Farabi 02", 22, "Ustadz Karim", "Aktif"),
  ]);
  const admissionCount = await db.prepare("SELECT COUNT(*) AS total FROM admissions").first<{ total:number }>();
  if (Number(admissionCount?.total ?? 0) === 0) await db.batch([
    db.prepare("INSERT INTO admissions (registration_no, name, guardian_name, guardian_phone, previous_school, status, score, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .bind("PSB-260001", "Rafi Akbar", "Budi Akbar", "6281311110001", "SDIT Al-Hikmah", "Verifikasi", 82, now),
    db.prepare("INSERT INTO admissions (registration_no, name, guardian_name, guardian_phone, previous_school, status, score, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .bind("PSB-260002", "Ilham Ramadhan", "Dedi Ramadhan", "6281311110002", "MI Nurul Falah", "Tes", 76, now),
    db.prepare("INSERT INTO counseling_records (student_id, type, category, description, points, status, counselor, recorded_at) VALUES (3, ?, ?, ?, ?, ?, ?, ?)")
      .bind("Pembinaan", "Kedisiplinan", "Terlambat mengikuti apel pagi", 5, "Ditindaklanjuti", "Ustadz Hasan", now),
    db.prepare("INSERT INTO bills (student_id, invoice_no, category, amount, due_date, status, payment_url, created_at) VALUES (1, ?, ?, ?, ?, ?, ?, ?)")
      .bind("INV-202607-0001", "SPP Juli", 750000, "2026-07-10", "Lunas", "", now),
  ]);
}

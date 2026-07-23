import { env } from "cloudflare:workers";

export type Role = "Admin" | "Ustadz" | "Wali Santri";

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
      "CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT,email TEXT NOT NULL UNIQUE,name TEXT NOT NULL,role TEXT NOT NULL,created_at TEXT NOT NULL)",
      "CREATE TABLE IF NOT EXISTS students (id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,nis TEXT NOT NULL UNIQUE,class_name TEXT NOT NULL,room TEXT NOT NULL,guardian_name TEXT NOT NULL,guardian_phone TEXT NOT NULL,guardian_email TEXT NOT NULL DEFAULT '',status TEXT NOT NULL DEFAULT 'Aktif',created_at TEXT NOT NULL)",
      "CREATE TABLE IF NOT EXISTS tahfidz_records (id INTEGER PRIMARY KEY AUTOINCREMENT,student_id INTEGER NOT NULL,surah TEXT NOT NULL,verses TEXT NOT NULL,amount INTEGER NOT NULL,grade TEXT NOT NULL,teacher TEXT NOT NULL,recorded_at TEXT NOT NULL)",
      "CREATE TABLE IF NOT EXISTS mutabaah_records (id INTEGER PRIMARY KEY AUTOINCREMENT,student_id INTEGER NOT NULL,activity TEXT NOT NULL,completed INTEGER NOT NULL DEFAULT 0,record_date TEXT NOT NULL,recorded_by TEXT NOT NULL)",
      "CREATE TABLE IF NOT EXISTS health_records (id INTEGER PRIMARY KEY AUTOINCREMENT,student_id INTEGER NOT NULL,complaint TEXT NOT NULL,diagnosis TEXT NOT NULL,treatment TEXT NOT NULL,status TEXT NOT NULL,recorded_at TEXT NOT NULL)",
      "CREATE TABLE IF NOT EXISTS transactions (id INTEGER PRIMARY KEY AUTOINCREMENT,student_id INTEGER NOT NULL,type TEXT NOT NULL,category TEXT NOT NULL,amount INTEGER NOT NULL,status TEXT NOT NULL,note TEXT NOT NULL,recorded_at TEXT NOT NULL)",
      "CREATE TABLE IF NOT EXISTS character_reports (id INTEGER PRIMARY KEY AUTOINCREMENT,student_id INTEGER NOT NULL,category TEXT NOT NULL,score INTEGER NOT NULL,note TEXT NOT NULL,semester TEXT NOT NULL,recorded_at TEXT NOT NULL)",
      "CREATE TABLE IF NOT EXISTS inventory_items (id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,location TEXT NOT NULL,quantity INTEGER NOT NULL,unit TEXT NOT NULL,condition TEXT NOT NULL,updated_at TEXT NOT NULL)",
      "CREATE TABLE IF NOT EXISTS announcements (id INTEGER PRIMARY KEY AUTOINCREMENT,title TEXT NOT NULL,category TEXT NOT NULL,content TEXT NOT NULL,audience TEXT NOT NULL,published_at TEXT NOT NULL,author TEXT NOT NULL)",
      "CREATE TABLE IF NOT EXISTS notification_logs (id INTEGER PRIMARY KEY AUTOINCREMENT,student_id INTEGER,channel TEXT NOT NULL,recipient TEXT NOT NULL,message TEXT NOT NULL,status TEXT NOT NULL,sent_at TEXT NOT NULL)",
      "CREATE TABLE IF NOT EXISTS attendance_records (id INTEGER PRIMARY KEY AUTOINCREMENT,student_id INTEGER NOT NULL,record_date TEXT NOT NULL,status TEXT NOT NULL,note TEXT NOT NULL,recorded_by TEXT NOT NULL)",
      "CREATE TABLE IF NOT EXISTS leave_permits (id INTEGER PRIMARY KEY AUTOINCREMENT,student_id INTEGER NOT NULL,start_date TEXT NOT NULL,end_date TEXT NOT NULL,reason TEXT NOT NULL,status TEXT NOT NULL,approved_by TEXT NOT NULL)",
      "CREATE TABLE IF NOT EXISTS schedules (id INTEGER PRIMARY KEY AUTOINCREMENT,education_level TEXT NOT NULL DEFAULT 'SMP',class_name TEXT NOT NULL DEFAULT 'VII A',title TEXT NOT NULL,category TEXT NOT NULL,teacher TEXT NOT NULL,location TEXT NOT NULL,day_name TEXT NOT NULL,start_time TEXT NOT NULL,end_time TEXT NOT NULL)",
      "CREATE TABLE IF NOT EXISTS rooms (id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL UNIQUE,capacity INTEGER NOT NULL,supervisor TEXT NOT NULL,status TEXT NOT NULL)",
      "CREATE TABLE IF NOT EXISTS admissions (id INTEGER PRIMARY KEY AUTOINCREMENT,registration_no TEXT NOT NULL UNIQUE,name TEXT NOT NULL,applicant_email TEXT NOT NULL DEFAULT '',nisn TEXT NOT NULL DEFAULT '',birth_place TEXT NOT NULL DEFAULT '',birth_date TEXT NOT NULL DEFAULT '',gender TEXT NOT NULL DEFAULT '',desired_level TEXT NOT NULL DEFAULT 'SMP',guardian_name TEXT NOT NULL,guardian_phone TEXT NOT NULL,previous_school TEXT NOT NULL,address TEXT NOT NULL DEFAULT '',status TEXT NOT NULL,score INTEGER NOT NULL DEFAULT 0,verification_note TEXT NOT NULL DEFAULT '',verified_by TEXT NOT NULL DEFAULT '',verified_at TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL)",
      "CREATE TABLE IF NOT EXISTS admission_documents (id INTEGER PRIMARY KEY AUTOINCREMENT,admission_id INTEGER NOT NULL,doc_type TEXT NOT NULL,file_name TEXT NOT NULL,object_key TEXT NOT NULL UNIQUE,content_type TEXT NOT NULL,size_bytes INTEGER NOT NULL,status TEXT NOT NULL DEFAULT 'Menunggu',verification_note TEXT NOT NULL DEFAULT '',verified_by TEXT NOT NULL DEFAULT '',verified_at TEXT NOT NULL DEFAULT '',uploaded_at TEXT NOT NULL)",
      "CREATE TABLE IF NOT EXISTS counseling_records (id INTEGER PRIMARY KEY AUTOINCREMENT,student_id INTEGER NOT NULL,type TEXT NOT NULL,category TEXT NOT NULL,description TEXT NOT NULL,points INTEGER NOT NULL DEFAULT 0,status TEXT NOT NULL,counselor TEXT NOT NULL,recorded_at TEXT NOT NULL)",
      "CREATE TABLE IF NOT EXISTS bills (id INTEGER PRIMARY KEY AUTOINCREMENT,student_id INTEGER NOT NULL,invoice_no TEXT NOT NULL UNIQUE,category TEXT NOT NULL,amount INTEGER NOT NULL,due_date TEXT NOT NULL,status TEXT NOT NULL,payment_url TEXT NOT NULL,payment_method TEXT NOT NULL DEFAULT '',payment_reference TEXT NOT NULL DEFAULT '',paid_at TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL)",
      "CREATE TABLE IF NOT EXISTS guardian_messages (id INTEGER PRIMARY KEY AUTOINCREMENT,student_id INTEGER NOT NULL,sender_email TEXT NOT NULL,subject TEXT NOT NULL,message TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'Baru',reply TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL,replied_at TEXT NOT NULL DEFAULT '')",
      "CREATE TABLE IF NOT EXISTS guardian_requests (id INTEGER PRIMARY KEY AUTOINCREMENT,student_id INTEGER NOT NULL,requester_email TEXT NOT NULL,type TEXT NOT NULL,visit_date TEXT NOT NULL,start_time TEXT NOT NULL,end_time TEXT NOT NULL,purpose TEXT NOT NULL,visitor_name TEXT NOT NULL,visitor_phone TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'Diajukan',qr_token TEXT NOT NULL UNIQUE,used_at TEXT NOT NULL DEFAULT '',approved_by TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL)",
      "CREATE TABLE IF NOT EXISTS audit_logs (id INTEGER PRIMARY KEY AUTOINCREMENT,user_email TEXT NOT NULL,action TEXT NOT NULL,resource TEXT NOT NULL,record_id INTEGER,detail TEXT NOT NULL,created_at TEXT NOT NULL)",
    ];
    await db.batch(definitions.map((sql) => db.prepare(sql)));

    const upgrades: Record<string, Record<string, string>> = {
      students: { guardian_email: "TEXT NOT NULL DEFAULT ''" },
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
  })().catch((error) => {
    schemaReady = null;
    throw error;
  });
  return schemaReady;
}

export function currentIdentity(request: Request) {
  const email =
    request.headers.get("oai-authenticated-user-email") ||
    "admin@sinurman.local";
  const encodedName = request.headers.get("oai-authenticated-user-full-name");
  const encoding = request.headers.get("oai-authenticated-user-full-name-encoding");
  let name = email.split("@")[0];
  if (encodedName && encoding === "percent-encoded-utf-8") {
    try { name = decodeURIComponent(encodedName); } catch { /* use fallback */ }
  }
  return { email, name };
}

export async function ensureUser(request: Request) {
  await ensureDatabaseSchema();
  const db = database();
  const identity = currentIdentity(request);
  const existing = await db
    .prepare("SELECT id, email, name, role FROM users WHERE email = ?")
    .bind(identity.email)
    .first<{ id: number; email: string; name: string; role: Role }>();

  if (existing) return existing;

  const count = await db.prepare("SELECT COUNT(*) AS total FROM users").first<{ total: number }>();
  const role: Role = Number(count?.total ?? 0) === 0 ? "Admin" : "Wali Santri";
  const now = new Date().toISOString();
  await db
    .prepare("INSERT INTO users (email, name, role, created_at) VALUES (?, ?, ?, ?)")
    .bind(identity.email, identity.name, role, now)
    .run();
  return (await db
    .prepare("SELECT id, email, name, role FROM users WHERE email = ?")
    .bind(identity.email)
    .first()) as { id: number; email: string; name: string; role: Role };
}

export function canWrite(role: Role, resource: string) {
  if (role === "Admin") return true;
  if (role === "Ustadz") {
    return ["tahfidz", "mutabaah", "health", "characters", "attendance", "permits", "counseling", "schedules"].includes(resource);
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
    const statements: D1PreparedStatement[] = [];
    for (const [level,className] of classes) {
      for (let dayIndex=0; dayIndex<days.length; dayIndex++) {
        for (let slotIndex=0; slotIndex<slots.length; slotIndex++) {
          let subject=(level==="SMP"?smpSubjects:smkSubjects)[dayIndex][slotIndex];
          if(subject.startsWith("Produktif")) subject=className.includes("RPL")?(subject==="Produktif 1"?"Pemrograman Web":"Basis Data"):(subject==="Produktif 1"?"Jaringan Komputer":"Administrasi Sistem");
          if(subject==="Praktik Kejuruan") subject=className.includes("RPL")?"Praktik Pemrograman":"Praktik Jaringan";
          const category=subject==="Tahfidz"?"Tahfidz":subject.includes("Pemrograman")||subject.includes("Jaringan")||subject==="Basis Data"||subject==="Administrasi Sistem"||subject==="PKK"?"Produktif":"Pelajaran Umum";
          const teacher=teachers[subject]??(category==="Produktif"?"Bapak Dimas":"Wali Kelas");
          statements.push(db.prepare("INSERT INTO schedules (education_level, class_name, title, category, teacher, location, day_name, start_time, end_time) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM schedules WHERE class_name=? AND day_name=? AND start_time=?)")
            .bind(level,className,subject,category,teacher,`Kelas ${className}`,days[dayIndex],slots[slotIndex][0],slots[slotIndex][1],className,days[dayIndex],slots[slotIndex][0]));
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

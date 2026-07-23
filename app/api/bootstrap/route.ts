import { database, ensureUser, seedIfNeeded } from "../_lib";

export async function GET(request: Request) {
  try {
    await seedIfNeeded();
    const db = database();
    const user = await ensureUser(request);
    const guardian = user.role === "Wali Santri";
    const guardianEmail = user.email.toLocaleLowerCase("id-ID");
    const all = (query: string) => db.prepare(query).all();
    const owned = (query: string) => db.prepare(query).bind(guardianEmail).all();

    const [
      students,
      tahfidz,
      mutabaah,
      health,
      transactions,
      inventory,
      announcements,
      characters,
      notifications,
      attendance,
      permits,
      schedules,
      rooms,
      admissions,
      counseling,
      bills,
      users,
      audit,
      guardianMessages,
      guardianRequests,
    ] = await Promise.all([
      guardian
        ? owned("SELECT * FROM students WHERE lower(guardian_email) = ? ORDER BY id")
        : all("SELECT * FROM students ORDER BY id DESC"),
      guardian
        ? owned("SELECT t.*, s.name AS student_name FROM tahfidz_records t JOIN students s ON s.id=t.student_id WHERE lower(s.guardian_email)=? ORDER BY t.id DESC LIMIT 100")
        : all("SELECT t.*, s.name AS student_name FROM tahfidz_records t JOIN students s ON s.id=t.student_id ORDER BY t.id DESC LIMIT 100"),
      guardian
        ? owned("SELECT m.*, s.name AS student_name FROM mutabaah_records m JOIN students s ON s.id=m.student_id WHERE lower(s.guardian_email)=? ORDER BY m.id DESC LIMIT 100")
        : all("SELECT m.*, s.name AS student_name FROM mutabaah_records m JOIN students s ON s.id=m.student_id ORDER BY m.id DESC LIMIT 100"),
      guardian
        ? owned("SELECT h.*, s.name AS student_name FROM health_records h JOIN students s ON s.id=h.student_id WHERE lower(s.guardian_email)=? ORDER BY h.id DESC LIMIT 100")
        : all("SELECT h.*, s.name AS student_name FROM health_records h JOIN students s ON s.id=h.student_id ORDER BY h.id DESC LIMIT 100"),
      guardian
        ? owned("SELECT t.*, s.name AS student_name FROM transactions t JOIN students s ON s.id=t.student_id WHERE lower(s.guardian_email)=? ORDER BY t.id DESC LIMIT 150")
        : all("SELECT t.*, s.name AS student_name FROM transactions t JOIN students s ON s.id=t.student_id ORDER BY t.id DESC LIMIT 150"),
      guardian
        ? all("SELECT * FROM inventory_items WHERE 1=0")
        : all("SELECT * FROM inventory_items ORDER BY id DESC"),
      guardian
        ? all("SELECT * FROM announcements WHERE audience IN ('Semua','Wali Santri') ORDER BY id DESC LIMIT 50")
        : all("SELECT * FROM announcements ORDER BY id DESC"),
      guardian
        ? owned("SELECT c.*, s.name AS student_name FROM character_reports c JOIN students s ON s.id=c.student_id WHERE lower(s.guardian_email)=? ORDER BY c.id DESC LIMIT 100")
        : all("SELECT c.*, s.name AS student_name FROM character_reports c JOIN students s ON s.id=c.student_id ORDER BY c.id DESC LIMIT 100"),
      guardian
        ? owned("SELECT n.* FROM notification_logs n JOIN students s ON s.id=n.student_id WHERE lower(s.guardian_email)=? ORDER BY n.id DESC LIMIT 30")
        : all("SELECT * FROM notification_logs ORDER BY id DESC LIMIT 30"),
      guardian
        ? owned("SELECT a.*, s.name AS student_name FROM attendance_records a JOIN students s ON s.id=a.student_id WHERE lower(s.guardian_email)=? ORDER BY a.id DESC LIMIT 100")
        : all("SELECT a.*, s.name AS student_name FROM attendance_records a JOIN students s ON s.id=a.student_id ORDER BY a.id DESC LIMIT 100"),
      guardian
        ? owned("SELECT p.*, s.name AS student_name FROM leave_permits p JOIN students s ON s.id=p.student_id WHERE lower(s.guardian_email)=? ORDER BY p.id DESC LIMIT 50")
        : all("SELECT p.*, s.name AS student_name FROM leave_permits p JOIN students s ON s.id=p.student_id ORDER BY p.id DESC LIMIT 50"),
      guardian
        ? owned("SELECT * FROM schedules WHERE class_name IN (SELECT class_name FROM students WHERE lower(guardian_email)=?) ORDER BY education_level, class_name, CASE day_name WHEN 'Senin' THEN 1 WHEN 'Selasa' THEN 2 WHEN 'Rabu' THEN 3 WHEN 'Kamis' THEN 4 WHEN 'Jumat' THEN 5 WHEN 'Sabtu' THEN 6 ELSE 7 END, start_time")
        : all("SELECT * FROM schedules ORDER BY education_level, class_name, CASE day_name WHEN 'Senin' THEN 1 WHEN 'Selasa' THEN 2 WHEN 'Rabu' THEN 3 WHEN 'Kamis' THEN 4 WHEN 'Jumat' THEN 5 WHEN 'Sabtu' THEN 6 ELSE 7 END, start_time"),
      guardian
        ? owned("SELECT * FROM rooms WHERE name IN (SELECT room FROM students WHERE lower(guardian_email)=?) ORDER BY name")
        : all("SELECT * FROM rooms ORDER BY name"),
      guardian
        ? all("SELECT * FROM admissions WHERE 1=0")
        : all("SELECT * FROM admissions ORDER BY id DESC"),
      guardian
        ? all("SELECT c.*, s.name AS student_name FROM counseling_records c JOIN students s ON s.id=c.student_id WHERE 1=0")
        : all("SELECT c.*, s.name AS student_name FROM counseling_records c JOIN students s ON s.id=c.student_id ORDER BY c.id DESC LIMIT 100"),
      guardian
        ? owned("SELECT b.*, s.name AS student_name FROM bills b JOIN students s ON s.id=b.student_id WHERE lower(s.guardian_email)=? ORDER BY b.id DESC LIMIT 100")
        : all("SELECT b.*, s.name AS student_name FROM bills b JOIN students s ON s.id=b.student_id ORDER BY b.id DESC LIMIT 100"),
      guardian
        ? owned("SELECT id, email, name, role, created_at FROM users WHERE lower(email)=?")
        : all("SELECT id, email, name, role, created_at FROM users ORDER BY id"),
      guardian
        ? all("SELECT * FROM audit_logs WHERE 1=0")
        : all("SELECT * FROM audit_logs ORDER BY id DESC LIMIT 100"),
      guardian
        ? owned("SELECT g.*, s.name AS student_name FROM guardian_messages g JOIN students s ON s.id=g.student_id WHERE lower(g.sender_email)=? ORDER BY g.id DESC LIMIT 50")
        : all("SELECT g.*, s.name AS student_name FROM guardian_messages g JOIN students s ON s.id=g.student_id ORDER BY g.id DESC LIMIT 100"),
      guardian
        ? owned("SELECT g.*,s.name AS student_name,s.nis FROM guardian_requests g JOIN students s ON s.id=g.student_id WHERE lower(s.guardian_email)=? ORDER BY g.id DESC LIMIT 50")
        : all("SELECT g.*,s.name AS student_name,s.nis FROM guardian_requests g JOIN students s ON s.id=g.student_id ORDER BY g.id DESC LIMIT 100"),
    ]);

    return Response.json({
      user,
      students: students.results,
      tahfidz: tahfidz.results,
      mutabaah: mutabaah.results,
      health: health.results,
      transactions: transactions.results,
      inventory: inventory.results,
      announcements: announcements.results,
      characters: characters.results,
      notifications: notifications.results,
      attendance: attendance.results,
      permits: permits.results,
      schedules: schedules.results,
      rooms: rooms.results,
      admissions: admissions.results,
      counseling: counseling.results,
      bills: bills.results,
      users: users.results,
      audit: audit.results,
      guardianMessages: guardianMessages.results,
      guardianRequests: guardianRequests.results,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Gagal memuat data." },
      { status: 500 },
    );
  }
}

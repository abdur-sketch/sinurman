import { database, ensureUser, seedIfNeeded } from "../_lib";

export async function GET(request: Request) {
  try {
    await seedIfNeeded();
    const db = database();
    const user = await ensureUser(request);
    const [
      students,
      tahfidz,
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
    ] = await Promise.all([
      db.prepare("SELECT * FROM students ORDER BY id DESC").all(),
      db.prepare("SELECT t.*, s.name AS student_name FROM tahfidz_records t JOIN students s ON s.id = t.student_id ORDER BY t.id DESC LIMIT 50").all(),
      db.prepare("SELECT h.*, s.name AS student_name FROM health_records h JOIN students s ON s.id = h.student_id ORDER BY h.id DESC LIMIT 50").all(),
      db.prepare("SELECT t.*, s.name AS student_name FROM transactions t JOIN students s ON s.id = t.student_id ORDER BY t.id DESC LIMIT 100").all(),
      db.prepare("SELECT * FROM inventory_items ORDER BY id DESC").all(),
      db.prepare("SELECT * FROM announcements ORDER BY id DESC").all(),
      db.prepare("SELECT c.*, s.name AS student_name FROM character_reports c JOIN students s ON s.id = c.student_id ORDER BY c.id DESC LIMIT 100").all(),
      db.prepare("SELECT * FROM notification_logs ORDER BY id DESC LIMIT 30").all(),
      db.prepare("SELECT a.*, s.name AS student_name FROM attendance_records a JOIN students s ON s.id=a.student_id ORDER BY a.id DESC LIMIT 100").all(),
      db.prepare("SELECT p.*, s.name AS student_name FROM leave_permits p JOIN students s ON s.id=p.student_id ORDER BY p.id DESC LIMIT 50").all(),
      db.prepare("SELECT * FROM schedules ORDER BY education_level, class_name, CASE day_name WHEN 'Senin' THEN 1 WHEN 'Selasa' THEN 2 WHEN 'Rabu' THEN 3 WHEN 'Kamis' THEN 4 WHEN 'Jumat' THEN 5 WHEN 'Sabtu' THEN 6 ELSE 7 END, start_time").all(),
      db.prepare("SELECT * FROM rooms ORDER BY name").all(),
      db.prepare("SELECT * FROM admissions ORDER BY id DESC").all(),
      db.prepare("SELECT c.*, s.name AS student_name FROM counseling_records c JOIN students s ON s.id=c.student_id ORDER BY c.id DESC LIMIT 100").all(),
      db.prepare("SELECT b.*, s.name AS student_name FROM bills b JOIN students s ON s.id=b.student_id ORDER BY b.id DESC LIMIT 100").all(),
      db.prepare("SELECT id, email, name, role, created_at FROM users ORDER BY id").all(),
      db.prepare("SELECT * FROM audit_logs ORDER BY id DESC LIMIT 100").all(),
    ]);
    return Response.json({
      user,
      students: students.results,
      tahfidz: tahfidz.results,
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
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Gagal memuat data." },
      { status: 500 },
    );
  }
}

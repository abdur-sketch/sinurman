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
    ] = await Promise.all([
      db.prepare("SELECT * FROM students ORDER BY id DESC").all(),
      db.prepare("SELECT t.*, s.name AS student_name FROM tahfidz_records t JOIN students s ON s.id = t.student_id ORDER BY t.id DESC LIMIT 50").all(),
      db.prepare("SELECT h.*, s.name AS student_name FROM health_records h JOIN students s ON s.id = h.student_id ORDER BY h.id DESC LIMIT 50").all(),
      db.prepare("SELECT t.*, s.name AS student_name FROM transactions t JOIN students s ON s.id = t.student_id ORDER BY t.id DESC LIMIT 100").all(),
      db.prepare("SELECT * FROM inventory_items ORDER BY id DESC").all(),
      db.prepare("SELECT * FROM announcements ORDER BY id DESC").all(),
      db.prepare("SELECT c.*, s.name AS student_name FROM character_reports c JOIN students s ON s.id = c.student_id ORDER BY c.id DESC LIMIT 100").all(),
      db.prepare("SELECT * FROM notification_logs ORDER BY id DESC LIMIT 30").all(),
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
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Gagal memuat data." },
      { status: 500 },
    );
  }
}

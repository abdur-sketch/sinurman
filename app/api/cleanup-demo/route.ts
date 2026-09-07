import { database, ensureUser } from "../_lib";

const studentTables = ["tahfidz_records","tahsin_records","mutabaah_records","health_records","transactions","character_reports","attendance_records","leave_permits","counseling_records","academic_grades","bills","wallet_accounts","wallet_entries","wallet_topups","canteen_sales"];

export async function POST(request: Request) {
  try {
    const user = await ensureUser(request);
    if (user.role !== "Admin") return Response.json({ error: "Pembersihan hanya tersedia untuk Admin." }, { status: 403 });
    const body = await request.json().catch(() => ({})) as { confirm?: string };
    if (body.confirm !== "HAPUS DATA DEMO") return Response.json({ error: "Ketik HAPUS DATA DEMO untuk mengonfirmasi." }, { status: 400 });
    const db = database();
    const demoStudents = await db.prepare("SELECT id FROM students WHERE nis LIKE 'SN-240%' ").all<{ id: number }>();
    const ids = demoStudents.results.map(row => row.id);
    const statements = [] as D1PreparedStatement[];
    for (const table of studentTables) if (ids.length) statements.push(db.prepare(`DELETE FROM ${table} WHERE student_id IN (${ids.map(() => "?").join(",")})`).bind(...ids));
    if (ids.length) statements.push(db.prepare(`DELETE FROM canteen_sale_items WHERE sale_id NOT IN (SELECT id FROM canteen_sales)`));
    statements.push(db.prepare("DELETE FROM students WHERE nis LIKE 'SN-240%'") , db.prepare("DELETE FROM admissions WHERE registration_no IN ('PSB-260001','PSB-260002')"));
    const knownDemo = ["Ranjang Susun","Lemari Santri","Proyektor"];
    statements.push(db.prepare(`DELETE FROM inventory_items WHERE name IN (${knownDemo.map(() => "?").join(",")})`).bind(...knownDemo));
    statements.push(db.prepare("DELETE FROM announcements WHERE title IN ('Jadwal Ujian Tahfidz Semester','Jadwal Kunjungan Wali Santri')"));
    if (statements.length) await db.batch(statements);
    const now = new Date().toISOString();
    await db.prepare("INSERT INTO audit_logs (user_email,action,resource,record_id,detail,created_at) VALUES (?,?,?,?,?,?)").bind(user.email,"Pembersihan demo","database",null,`Menghapus ${ids.length} santri dan data terkait`,now).run();
    return Response.json({ ok: true, removedStudents: ids.length, message: "Data demo berhasil dibersihkan. Akun admin tetap dipertahankan." });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Pembersihan data gagal." }, { status: 500 });
  }
}

import { database, ensureUser } from "../_lib";

export async function GET(request: Request) {
  try {
    const user = await ensureUser(request);
    if (user.role !== "Admin") return Response.json({ error: "Hanya Admin yang dapat melihat presensi pegawai." }, { status: 403 });
    const rows = await database().prepare("SELECT a.*,e.name AS employee_name,e.employee_no,e.position FROM employee_attendance_records a JOIN employees e ON e.id=a.employee_id ORDER BY a.record_date DESC,e.name LIMIT 500").all();
    return Response.json({ rows: rows.results });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Presensi pegawai gagal dimuat." }, { status: 500 }); }
}

export async function POST(request: Request) {
  try {
    const user = await ensureUser(request);
    if (user.role !== "Admin") return Response.json({ error: "Hanya Admin yang dapat mencatat presensi pegawai." }, { status: 403 });
    const body = await request.json() as Record<string, unknown>;
    const employeeId = Number(body.employeeId);
    const date = String(body.recordDate || "").slice(0, 10);
    const status = String(body.status || "Hadir");
    if (!employeeId || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !["Hadir","Terlambat","Izin","Sakit","Alpa"].includes(status)) return Response.json({ error: "Pegawai, tanggal, dan status presensi wajib diisi." }, { status: 400 });
    const now = new Date().toISOString();
    const note = String(body.note || "").trim();
    await database().prepare("INSERT INTO employee_attendance_records (employee_id,record_date,status,note,recorded_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(employee_id,record_date) DO UPDATE SET status=excluded.status,note=excluded.note,recorded_by=excluded.recorded_by,updated_at=excluded.updated_at").bind(employeeId,date,status,note,user.email,now,now).run();
    await database().prepare("INSERT INTO audit_logs (user_email,action,resource,record_id,detail,created_at) VALUES (?,?,?,?,?,?)").bind(user.email,"Simpan","employee_attendance_records",employeeId,`${date} · ${status}`,now).run();
    return Response.json({ ok: true });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Presensi pegawai gagal disimpan." }, { status: 500 }); }
}

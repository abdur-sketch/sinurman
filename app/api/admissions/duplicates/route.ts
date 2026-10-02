import { database, ensureUser, normalizeGuardianPhone } from "../../_lib";

function normalizeName(value: unknown) {
  return String(value ?? "").trim().toLocaleLowerCase("id-ID").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

type AdmissionRow = { id:number; registration_no:string; name:string; guardian_name:string; guardian_phone:string; nisn:string; desired_level:string; created_at:string; status:string };

export async function GET(request: Request) {
  try {
    const user = await ensureUser(request);
    if (user.role !== "Admin") return Response.json({ error: "Audit duplikat hanya dapat dibuka Admin." }, { status: 403 });
    const rows = await database().prepare(
      "SELECT id,registration_no,name,guardian_name,guardian_phone,nisn,desired_level,created_at,status FROM admissions ORDER BY created_at ASC,id ASC",
    ).all<AdmissionRow>();
    const groups = new Map<string, AdmissionRow[]>();
    for (const row of rows.results) {
      const period = String(row.created_at || "").slice(0, 4) || "unknown";
      const phone = normalizeGuardianPhone(row.guardian_phone);
      const identity = row.nisn?.trim() ? `nisn:${row.nisn.trim().toLowerCase()}` : `phone:${phone}|name:${normalizeName(row.name)}`;
      const key = `${period}|${row.desired_level}|${identity}`;
      groups.set(key, [...(groups.get(key) ?? []), row]);
    }
    const duplicates = [...groups.entries()].filter(([, group]) => group.length > 1).map(([groupKey, group]) => {
      const timestamps = group.map((row) => new Date(row.created_at).getTime()).filter(Number.isFinite);
      const spanMs = timestamps.length > 1 ? Math.max(...timestamps) - Math.min(...timestamps) : 0;
      return { groupKey, count: group.length, spanMs, registrations: group.map((row) => ({ id: row.id, registrationNo: row.registration_no, name: row.name, guardianName: row.guardian_name, guardianPhone: row.guardian_phone, nisn: row.nisn, desiredLevel: row.desired_level, status: row.status, createdAt: row.created_at })) };
    });
    return Response.json({ groups: duplicates, totalDuplicateGroups: duplicates.length, totalDuplicateRecords: duplicates.reduce((sum, group) => sum + group.count, 0), generatedAt: new Date().toISOString() });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Audit duplikat gagal dimuat." }, { status: 500 });
  }
}

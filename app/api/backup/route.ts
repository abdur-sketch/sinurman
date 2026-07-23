import { database, ensureUser } from "../_lib";

const tables=["users","students","tahfidz_records","mutabaah_records","health_records","transactions","character_reports","inventory_items","announcements","notification_logs","attendance_records","leave_permits","schedules","rooms","admissions","counseling_records","bills","guardian_messages","guardian_requests","audit_logs"];

export async function GET(request:Request) {
  const user=await ensureUser(request);
  if(user.role!=="Admin") return Response.json({error:"Backup hanya tersedia untuk Admin."},{status:403});
  const db=database();
  const data:Record<string,unknown>={version:1,exportedAt:new Date().toISOString()};
  for(const table of tables) data[table]=(await db.prepare(`SELECT * FROM ${table}`).all()).results;
  await db.prepare("INSERT INTO audit_logs (user_email, action, resource, record_id, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(user.email,"Backup","system",null,"Mengunduh backup lengkap",new Date().toISOString()).run();
  return new Response(JSON.stringify(data,null,2),{headers:{"content-type":"application/json","content-disposition":`attachment; filename="sinurman-backup-${new Date().toISOString().slice(0,10)}.json"`}});
}

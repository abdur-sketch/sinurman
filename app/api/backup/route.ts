import { env } from "cloudflare:workers";
import { database, ensureUser } from "../_lib";

const tables=["users","students","employees","school_classes","student_promotions","tahfidz_records","mutabaah_records","health_records","transactions","character_reports","inventory_items","announcements","notification_logs","attendance_records","academic_subjects","academic_grades","leave_permits","schedules","rooms","admissions","admission_documents","counseling_records","bills","guardian_messages","guardian_requests","guardian_accounts","wallet_accounts","wallet_entries","wallet_topups","wallet_topup_settlements","canteen_products","canteen_sales","canteen_sale_items","audit_logs"];

async function backupPayload() {
  const db=database();
  const data:Record<string,unknown>={version:2,exportedAt:new Date().toISOString(),application:"SINURMAN"};
  for(const table of tables) data[table]=(await db.prepare(`SELECT * FROM ${table}`).all()).results;
  return JSON.stringify(data,null,2);
}

async function requireAdmin(request:Request) {
  const user=await ensureUser(request);
  if(user.role!=="Admin") throw new Error("Backup hanya tersedia untuk Admin.");
  return user;
}

export async function GET(request:Request) {
  try {
    const user=await requireAdmin(request);
    const payload=await backupPayload();
    const now=new Date().toISOString();
    await database().prepare("INSERT INTO audit_logs (user_email, action, resource, record_id, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(user.email,"Backup","system",null,"Mengunduh backup lengkap",now).run();
    return new Response(payload,{headers:{"content-type":"application/json","content-disposition":`attachment; filename="sinurman-backup-${now.slice(0,10)}.json"`,"cache-control":"no-store"}});
  } catch(error) {
    const message=error instanceof Error?error.message:"Backup gagal dibuat.";
    return Response.json({error:message},{status:message.includes("Admin")?403:500});
  }
}

export async function POST(request:Request) {
  try {
    const user=await requireAdmin(request);
    const payload=await backupPayload();
    const now=new Date().toISOString();
    const objectKey=`backups/sinurman-${now.replace(/[:.]/g,"-")}.json`;
    await env.FILES.put(objectKey,payload,{
      httpMetadata:{contentType:"application/json"},
      customMetadata:{createdBy:user.email,createdAt:now,retention:"operational-backup"},
    });
    await database().prepare("INSERT INTO audit_logs (user_email, action, resource, record_id, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(user.email,"Backup Server","system",null,`Backup tersimpan: ${objectKey}`,now).run();
    return Response.json({ok:true,objectKey,createdAt:now,sizeBytes:new TextEncoder().encode(payload).byteLength,message:"Backup server berhasil dibuat dan disimpan aman."});
  } catch(error) {
    const message=error instanceof Error?error.message:"Backup server gagal dibuat.";
    return Response.json({error:message},{status:message.includes("Admin")?403:500});
  }
}

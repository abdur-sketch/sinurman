import { env } from "cloudflare:workers";
import { database } from "../app/api/_lib";

export const backupTables=["users","students","employees","school_classes","student_promotions","tahfidz_records","mutabaah_records","health_records","transactions","character_reports","inventory_items","announcements","notification_logs","attendance_records","academic_subjects","academic_grades","leave_permits","schedules","rooms","admissions","admission_documents","counseling_records","bills","guardian_messages","guardian_requests","guardian_accounts","wallet_accounts","wallet_entries","wallet_topups","wallet_topup_settlements","canteen_products","canteen_sales","canteen_sale_items","audit_logs"];
const markerKey="backups/.automatic-backup.json";
const automaticInterval=20*60*60*1000;
const retentionDays=90;

async function sha256(payload:string) {
  const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,"0")).join("");
}

export async function createBackupPayload() {
  const db=database();
  const data:Record<string,unknown>={version:3,exportedAt:new Date().toISOString(),application:"SINURMAN"};
  for(const table of backupTables) data[table]=(await db.prepare(`SELECT * FROM ${table}`).all()).results;
  return JSON.stringify(data,null,2);
}

async function pruneExpiredBackups() {
  const files=env.FILES as R2Bucket;
  const listed=await files.list({prefix:"backups/",limit:1000});
  const threshold=Date.now()-retentionDays*86400000;
  const expired=listed.objects.filter(object=>object.key!==markerKey&&object.uploaded&&object.uploaded.getTime()<threshold);
  await Promise.all(expired.map(object=>files.delete(object.key)));
  return expired.length;
}

export async function createStoredBackup(createdBy:string,automatic=false) {
  const payload=await createBackupPayload();
  const checksum=await sha256(payload);
  const now=new Date().toISOString();
  const objectKey=`backups/${automatic?"automatic":"manual"}/sinurman-${now.replace(/[:.]/g,"-")}.json`;
  await env.FILES.put(objectKey,payload,{httpMetadata:{contentType:"application/json"},customMetadata:{createdBy,createdAt:now,retention:`${retentionDays}-days`,automatic:String(automatic),sha256:checksum}});
  await env.FILES.put(`${objectKey}.manifest.json`,JSON.stringify({application:"SINURMAN",objectKey,createdAt:now,sha256:checksum,sizeBytes:new TextEncoder().encode(payload).byteLength}),{httpMetadata:{contentType:"application/json"},customMetadata:{createdAt:now}});
  await env.FILES.put(markerKey,JSON.stringify({lastRunAt:now,objectKey,sha256:checksum}),{httpMetadata:{contentType:"application/json"},customMetadata:{createdAt:now}});
  const pruned=await pruneExpiredBackups();
  await database().prepare("INSERT INTO audit_logs (user_email, action, resource, record_id, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(createdBy,automatic?"Backup Otomatis":"Backup Server","system",null,`Backup tersimpan: ${objectKey}; ${pruned} arsip kedaluwarsa dibersihkan`,now).run();
  return {objectKey,createdAt:now,sizeBytes:new TextEncoder().encode(payload).byteLength,checksum,pruned};
}

export async function automaticBackupDue() {
  const marker=await env.FILES.get(markerKey);
  if(!marker)return true;
  try {
    const text=await new Response(marker.body).text();
    const value=JSON.parse(text) as {lastRunAt?:string};
    return !value.lastRunAt||Date.now()-new Date(value.lastRunAt).getTime()>=automaticInterval;
  } catch { return true; }
}

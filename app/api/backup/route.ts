import { database, ensureUser } from "../_lib";
import { reportServerError } from "../../../lib/observability";
import { automaticBackupDue, backupTables as tables, createBackupPayload, createStoredBackup } from "../../../lib/backup-service";

async function requireAdmin(request:Request) {
  const user=await ensureUser(request);
  if(user.role!=="Admin") throw new Error("Backup hanya tersedia untuk Admin.");
  return user;
}

export async function GET(request:Request) {
  try {
    const user=await requireAdmin(request);
    const payload=await createBackupPayload();
    const now=new Date().toISOString();
    await database().prepare("INSERT INTO audit_logs (user_email, action, resource, record_id, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(user.email,"Backup","system",null,"Mengunduh backup lengkap",now).run();
    return new Response(payload,{headers:{"content-type":"application/json","content-disposition":`attachment; filename="sinurman-backup-${now.slice(0,10)}.json"`,"cache-control":"no-store"}});
  } catch(error) {
    const requestId=reportServerError("backup.download",error,request);
    const message=error instanceof Error?error.message:"Backup gagal dibuat.";
    return Response.json({error:message,requestId},{status:message.includes("Admin")||message.includes("MFA_REQUIRED")?403:500});
  }
}

export async function POST(request:Request) {
  try {
    const user=await requireAdmin(request);
    const body=await request.json().catch(()=>({})) as {action?:string};
    const automatic=body.action==="automatic";
    if(automatic&&!(await automaticBackupDue())) return Response.json({ok:true,skipped:true,message:"Backup otomatis hari ini sudah tersedia."});
    const result=await createStoredBackup(user.email,automatic);
    return Response.json({ok:true,...result,message:automatic?"Backup otomatis berhasil dibuat.":"Backup server berhasil dibuat dan disimpan aman."});
  } catch(error) {
    const requestId=reportServerError("backup.store",error,request);
    const message=error instanceof Error?error.message:"Backup server gagal dibuat.";
    return Response.json({error:message,requestId},{status:message.includes("Admin")||message.includes("MFA_REQUIRED")?403:500});
  }
}

export async function PUT(request:Request) {
  try {
    const user=await requireAdmin(request);
    const body=await request.json() as {confirm?:string;backup?:Record<string,unknown>};
    const backup=body.backup;
    if(!backup||backup.application!=="SINURMAN"||Number(backup.version)<2) return Response.json({error:"Berkas backup SINURMAN tidak valid."},{status:400});
    const missing=tables.filter(table=>!Array.isArray(backup[table]));
    if(missing.length) return Response.json({error:`Backup tidak lengkap. Data tabel hilang: ${missing.join(", ")}.`},{status:400});
    const counts=Object.fromEntries(tables.map(table=>[table,Array.isArray(backup[table])?(backup[table] as unknown[]).length:0]));
    const db=database();
    const restorePlan:Array<{table:string;statements:ReturnType<typeof db.prepare>[]}>=[];
    for(const table of tables) {
      const rows=backup[table] as Record<string,unknown>[];
      const schema=await db.prepare(`PRAGMA table_info(${table})`).all<{name:string}>();
      const allowed=new Set(schema.results.map(column=>column.name));
      const statements=rows.map(row=>{
        if(!row||typeof row!=="object"||Array.isArray(row)) throw new Error(`Isi tabel ${table} pada backup tidak valid.`);
        const columns=Object.keys(row).filter(column=>allowed.has(column)&&/^[A-Za-z_]\w*$/.test(column));
        if(!columns.length) throw new Error(`Kolom tabel ${table} pada backup tidak dikenali.`);
        const placeholders=columns.map(()=>"?").join(",");
        return db.prepare(`INSERT INTO ${table} (${columns.join(",")}) VALUES (${placeholders})`).bind(...columns.map(column=>row[column]));
      });
      restorePlan.push({table,statements});
    }
    if(body.confirm!=="PULIHKAN") return Response.json({ok:true,dryRun:true,counts,message:"Backup valid. Kirim konfirmasi PULIHKAN untuk menjalankan pemulihan."});
    for(const table of [...tables].reverse()) await db.prepare(`DELETE FROM ${table}`).run();
    for(const {statements} of restorePlan) {
      for(let start=0;start<statements.length;start+=300) await db.batch(statements.slice(start,start+300));
    }
    const now=new Date().toISOString();
    await db.prepare("INSERT INTO audit_logs (user_email, action, resource, record_id, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(user.email,"Pemulihan Backup","system",null,`Pemulihan backup ${String(backup.exportedAt||"")}`,now).run();
    return Response.json({ok:true,restoredAt:now,counts,message:"Data berhasil dipulihkan dari backup."});
  } catch(error) {
    const requestId=reportServerError("backup.restore",error,request);
    const message=error instanceof Error?error.message:"Pemulihan backup gagal.";
    return Response.json({error:message,requestId},{status:message.includes("Admin")||message.includes("MFA_REQUIRED")?403:500});
  }
}

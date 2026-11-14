import { env } from "cloudflare:workers";
import { database } from "../_lib";
import { reportServerError } from "../../../lib/observability";

const HEALTH_TIMEOUT_MS = 3_000;
const BACKUP_SLA_HOURS = 26;

async function withTimeout<T>(promise: Promise<T>, label: string) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timeout`)), HEALTH_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function GET(request:Request) {
  const started=Date.now();
  try {
    // Health checks must not run the full idempotent schema bootstrap. That
    // path performs dozens of DDL statements and can take several seconds on
    // a cold App Hosting instance. A lightweight table read still fails closed
    // when the operational schema is unavailable.
    const [databaseCheck,storageCheck]=await Promise.all([
      withTimeout(database().prepare("SELECT COUNT(*) AS total FROM users").first<{total:number}>(), "database"),
      withTimeout(Promise.resolve(env.FILES.get("backups/.automatic-backup.json")), "storage"),
    ]);
    let backupAgeHours:number|null=null;
    if(storageCheck)try{const marker=JSON.parse(await new Response(storageCheck.body).text()) as {lastRunAt?:string};if(marker.lastRunAt)backupAgeHours=Math.round((Date.now()-new Date(marker.lastRunAt).getTime())/36_000)/100;}catch{/* marker is reported as stale */}
    const backupStatus=backupAgeHours===null?"missing":backupAgeHours<=BACKUP_SLA_HOURS?"ready":"stale";
    const backupWarning=backupStatus==="ready"?null:backupStatus==="missing"?"Backup otomatis belum tersedia.":`Backup otomatis melewati SLA ${BACKUP_SLA_HOURS} jam.`;
    return Response.json({ok:true,service:"SINURMAN",database:"ready",storage:"ready",users:Number(databaseCheck?.total||0),automaticBackup:Boolean(storageCheck),backupStatus,backupAgeHours,backupWarning,runtime:process.env.FIREBASE_RUNTIME==="true"?"firebase":"sites",latencyMs:Date.now()-started,checkedAt:new Date().toISOString()},{headers:{"cache-control":"no-store"}});
  } catch(error) {
    const requestId=reportServerError("health.check",error,request);
    return Response.json({ok:false,service:"SINURMAN",error:"Pemeriksaan layanan gagal.",requestId,checkedAt:new Date().toISOString()},{status:503,headers:{"cache-control":"no-store"}});
  }
}

import { env } from "cloudflare:workers";
import { database, ensureDatabaseSchema } from "../_lib";
import { reportServerError } from "../../../lib/observability";

export async function GET(request:Request) {
  const started=Date.now();
  try {
    await ensureDatabaseSchema();
    const databaseCheck=await database().prepare("SELECT COUNT(*) AS total FROM users").first<{total:number}>();
    const storageCheck=await env.FILES.get("backups/.automatic-backup.json");
    let backupAgeHours:number|null=null;
    if(storageCheck)try{const marker=JSON.parse(await new Response(storageCheck.body).text()) as {lastRunAt?:string};if(marker.lastRunAt)backupAgeHours=Math.round((Date.now()-new Date(marker.lastRunAt).getTime())/36_000)/100;}catch{/* marker is reported as stale */}
    const backupStatus=backupAgeHours===null?"missing":backupAgeHours<=26?"ready":"stale";
    return Response.json({ok:true,service:"SINURMAN",database:"ready",storage:"ready",users:Number(databaseCheck?.total||0),automaticBackup:Boolean(storageCheck),backupStatus,backupAgeHours,runtime:process.env.FIREBASE_RUNTIME==="true"?"firebase":"sites",latencyMs:Date.now()-started,checkedAt:new Date().toISOString()},{headers:{"cache-control":"public, max-age=30"}});
  } catch(error) {
    const requestId=reportServerError("health.check",error,request);
    return Response.json({ok:false,service:"SINURMAN",error:"Pemeriksaan layanan gagal.",requestId,checkedAt:new Date().toISOString()},{status:503,headers:{"cache-control":"no-store"}});
  }
}

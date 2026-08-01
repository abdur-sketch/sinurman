import { env } from "cloudflare:workers";
import { database, ensureDatabaseSchema } from "../_lib";

export async function GET() {
  const started=Date.now();
  try {
    await ensureDatabaseSchema();
    const databaseCheck=await database().prepare("SELECT COUNT(*) AS total FROM users").first<{total:number}>();
    const storageCheck=await env.FILES.get("backups/.automatic-backup.json");
    return Response.json({ok:true,service:"SINURMAN",database:"ready",storage:"ready",users:Number(databaseCheck?.total||0),automaticBackup:Boolean(storageCheck),runtime:process.env.FIREBASE_RUNTIME==="true"?"firebase":"sites",latencyMs:Date.now()-started,checkedAt:new Date().toISOString()},{headers:{"cache-control":"public, max-age=30"}});
  } catch(error) {
    return Response.json({ok:false,service:"SINURMAN",error:error instanceof Error?error.message:"Health check gagal.",checkedAt:new Date().toISOString()},{status:503,headers:{"cache-control":"no-store"}});
  }
}

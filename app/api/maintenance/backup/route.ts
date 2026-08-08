import { automaticBackupDue, createStoredBackup } from "../../backup/route";

export const runtime="nodejs";

function authorized(request:Request) {
  const configured=String(process.env.CRON_SECRET??"");
  const supplied=String(request.headers.get("authorization")??"").replace(/^Bearer\s+/i,"");
  if(!configured||!supplied||configured.length!==supplied.length)return false;
  let difference=0;
  for(let index=0;index<configured.length;index++)difference|=configured.charCodeAt(index)^supplied.charCodeAt(index);
  return difference===0;
}

export async function POST(request:Request) {
  if(!process.env.CRON_SECRET)return Response.json({error:"Scheduler belum dikonfigurasi."},{status:503});
  if(!authorized(request))return Response.json({error:"Akses scheduler ditolak."},{status:401});
  try {
    if(!(await automaticBackupDue()))return Response.json({ok:true,skipped:true,message:"Backup otomatis terbaru masih berlaku."});
    const result=await createStoredBackup("scheduler@sinurman.system",true);
    return Response.json({ok:true,...result,message:"Backup otomatis terjadwal berhasil dibuat."});
  } catch(error) {
    return Response.json({error:error instanceof Error?error.message:"Backup otomatis gagal."},{status:500});
  }
}

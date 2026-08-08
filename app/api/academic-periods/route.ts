import { database, ensureUser } from "../_lib";

const governedTables=["tahfidz_records","mutabaah_records","health_records","character_reports","attendance_records","academic_grades"] as const;

async function requireAdmin(request:Request) {
  const user=await ensureUser(request);
  if(user.role!=="Admin") throw new Error("Hanya Admin yang dapat mengatur periode akademik.");
  return user;
}

async function draftCount(periodKey:string) {
  const counts=await Promise.all(governedTables.map(table=>database().prepare(
    `SELECT COUNT(*) AS total FROM ${table} WHERE period_key=? AND workflow_status<>'Dipublikasikan'`,
  ).bind(periodKey).first<{total:number}>()));
  return counts.reduce((total,row)=>total+Number(row?.total??0),0);
}

export async function GET(request:Request) {
  try {
    await requireAdmin(request);
    const periods=await database().prepare("SELECT * FROM academic_periods ORDER BY academic_year DESC,semester").all<Record<string,unknown>>();
    const results=await Promise.all(periods.results.map(async period=>({...period,pending_records:await draftCount(String(period.period_key))})));
    return Response.json({periods:results});
  } catch(error) {
    const message=error instanceof Error?error.message:"Periode gagal dimuat.";
    return Response.json({error:message},{status:message.includes("Hanya Admin")?403:500});
  }
}

export async function POST(request:Request) {
  try {
    const user=await requireAdmin(request);
    const body=await request.json() as {academicYear?:string;semester?:string;status?:string;force?:boolean};
    const academicYear=String(body.academicYear??"").trim();
    const semester=String(body.semester??"").trim();
    const status=String(body.status??"Terbuka");
    if(!/^\d{4}\/\d{4}$/.test(academicYear)) throw new Error("Tahun ajaran harus menggunakan format 2026/2027.");
    if(!["Ganjil","Genap"].includes(semester)) throw new Error("Semester tidak valid.");
    if(!["Terbuka","Dikunci"].includes(status)) throw new Error("Status periode tidak valid.");
    const periodKey=`${academicYear}|${semester}`;
    const pending=await draftCount(periodKey);
    if(status==="Dikunci"&&pending>0&&!body.force) {
      return Response.json({error:`Masih ada ${pending} catatan Draft/Diverifikasi. Publikasikan atau gunakan konfirmasi paksa.`,pendingRecords:pending},{status:409});
    }
    const now=new Date().toISOString();
    await database().prepare(
      `INSERT INTO academic_periods (period_key,academic_year,semester,status,locked_by,locked_at,created_at,updated_at)
       VALUES (?,?,?,?,?,?,?,?)
       ON CONFLICT(period_key) DO UPDATE SET status=excluded.status,locked_by=excluded.locked_by,locked_at=excluded.locked_at,updated_at=excluded.updated_at`,
    ).bind(periodKey,academicYear,semester,status,status==="Dikunci"?user.email:"",status==="Dikunci"?now:"",now,now).run();
    await database().prepare("INSERT INTO audit_logs (user_email,action,resource,record_id,detail,created_at) VALUES (?,?,?,NULL,?,?)")
      .bind(user.email,status==="Dikunci"?"Kunci Periode":"Buka Periode","academic-periods",`${periodKey}; ${pending} catatan belum dipublikasikan`,now).run();
    return Response.json({ok:true,periodKey,status,pendingRecords:pending,message:`Periode ${periodKey} berhasil ${status==="Dikunci"?"dikunci":"dibuka"}.`});
  } catch(error) {
    const message=error instanceof Error?error.message:"Periode gagal diperbarui.";
    return Response.json({error:message},{status:message.includes("Hanya Admin")?403:400});
  }
}

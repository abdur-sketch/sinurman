import { database, ensureUser } from "../_lib";
import { notifyGuardian } from "../_notifications";

async function ownsStudent(email:string,studentId:number) {
  return Boolean(await database().prepare("SELECT id FROM students WHERE id=? AND lower(guardian_email)=lower(?)").bind(studentId,email).first());
}

export async function POST(request:Request) {
  const user=await ensureUser(request);
  if(user.role!=="Wali Santri"&&user.role!=="Admin") return Response.json({error:"Permintaan hanya dapat diajukan wali santri."},{status:403});
  const payload=await request.json() as {studentId?:number;type?:string;visitDate?:string;startTime?:string;endTime?:string;purpose?:string;visitorName?:string;visitorPhone?:string};
  const studentId=Number(payload.studentId);
  if(!studentId||user.role==="Wali Santri"&&!(await ownsStudent(user.email,studentId))) return Response.json({error:"Santri tidak terhubung dengan akun ini."},{status:403});
  if(!["Kunjungan","Penjemputan"].includes(String(payload.type))||!payload.visitDate||!payload.startTime||!payload.endTime||!payload.purpose?.trim()||!payload.visitorName?.trim()||!payload.visitorPhone?.trim()) return Response.json({error:"Seluruh data kunjungan atau penjemputan wajib diisi."},{status:400});
  if(payload.endTime<=payload.startTime) return Response.json({error:"Jam selesai harus setelah jam mulai."},{status:400});
  const token=crypto.randomUUID().replaceAll("-","").toUpperCase();
  const now=new Date().toISOString();
  const result=await database().prepare("INSERT INTO guardian_requests (student_id,requester_email,type,visit_date,start_time,end_time,purpose,visitor_name,visitor_phone,status,qr_token,used_at,approved_by,created_at) VALUES (?,?,?,?,?,?,?,?,?,'Diajukan',?,'','',?)")
    .bind(studentId,user.email,payload.type,payload.visitDate,payload.startTime,payload.endTime,payload.purpose.trim(),payload.visitorName.trim(),payload.visitorPhone.trim(),token,now).run();
  return Response.json({ok:true,id:result.meta.last_row_id},{status:201});
}

export async function PATCH(request:Request) {
  const user=await ensureUser(request);
  if(user.role==="Wali Santri") return Response.json({error:"Validasi hanya dapat dilakukan pengurus."},{status:403});
  const payload=await request.json() as {id?:number;token?:string;action?:string};
  const row=payload.id
    ? await database().prepare("SELECT * FROM guardian_requests WHERE id=?").bind(payload.id).first<Record<string,unknown>>()
    : await database().prepare("SELECT * FROM guardian_requests WHERE qr_token=?").bind(String(payload.token||"").replace(/^SINURMAN:REQUEST:/,"").trim().toUpperCase()).first<Record<string,unknown>>();
  if(!row) return Response.json({error:"Permintaan atau token QR tidak ditemukan."},{status:404});
  if(payload.action==="approve"||payload.action==="reject") {
    if(row.status!=="Diajukan") return Response.json({error:"Permintaan sudah diproses."},{status:409});
    const status=payload.action==="approve"?"Disetujui":"Ditolak";
    await database().prepare("UPDATE guardian_requests SET status=?,approved_by=? WHERE id=?").bind(status,user.name,row.id).run();
    try{await notifyGuardian(Number(row.student_id),`SINURMAN: Permintaan ${row.type} tanggal ${row.visit_date} telah ${status.toLowerCase()}.${status==="Disetujui"?" QR akses tersedia di Portal Wali.":""}`);}catch{/* request update remains valid */}
    return Response.json({ok:true,status});
  }
  if(payload.action==="use") {
    if(row.status!=="Disetujui") return Response.json({error:row.status==="Digunakan"?"QR sudah pernah digunakan.":"QR belum disetujui."},{status:409});
    const now=new Date().toISOString();
    await database().prepare("UPDATE guardian_requests SET status='Digunakan',used_at=? WHERE id=?").bind(now,row.id).run();
    return Response.json({ok:true,status:"Digunakan",usedAt:now,request:row});
  }
  return Response.json({error:"Tindakan tidak valid."},{status:400});
}

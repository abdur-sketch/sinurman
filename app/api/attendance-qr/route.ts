import { canWrite, database, ensureUser } from "../_lib";
import { notifyRecordChange } from "../_notifications";

export async function POST(request:Request) {
  try {
    const user=await ensureUser(request);
    if(!canWrite(user.role,"attendance")) return Response.json({error:"Peran Anda tidak dapat mencatat presensi."},{status:403});
    const body=await request.json() as {token?:string;status?:string};
    let payload:{app?:string;id?:number;nis?:string;walletToken?:string};
    try { payload=JSON.parse(String(body.token||"")); }
    catch { return Response.json({error:"QR tidak valid. Gunakan QR pada kartu santri SINURMAN."},{status:400}); }
    if(payload.app!=="SINURMAN"||!payload.id||!payload.nis||!payload.walletToken) return Response.json({error:"QR bukan kartu santri SINURMAN atau kartu belum memiliki token keamanan."},{status:400});
    const db=database();
    const student=await db.prepare("SELECT id,name,nis,room FROM students WHERE id=? AND nis=?").bind(payload.id,payload.nis).first<{id:number;name:string;nis:string;room:string}>();
    if(!student) return Response.json({error:"Data santri pada QR tidak ditemukan."},{status:404});
    const wallet=await db.prepare("SELECT card_token,status FROM wallet_accounts WHERE student_id=?").bind(student.id).first<{card_token:string;status:string}>();
    if(!wallet||wallet.card_token!==String(payload.walletToken)) return Response.json({error:"Token kartu tidak cocok. Cetak ulang kartu santri."},{status:403});
    if(wallet.status!=="Aktif") return Response.json({error:"Kartu santri tidak aktif."},{status:403});
    if(["Musyrif","Kepala Asrama"].includes(user.role)&&student.room!==(user.roomScope||"__BELUM_DITUGASKAN__")) return Response.json({error:"Santri berada di luar penugasan kamar Anda."},{status:403});
    const status=String(body.status||"Hadir");
    if(!["Hadir","Terlambat","Sakit","Izin","Alpa"].includes(status)) return Response.json({error:"Status presensi tidak valid."},{status:400});
    const today=new Date().toISOString().slice(0,10);
    const existing=await db.prepare("SELECT id FROM attendance_records WHERE student_id=? AND record_date=?").bind(student.id,today).first<{id:number}>();
    const scanTime=new Date().toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit",second:"2-digit",timeZone:"Asia/Jakarta"});
    const note=`Presensi QR · ${scanTime} WIB`;
    if(existing) await db.prepare("UPDATE attendance_records SET status=?,note=?,recorded_by=? WHERE id=?").bind(status,note,user.name,existing.id).run();
    else await db.prepare("INSERT INTO attendance_records (student_id,record_date,status,note,recorded_by) VALUES (?,?,?,?,?)").bind(student.id,today,status,note,user.name).run();
    const row={student_id:student.id,record_date:today,status,note};
    if(status!=="Hadir") try { await notifyRecordChange("attendance",row); } catch { /* logging must not block attendance */ }
    await db.prepare("INSERT INTO audit_logs (user_email,action,resource,record_id,detail,created_at) VALUES (?,?,?,?,?,?)").bind(user.email,existing?"Ubah":"Tambah","attendance",existing?.id??null,`Presensi QR ${student.name}: ${status}`,new Date().toISOString()).run();
    return Response.json({ok:true,student,status,updated:Boolean(existing)});
  } catch(error) {
    return Response.json({error:error instanceof Error?error.message:"Presensi QR gagal."},{status:500});
  }
}

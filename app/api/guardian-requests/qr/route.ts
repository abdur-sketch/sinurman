import QRCode from "qrcode";
import { database, ensureUser } from "../../_lib";

export async function GET(request:Request) {
  const user=await ensureUser(request);
  const id=Number(new URL(request.url).searchParams.get("id"));
  const row=await database().prepare("SELECT g.*,s.name,s.nis,s.guardian_email FROM guardian_requests g JOIN students s ON s.id=g.student_id WHERE g.id=?").bind(id).first<Record<string,unknown>>();
  if(!row) return Response.json({error:"Permintaan tidak ditemukan."},{status:404});
  if(user.role==="Wali Santri"&&String(row.guardian_email).toLocaleLowerCase("id-ID")!==user.email.toLocaleLowerCase("id-ID")) return Response.json({error:"Permintaan tidak terhubung dengan akun ini."},{status:403});
  if(row.status!=="Disetujui") return Response.json({error:"QR tersedia setelah permintaan disetujui."},{status:409});
  const value=`SINURMAN:REQUEST:${row.qr_token}`;
  const qr=await QRCode.toDataURL(value,{width:380,margin:1,color:{dark:"#183153",light:"#ffffff"}});
  return Response.json({qr,token:row.qr_token,request:row});
}

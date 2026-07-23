import QRCode from "qrcode";
import { database, ensureUser } from "../_lib";

export async function GET(request:Request) {
  await ensureUser(request);
  const id=Number(new URL(request.url).searchParams.get("id"));
  if(!id) return Response.json({error:"ID santri wajib diisi."},{status:400});
  const student=await database().prepare("SELECT id,name,nis,class_name,room,status FROM students WHERE id=?").bind(id).first<Record<string,unknown>>();
  if(!student) return Response.json({error:"Santri tidak ditemukan."},{status:404});
  const qr=await QRCode.toDataURL(JSON.stringify({app:"SINURMAN",id:student.id,nis:student.nis}),{width:320,margin:1,color:{dark:"#183153",light:"#ffffff"}});
  return Response.json({student,qr});
}

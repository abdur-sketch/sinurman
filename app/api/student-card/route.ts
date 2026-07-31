import QRCode from "qrcode";
import { database, ensureUser, guardianOwnsStudent } from "../_lib";

export async function GET(request:Request) {
  const user=await ensureUser(request);
  const url=new URL(request.url);
  if(url.searchParams.get("bulk")==="1") {
    if(user.role!=="Admin") return Response.json({error:"Cetak kartu massal hanya tersedia untuk Admin."},{status:403});
    const className=String(url.searchParams.get("class")||"");
    const result=className
      ? await database().prepare("SELECT id,name,nis,class_name,room,status FROM students WHERE status='Aktif' AND class_name=? ORDER BY name").bind(className).all<Record<string,unknown>>()
      : await database().prepare("SELECT id,name,nis,class_name,room,status FROM students WHERE status='Aktif' ORDER BY class_name,name").all<Record<string,unknown>>();
    const cards=await Promise.all(result.results.slice(0,250).map(async student=>{
      const db=database();
      let wallet=await db.prepare("SELECT card_token,status FROM wallet_accounts WHERE student_id=?").bind(student.id).first<{card_token:string;status:string}>();
      if(!wallet) {
        const token=`SNP-${crypto.randomUUID().replaceAll("-","").slice(0,20).toUpperCase()}`;
        const now=new Date().toISOString();
        await db.prepare("INSERT INTO wallet_accounts (student_id,card_token,balance,daily_limit,status,updated_at) VALUES (?,?,0,50000,'Aktif',?)").bind(student.id,token,now).run();
        wallet={card_token:token,status:"Aktif"};
      }
      const qr=await QRCode.toDataURL(JSON.stringify({app:"SINURMAN",id:student.id,nis:student.nis,walletToken:wallet.card_token}),{width:240,margin:1,color:{dark:"#183153",light:"#ffffff"}});
      return {student,qr,wallet:{status:wallet.status}};
    }));
    return Response.json({cards,className,total:cards.length});
  }
  const id=Number(url.searchParams.get("id"));
  if(!id) return Response.json({error:"ID santri wajib diisi."},{status:400});
  const student=await database().prepare("SELECT id,name,nis,class_name,room,status FROM students WHERE id=?").bind(id).first<Record<string,unknown>>();
  if(!student) return Response.json({error:"Santri tidak ditemukan."},{status:404});
  if(user.role==="Wali Santri") {
    if(!(await guardianOwnsStudent(user,id))) return Response.json({error:"Santri tidak terhubung dengan akun ini."},{status:403});
  }
  const db=database();
  let wallet=await db.prepare("SELECT card_token,status FROM wallet_accounts WHERE student_id=?").bind(id).first<{card_token:string;status:string}>();
  if(!wallet) {
    const token=`SNP-${crypto.randomUUID().replaceAll("-","").slice(0,20).toUpperCase()}`;
    const now=new Date().toISOString();
    await db.prepare("INSERT INTO wallet_accounts (student_id,card_token,balance,daily_limit,status,updated_at) VALUES (?,?,0,50000,'Aktif',?)").bind(id,token,now).run();
    wallet={card_token:token,status:"Aktif"};
  }
  const qr=await QRCode.toDataURL(JSON.stringify({app:"SINURMAN",id:student.id,nis:student.nis,walletToken:wallet.card_token}),{width:320,margin:1,color:{dark:"#183153",light:"#ffffff"}});
  return Response.json({student,qr,wallet:{status:wallet.status}});
}

import QRCode from "qrcode";
import { database, ensureUser, guardianOwnsStudent } from "../_lib";

export async function GET(request:Request) {
  const user=await ensureUser(request);
  const id=Number(new URL(request.url).searchParams.get("id"));
  if(!id) return Response.json({error:"Tagihan wajib dipilih."},{status:400});
  const bill=await database().prepare("SELECT b.*,s.guardian_email,s.guardian_phone FROM bills b JOIN students s ON s.id=b.student_id WHERE b.id=?").bind(id).first<Record<string,unknown>>();
  if(!bill) return Response.json({error:"Tagihan tidak ditemukan."},{status:404});
  if(user.role==="Wali Santri"&&!(await guardianOwnsStudent(user,Number(bill.student_id)))) return Response.json({error:"Tagihan tidak terhubung dengan akun ini."},{status:403});
  if(!bill.payment_url) return Response.json({error:"Link pembayaran belum dibuat.",needsLink:true},{status:409});
  const qr=await QRCode.toDataURL(String(bill.payment_url),{width:360,margin:1,color:{dark:"#183153",light:"#ffffff"}});
  return Response.json({qr,paymentUrl:bill.payment_url,invoiceNo:bill.invoice_no,amount:bill.amount,status:bill.status});
}

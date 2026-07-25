import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { database, ensureUser, guardianOwnsStudent } from "../_lib";

export async function GET(request:Request) {
  const user=await ensureUser(request);
  const id=Number(new URL(request.url).searchParams.get("id"));
  const bill=await database().prepare("SELECT b.*,s.name,s.nis,s.guardian_email,s.guardian_phone FROM bills b JOIN students s ON s.id=b.student_id WHERE b.id=?").bind(id).first<Record<string,unknown>>();
  if(!bill) return Response.json({error:"Tagihan tidak ditemukan."},{status:404});
  if(user.role==="Wali Santri"&&!(await guardianOwnsStudent(user,Number(bill.student_id)))) return Response.json({error:"Kuitansi tidak terhubung dengan akun ini."},{status:403});
  if(bill.status!=="Lunas") return Response.json({error:"Kuitansi tersedia setelah pembayaran lunas."},{status:409});
  const pdf=await PDFDocument.create();
  const page=pdf.addPage([595,420]);
  const regular=await pdf.embedFont(StandardFonts.Helvetica);
  const bold=await pdf.embedFont(StandardFonts.HelveticaBold);
  page.drawRectangle({x:0,y:340,width:595,height:80,color:rgb(.09,.19,.33)});
  page.drawText("SINURMAN",{x:36,y:382,size:22,font:bold,color:rgb(1,1,1)});
  page.drawText("Pondok Pesantren Nurul Iman",{x:36,y:362,size:10,font:regular,color:rgb(.8,.88,.96)});
  page.drawText("KUITANSI PEMBAYARAN",{x:350,y:375,size:13,font:bold,color:rgb(1,1,1)});
  const rows=[
    ["Nomor",String(bill.invoice_no)],["Santri",`${bill.name} (${bill.nis})`],["Pembayaran",String(bill.category)],
    ["Nominal",`Rp ${Number(bill.amount).toLocaleString("id-ID")}`],["Metode",String(bill.payment_method||"Pembayaran digital")],
    ["Referensi",String(bill.payment_reference||"-")],["Tanggal lunas",String(bill.paid_at||"-")],
  ];
  let y=305;
  for(const [label,value] of rows){page.drawText(label,{x:42,y,size:10,font:regular,color:rgb(.42,.48,.56)});page.drawText(value,{x:170,y,size:10,font:bold,color:rgb(.09,.19,.33)});y-=34;}
  page.drawText("Pembayaran sah dan tercatat pada sistem SINURMAN.",{x:42,y:38,size:9,font:regular,color:rgb(.18,.55,.4)});
  const bytes=await pdf.save();
  return new Response(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength) as ArrayBuffer,{headers:{"content-type":"application/pdf","content-disposition":`attachment; filename=\"kuitansi-${bill.invoice_no}.pdf\"`}});
}

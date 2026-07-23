import { database, ensureUser } from "../_lib";
import { sendWhatsappNotification } from "../_notifications";

export async function POST(request:Request) {
  const user=await ensureUser(request);
  if(user.role!=="Admin") return Response.json({error:"Pengingat otomatis hanya dapat dijalankan Admin."},{status:403});
  const today=new Date().toISOString().slice(0,10);
  const bills=await database().prepare(`
    SELECT b.id,b.invoice_no,b.category,b.amount,b.due_date,s.id AS student_id,s.name,s.guardian_phone
    FROM bills b JOIN students s ON s.id=b.student_id
    WHERE b.status!='Lunas' AND b.due_date<=date(?, '+7 day')
    ORDER BY b.due_date LIMIT 50
  `).bind(today).all<Record<string,unknown>>();
  let sent=0;
  for(const bill of bills.results) {
    const marker=`[${bill.invoice_no}]`;
    const existing=await database().prepare("SELECT id FROM notification_logs WHERE message LIKE ? AND substr(sent_at,1,10)=? LIMIT 1")
      .bind(`%${marker}%`,today).first();
    if(existing) continue;
    const message=`SINURMAN ${marker}: Tagihan ${bill.category} untuk ${bill.name} sebesar Rp${Number(bill.amount).toLocaleString("id-ID")} jatuh tempo ${bill.due_date}. Silakan buka Portal Wali untuk pembayaran QRIS.`;
    await sendWhatsappNotification({studentId:Number(bill.student_id),recipient:String(bill.guardian_phone),message});
    sent++;
  }
  return Response.json({ok:true,processed:bills.results.length,sent});
}

import { env } from "cloudflare:workers";
import { database, ensureUser } from "../_lib";

export async function GET(request: Request) {
  const user = await ensureUser(request);
  if (user.role !== "Admin") return Response.json({ error:"Khusus Admin." },{status:403});
  return Response.json({
    midtrans: Boolean(env.MIDTRANS_SERVER_KEY),
    xendit: Boolean(env.XENDIT_API_KEY),
    whatsapp: Boolean(env.WHATSAPP_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID),
  });
}

export async function POST(request: Request) {
  const user = await ensureUser(request);
  if (user.role !== "Admin") return Response.json({ error:"Khusus Admin." },{status:403});
  const payload = await request.json() as { action?:string; billId?:number };
  if (payload.action !== "payment-link" || !payload.billId) {
    return Response.json({ error:"Tindakan integrasi tidak valid." },{status:400});
  }
  if (!env.MIDTRANS_SERVER_KEY) {
    return Response.json({ error:"MIDTRANS_SERVER_KEY belum dikonfigurasi pada hosting." },{status:503});
  }
  const bill = await database().prepare("SELECT b.*, s.name, s.guardian_phone FROM bills b JOIN students s ON s.id=b.student_id WHERE b.id=?").bind(payload.billId).first<Record<string,unknown>>();
  if(!bill) return Response.json({error:"Tagihan tidak ditemukan."},{status:404});
  const host = env.MIDTRANS_IS_PRODUCTION === "true" ? "https://app.midtrans.com" : "https://app.sandbox.midtrans.com";
  const authorization = btoa(`${env.MIDTRANS_SERVER_KEY}:`);
  const response = await fetch(`${host}/snap/v1/transactions`,{
    method:"POST",
    headers:{"content-type":"application/json","authorization":`Basic ${authorization}`},
    body:JSON.stringify({
      transaction_details:{order_id:bill.invoice_no,gross_amount:bill.amount},
      customer_details:{first_name:bill.name,phone:bill.guardian_phone},
      item_details:[{id:String(bill.id),price:bill.amount,quantity:1,name:bill.category}],
    }),
  });
  const result=await response.json() as {redirect_url?:string;error_messages?:string[]};
  if(!response.ok||!result.redirect_url) return Response.json({error:result.error_messages?.join(", ")||"Gateway menolak transaksi."},{status:502});
  await database().prepare("UPDATE bills SET payment_url=? WHERE id=?").bind(result.redirect_url,payload.billId).run();
  return Response.json({paymentUrl:result.redirect_url});
}

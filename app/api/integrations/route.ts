import { env } from "cloudflare:workers";
import QRCode from "qrcode";
import { database, ensureUser, guardianOwnsStudent } from "../_lib";

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
  if (user.role === "Ustadz") return Response.json({ error:"Peran Anda tidak dapat mengakses pembayaran." },{status:403});
  const payload = await request.json() as { action?:string; billId?:number };
  if (payload.action !== "payment-link" || !payload.billId) {
    return Response.json({ error:"Tindakan integrasi tidak valid." },{status:400});
  }
  const bill = await database().prepare("SELECT b.*, s.name, s.guardian_phone FROM bills b JOIN students s ON s.id=b.student_id WHERE b.id=?").bind(payload.billId).first<Record<string,unknown>>();
  if(!bill) return Response.json({error:"Tagihan tidak ditemukan."},{status:404});
  if (user.role === "Wali Santri") {
    if (!(await guardianOwnsStudent(user,Number(bill.student_id)))) return Response.json({ error:"Tagihan tidak terhubung dengan akun ini." },{status:403});
  }
  let paymentUrl="";
  if(env.MIDTRANS_SERVER_KEY) {
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
    if(!response.ok||!result.redirect_url) return Response.json({error:result.error_messages?.join(", ")||"Midtrans menolak transaksi."},{status:502});
    paymentUrl=result.redirect_url;
  } else if(env.XENDIT_API_KEY) {
    const origin=new URL(request.url).origin;
    const response=await fetch("https://api.xendit.co/sessions",{
      method:"POST",
      headers:{"content-type":"application/json","authorization":`Basic ${btoa(`${env.XENDIT_API_KEY}:`)}`},
      body:JSON.stringify({
        reference_id:String(bill.invoice_no),session_type:"PAY",mode:"PAYMENT_LINK",
        amount:Number(bill.amount),currency:"IDR",country:"ID",
        customer:{reference_id:`student-${bill.student_id}`,type:"INDIVIDUAL",mobile_number:`+${String(bill.guardian_phone).replace(/\D/g,"")}`,individual_detail:{given_names:String(bill.name)}},
        description:String(bill.category),success_return_url:origin,cancel_return_url:origin,
      }),
    });
    const result=await response.json() as {payment_link_url?:string;message?:string};
    if(!response.ok||!result.payment_link_url) return Response.json({error:result.message||"Xendit menolak transaksi."},{status:502});
    paymentUrl=result.payment_link_url;
  } else {
    return Response.json({ error:"Kredensial Midtrans atau Xendit belum dikonfigurasi pada hosting." },{status:503});
  }
  await database().prepare("UPDATE bills SET payment_url=?, payment_method=? WHERE id=?").bind(paymentUrl,env.MIDTRANS_SERVER_KEY?"Midtrans QRIS":"Xendit QRIS",payload.billId).run();
  const qrDataUrl=await QRCode.toDataURL(paymentUrl,{width:360,margin:1,color:{dark:"#183153",light:"#ffffff"}});
  return Response.json({paymentUrl,qrDataUrl});
}

import { env } from "cloudflare:workers";
import { database } from "../../_lib";
import { notifyGuardian } from "../../_notifications";

async function sha512(value:string) {
  const hash=await crypto.subtle.digest("SHA-512",new TextEncoder().encode(value));
  return [...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,"0")).join("");
}

async function settle(invoiceNo:string,method:string,reference:string) {
  const db=database();
  const bill=await db.prepare("SELECT * FROM bills WHERE invoice_no=?").bind(invoiceNo).first<Record<string,unknown>>();
  if(!bill) return false;
  if(bill.status!=="Lunas") {
    const now=new Date().toISOString();
    await db.batch([
      db.prepare("UPDATE bills SET status='Lunas', payment_method=?, payment_reference=?, paid_at=? WHERE id=?")
        .bind(method,reference,now,bill.id),
      db.prepare("INSERT INTO transactions (student_id,type,category,amount,status,note,recorded_at) VALUES (?,'Masuk',? ,?,'Lunas',?,?)")
        .bind(bill.student_id,bill.category,bill.amount,`Pembayaran ${invoiceNo} via ${method}`,now),
    ]);
    try{await notifyGuardian(Number(bill.student_id),`SINURMAN: Pembayaran ${invoiceNo} sebesar Rp${Number(bill.amount).toLocaleString("id-ID")} berhasil diterima. Kuitansi tersedia di Portal Wali.`);}catch{/* payment remains settled */}
  }
  return true;
}

export async function POST(request:Request) {
  const payload=await request.json() as Record<string,unknown>;
  const internal=request.headers.get("x-sinurman-webhook-secret");
  const xendit=request.headers.get("x-callback-token");
  const isInternal=Boolean(env.PAYMENT_WEBHOOK_SECRET&&internal===env.PAYMENT_WEBHOOK_SECRET);
  const isXendit=Boolean(env.XENDIT_WEBHOOK_TOKEN&&xendit===env.XENDIT_WEBHOOK_TOKEN);

  const orderId=String(payload.order_id||"");
  const signature=String(payload.signature_key||"");
  let isMidtrans=false;
  if(orderId&&env.MIDTRANS_SERVER_KEY&&signature) {
    const expected=await sha512(`${orderId}${payload.status_code||""}${payload.gross_amount||""}${env.MIDTRANS_SERVER_KEY}`);
    isMidtrans=signature===expected;
  }
  if(!isInternal&&!isXendit&&!isMidtrans) return Response.json({error:"Signature webhook tidak valid."},{status:401});

  let invoice=orderId||String(payload.reference_id||payload.external_id||"");
  if(!invoice&&payload.data&&typeof payload.data==="object") invoice=String((payload.data as Record<string,unknown>).reference_id||"");
  const status=String(payload.transaction_status||payload.status||payload.event||"").toLocaleLowerCase("id-ID");
  const paid=["settlement","capture","paid","completed","payment.succeeded","payment_session.completed"].some(x=>status.includes(x));
  if(!invoice) return Response.json({error:"Referensi pembayaran tidak ditemukan."},{status:400});
  if(!paid) return Response.json({ok:true,ignored:true});
  const found=await settle(invoice,isMidtrans?"Midtrans QRIS":isXendit?"Xendit QRIS":"Rekonsiliasi",String(payload.transaction_id||payload.payment_id||payload.id||invoice));
  return Response.json({ok:true,found});
}

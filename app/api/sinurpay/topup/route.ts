import { env } from "cloudflare:workers";
import QRCode from "qrcode";
import { database, ensureUser, guardianOwnsStudent } from "../../_lib";
import { settleWalletTopup } from "../_topup";

export async function POST(request:Request) {
  try {
    const user=await ensureUser(request);
    const body=await request.json() as {action?:string;studentId?:number;amount?:number;method?:string;topupId?:number};
    const db=database();
    if(body.action==="verify") {
      if(user.role!=="Admin") return Response.json({error:"Verifikasi manual hanya tersedia untuk Admin."},{status:403});
      const topup=await db.prepare("SELECT topup_no FROM wallet_topups WHERE id=?").bind(Number(body.topupId)).first<{topup_no:string}>();
      if(!topup) return Response.json({error:"Top-up tidak ditemukan."},{status:404});
      const settled=await settleWalletTopup(topup.topup_no,"Transfer Bank Terverifikasi",`MANUAL-${crypto.randomUUID().slice(0,8).toUpperCase()}`);
      return Response.json({ok:settled});
    }
    const studentId=Number(body.studentId);
    const amount=Math.round(Number(body.amount));
    const method=String(body.method||"QRIS");
    if(!studentId||amount<10000||amount>5000000) return Response.json({error:"Nominal top-up harus antara Rp10.000 dan Rp5.000.000."},{status:400});
    if(!["QRIS","Transfer Bank"].includes(method)) return Response.json({error:"Metode pembayaran tidak valid."},{status:400});
    const student=await db.prepare("SELECT id,name,guardian_phone,guardian_email FROM students WHERE id=?").bind(studentId).first<Record<string,unknown>>();
    if(!student) return Response.json({error:"Santri tidak ditemukan."},{status:404});
    if(user.role==="Wali Santri"&&!(await guardianOwnsStudent(user,studentId))) return Response.json({error:"Santri tidak terhubung dengan akun wali ini."},{status:403});
    if(user.role!=="Admin"&&user.role!=="Wali Santri") return Response.json({error:"Peran Anda tidak dapat membuat top-up."},{status:403});
    const now=new Date();
    const topupNo=`TOP-${now.toISOString().replace(/\D/g,"").slice(2,14)}-${crypto.randomUUID().slice(0,5).toUpperCase()}`;
    const expiresAt=new Date(now.getTime()+24*60*60*1000).toISOString();
    let paymentUrl="",provider="",status="Menunggu Pembayaran";
    if(method==="QRIS"&&env.MIDTRANS_SERVER_KEY) {
      provider="Midtrans QRIS";
      const host=env.MIDTRANS_IS_PRODUCTION==="true"?"https://app.midtrans.com":"https://app.sandbox.midtrans.com";
      const response=await fetch(`${host}/snap/v1/transactions`,{method:"POST",headers:{"content-type":"application/json","authorization":`Basic ${btoa(`${env.MIDTRANS_SERVER_KEY}:`)}`},body:JSON.stringify({transaction_details:{order_id:topupNo,gross_amount:amount},customer_details:{first_name:student.name,phone:student.guardian_phone},item_details:[{id:`topup-${studentId}`,price:amount,quantity:1,name:"Top-up SINURPAY"}]})});
      const result=await response.json() as {redirect_url?:string;error_messages?:string[]};
      if(!response.ok||!result.redirect_url) return Response.json({error:result.error_messages?.join(", ")||"Midtrans menolak top-up."},{status:502});
      paymentUrl=result.redirect_url;
    } else if(method==="QRIS"&&env.XENDIT_API_KEY) {
      provider="Xendit QRIS";
      const origin=new URL(request.url).origin;
      const response=await fetch("https://api.xendit.co/sessions",{method:"POST",headers:{"content-type":"application/json","authorization":`Basic ${btoa(`${env.XENDIT_API_KEY}:`)}`},body:JSON.stringify({reference_id:topupNo,session_type:"PAY",mode:"PAYMENT_LINK",amount,currency:"IDR",country:"ID",customer:{reference_id:`student-${studentId}`,type:"INDIVIDUAL",mobile_number:`+${String(student.guardian_phone).replace(/\D/g,"")}`,individual_detail:{given_names:String(student.name)}},description:"Top-up SINURPAY",success_return_url:origin,cancel_return_url:origin})});
      const result=await response.json() as {payment_link_url?:string;message?:string};
      if(!response.ok||!result.payment_link_url) return Response.json({error:result.message||"Xendit menolak top-up."},{status:502});
      paymentUrl=result.payment_link_url;
    } else if(method==="Transfer Bank"&&env.BANK_ACCOUNT_NUMBER&&env.BANK_NAME) {
      provider=`Transfer ${env.BANK_NAME}`;
      status="Menunggu Verifikasi";
    } else {
      return Response.json({error:method==="QRIS"?"Kredensial Midtrans atau Xendit belum dikonfigurasi.":"Rekening bank pesantren belum dikonfigurasi."},{status:503});
    }
    const result=await db.prepare("INSERT INTO wallet_topups (topup_no,student_id,amount,method,provider,status,payment_url,payment_reference,created_by,created_at,expires_at,paid_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,'')")
      .bind(topupNo,studentId,amount,method,provider,status,paymentUrl,"",user.email,now.toISOString(),expiresAt).run();
    const qrDataUrl=paymentUrl?await QRCode.toDataURL(paymentUrl,{width:360,margin:1,color:{dark:"#183153",light:"#ffffff"}}):"";
    return Response.json({ok:true,id:result.meta.last_row_id,topupNo,amount,method,provider,status,paymentUrl,qrDataUrl,bank:method==="Transfer Bank"?{name:String(env.BANK_NAME),number:String(env.BANK_ACCOUNT_NUMBER),holder:String(env.BANK_ACCOUNT_HOLDER||"Pondok Pesantren Nurul Iman")}:null,expiresAt},{status:201});
  } catch(error) {
    return Response.json({error:error instanceof Error?error.message:"Top-up gagal dibuat."},{status:500});
  }
}

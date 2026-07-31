import { database, ensureDatabaseSchema, normalizeGuardianPhone, setGuardianPin } from "../_lib";
import { sendWhatsappNotification } from "../_notifications";

async function hash(value:string) {
  const bytes=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes),byte=>byte.toString(16).padStart(2,"0")).join("");
}

function resetCode() {
  const bytes=new Uint32Array(1);crypto.getRandomValues(bytes);
  return String(100000+(bytes[0]%900000));
}

export async function POST(request:Request) {
  try {
    await ensureDatabaseSchema();
    const body=await request.json() as {action?:"request"|"confirm";phone?:string;code?:string;pin?:string};
    const phone=normalizeGuardianPhone(body.phone);
    if(!/^62\d{8,13}$/.test(phone)) return Response.json({error:"Nomor HP wali tidak valid."},{status:400});
    if(body.action==="request") {
      const account=await database().prepare("SELECT id,status FROM guardian_accounts WHERE phone=?").bind(phone).first<{id:number;status:string}>();
      const generic={ok:true,message:"Jika akun aktif ditemukan, kode verifikasi akan dikirim ke WhatsApp wali."};
      if(!account||account.status!=="Aktif") return Response.json(generic);
      const previous=await database().prepare("SELECT created_at FROM guardian_pin_resets WHERE phone=?").bind(phone).first<{created_at:string}>();
      if(previous&&Date.now()-new Date(previous.created_at).getTime()<60_000) return Response.json({error:"Tunggu satu menit sebelum meminta kode baru."},{status:429});
      const code=resetCode();
      const now=new Date();
      await database().prepare("INSERT INTO guardian_pin_resets (phone,code_hash,attempts,expires_at,created_at) VALUES (?,?,0,?,?) ON CONFLICT(phone) DO UPDATE SET code_hash=excluded.code_hash,attempts=0,expires_at=excluded.expires_at,created_at=excluded.created_at")
        .bind(phone,await hash(`${phone}:${code}`),new Date(now.getTime()+10*60*1000).toISOString(),now.toISOString()).run();
      const notification=await sendWhatsappNotification({recipient:phone,message:`Kode reset PIN SINURMAN Anda: ${code}. Berlaku 10 menit. Jangan berikan kode ini kepada siapa pun.`,channel:"WhatsApp OTP",sensitive:true});
      if(!notification.automatic) {
        await database().prepare("DELETE FROM guardian_pin_resets WHERE phone=?").bind(phone).run();
        return Response.json({error:"WhatsApp otomatis belum aktif. Untuk saat ini, minta Admin mereset PIN Anda."},{status:503});
      }
      return Response.json(generic);
    }
    if(body.action==="confirm") {
      if(!/^\d{6}$/.test(String(body.code||""))||!/^\d{6}$/.test(String(body.pin||""))) return Response.json({error:"Kode dan PIN baru harus terdiri dari 6 angka."},{status:400});
      const reset=await database().prepare("SELECT * FROM guardian_pin_resets WHERE phone=?").bind(phone).first<{id:number;code_hash:string;attempts:number;expires_at:string}>();
      if(!reset||reset.expires_at<=new Date().toISOString()||reset.attempts>=5) return Response.json({error:"Kode reset sudah tidak berlaku. Minta kode baru."},{status:400});
      if(await hash(`${phone}:${body.code}`)!==reset.code_hash) {
        await database().prepare("UPDATE guardian_pin_resets SET attempts=attempts+1 WHERE id=?").bind(reset.id).run();
        return Response.json({error:"Kode verifikasi tidak sesuai."},{status:400});
      }
      await setGuardianPin(phone,String(body.pin));
      await database().prepare("DELETE FROM guardian_pin_resets WHERE phone=?").bind(phone).run();
      return Response.json({ok:true,message:"PIN berhasil diperbarui. Silakan masuk dengan PIN baru."});
    }
    return Response.json({error:"Tindakan reset PIN tidak valid."},{status:400});
  } catch(error) {
    return Response.json({error:error instanceof Error?error.message:"Reset PIN gagal diproses."},{status:500});
  }
}

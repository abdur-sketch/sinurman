import { database, ensureDatabaseSchema } from "../../../_lib";
async function hash(value: string) { const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)); return Array.from(new Uint8Array(bytes)).map(x => x.toString(16).padStart(2, "0")).join(""); }
export async function POST(request: Request) {
  try {
    await ensureDatabaseSchema(); const body = await request.json() as { challengeId?:unknown; code?:unknown };
    const id=String(body.challengeId||"").slice(0,80), code=String(body.code||"").replace(/\D/g,"").slice(0,6);
    const row=await database().prepare("SELECT id,admission_id,code_hash,attempts,expires_at,used_at FROM spmb_otp_challenges WHERE id=?").bind(id).first<{id:string;admission_id:number;code_hash:string;attempts:number;expires_at:string;used_at:string}>();
    if(!row || row.used_at || row.expires_at < new Date().toISOString() || Number(row.attempts)>=5) return Response.json({error:"Kode OTP tidak valid atau sudah kedaluwarsa."},{status:403});
    const candidate=await hash(`${id}:${code}`); let diff=candidate.length^row.code_hash.length; for(let i=0;i<Math.min(candidate.length,row.code_hash.length);i++) diff|=candidate.charCodeAt(i)^row.code_hash.charCodeAt(i);
    if(diff!==0){await database().prepare("UPDATE spmb_otp_challenges SET attempts=attempts+1 WHERE id=?").bind(id).run();return Response.json({error:"Kode OTP tidak valid atau sudah kedaluwarsa."},{status:403});}
    const token=crypto.randomUUID()+crypto.randomUUID(); const now=new Date(); const expires=new Date(now.getTime()+30*60*1000);
    await database().batch([database().prepare("UPDATE spmb_otp_challenges SET used_at=? WHERE id=?").bind(now.toISOString(),id),database().prepare("INSERT INTO spmb_portal_sessions (token_hash,admission_id,expires_at,created_at,last_seen_at) VALUES (?,?,?,?,?)").bind(await hash(token),row.admission_id,expires.toISOString(),now.toISOString(),now.toISOString())]);
    return new Response(JSON.stringify({ok:true}),{headers:{"content-type":"application/json","set-cookie":`spmb_portal_session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=1800`}});
  } catch { return Response.json({error:"Verifikasi OTP gagal."},{status:500}); }
}

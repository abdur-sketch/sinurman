import { env } from "cloudflare:workers";
import { database, ensureDatabaseSchema, normalizeGuardianPhone } from "../../../_lib";
import { sendWhatsappNotification } from "../../../_notifications";
import { firebaseRuntimeTargets } from "../../../../../lib/firebase/runtime-isolation.mjs";

function otpRuntimeEnv() {
  return Reflect.get(Reflect.get(globalThis, "process") as object, "env") as Record<string, string | undefined>;
}

function stagingTestOtp(env: Record<string, string | undefined>) {
  if (env.SINURMAN_STAGING_OTP_MODE !== "mock") throw new Error("Staging OTP must use mock mode.");
  const code = env.SINURMAN_STAGING_TEST_OTP_CODE || "";
  if (!/^\d{6}$/.test(code)) throw new Error("Staging requires a six-digit test OTP stored in a secret.");
  return code;
}

const clean = (value: unknown, max = 80) => String(value ?? "").trim().slice(0, max);
async function hash(value: string) { const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)); return Array.from(new Uint8Array(bytes)).map(x => x.toString(16).padStart(2, "0")).join(""); }
function generic() { return Response.json({ ok: true, message: "Jika nomor pendaftaran terdaftar, kode OTP akan dikirim ke kontak wali yang tercatat." }); }

export async function POST(request: Request) {
  try {
    // Run the safety guard before any database read or WhatsApp delivery.
    // K_SERVICE is set by Cloud Run; missing staging mode fails closed.
    const runtime = otpRuntimeEnv();
    const staging = firebaseRuntimeTargets(runtime).mode === "staging";
    if (staging) stagingTestOtp(runtime);
    await ensureDatabaseSchema();
    const body = await request.json() as { registrationNo?: unknown };
    const registrationNo = clean(body.registrationNo, 50).toUpperCase();
    if (!registrationNo) return generic();
    // Never allow staging's fixed out-of-band UAT code for ordinary applicants.
    if (staging && !registrationNo.startsWith("STG-")) return generic();
    if (!staging && (!env.WHATSAPP_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID)) return Response.json({ error: "Verifikasi OTP WhatsApp belum tersedia. Hubungi panitia SPMB untuk bantuan." }, { status: 503 });
    const recent = await database().prepare("SELECT COUNT(*) AS total FROM spmb_otp_challenges WHERE created_at>? AND admission_id IN (SELECT id FROM admissions WHERE registration_no=?)").bind(new Date(Date.now() - 10 * 60 * 1000).toISOString(), registrationNo).first<{ total:number }>();
    if (Number(recent?.total || 0) >= 3) return Response.json({ error: "Permintaan OTP terlalu sering. Coba lagi beberapa menit lagi." }, { status: 429 });
    const admission = await database().prepare("SELECT id,name,guardian_phone FROM admissions WHERE registration_no=?").bind(registrationNo).first<{id:number;name:string;guardian_phone:string}>();
    if (!admission || (!staging && !normalizeGuardianPhone(admission.guardian_phone))) return generic();
    const code = staging ? stagingTestOtp(runtime) : String(Math.floor(100000 + Math.random() * 900000));
    const challengeId = crypto.randomUUID(); const now = new Date(); const expires = new Date(now.getTime() + 5 * 60 * 1000);
    await database().prepare("INSERT INTO spmb_otp_challenges (id,admission_id,code_hash,attempts,expires_at,used_at,created_at) VALUES (?,?,?,0,?,'',?)").bind(challengeId, admission.id, await hash(`${challengeId}:${code}`), expires.toISOString(), now.toISOString()).run();
    // Staging: no external messages, no code in response or logs.
    // Testers obtain the code through an authorized out-of-band secret channel.
    if (!staging) {
      const sent = await sendWhatsappNotification({ recipient: normalizeGuardianPhone(admission.guardian_phone), message: `SINURMAN SPMB: kode OTP pelacakan pendaftaran Anda adalah ${code}. Berlaku 5 menit. Jangan bagikan kode ini kepada siapa pun.`, channel: "SPMB OTP", sensitive: true });
      if (!sent.automatic) return Response.json({ error: "OTP belum dapat dikirim oleh layanan WhatsApp. Hubungi panitia SPMB." }, { status: 502 });
    }
    return Response.json({ ok:true, challengeId, expiresIn:300 });
  } catch { return Response.json({ error: "Layanan pelacakan belum dapat digunakan." }, { status: 500 }); }
}

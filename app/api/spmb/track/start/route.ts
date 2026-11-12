import { env } from "cloudflare:workers";
import { database, ensureDatabaseSchema, normalizeGuardianPhone } from "../../../_lib";
import { sendWhatsappNotification } from "../../../_notifications";
import { assertRuntimeIsolation } from "../../../../../lib/firebase/runtime-isolation.mjs";

const clean = (value: unknown, max = 80) => String(value ?? "").trim().slice(0, max);
async function hash(value: string) { const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)); return Array.from(new Uint8Array(bytes)).map(x => x.toString(16).padStart(2, "0")).join(""); }
function generic() { return Response.json({ ok: true, message: "Jika nomor pendaftaran terdaftar, kode OTP akan dikirim ke kontak wali yang tercatat." }); }

export async function POST(request: Request) {
  try {
    await ensureDatabaseSchema();
    const runtimeEnv = Reflect.get(Reflect.get(globalThis, "process") as object, "env") as Record<string, string | undefined>;
    const mockOtp = runtimeEnv.SPMB_OTP_MOCK === "true";
    if (mockOtp) assertRuntimeIsolation(runtimeEnv);
    const body = await request.json() as { registrationNo?: unknown };
    const registrationNo = clean(body.registrationNo, 50).toUpperCase();
    if (!registrationNo) return generic();
    if (!env.WHATSAPP_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID) return Response.json({ error: "Verifikasi OTP WhatsApp belum tersedia. Hubungi panitia SPMB untuk bantuan." }, { status: 503 });
    const recent = await database().prepare("SELECT COUNT(*) AS total FROM spmb_otp_challenges WHERE created_at>? AND admission_id IN (SELECT id FROM admissions WHERE registration_no=?)").bind(new Date(Date.now() - 10 * 60 * 1000).toISOString(), registrationNo).first<{ total:number }>();
    if (Number(recent?.total || 0) >= 3) return Response.json({ error: "Permintaan OTP terlalu sering. Coba lagi beberapa menit lagi." }, { status: 429 });
    const admission = await database().prepare("SELECT id,name,guardian_phone FROM admissions WHERE registration_no=?").bind(registrationNo).first<{id:number;name:string;guardian_phone:string}>();
    if (!admission || !normalizeGuardianPhone(admission.guardian_phone)) return generic();
    if (mockOtp && !/^TEST-|^QA-/i.test(registrationNo)) return generic();
    const random = new Uint32Array(1); crypto.getRandomValues(random);
    const code = mockOtp ? clean(runtimeEnv.SPMB_OTP_MOCK_CODE, 6).replace(/\D/g, "").padStart(6, "0").slice(0, 6) : String(100000 + (random[0] % 900000));
    if (mockOtp && code.length !== 6) return Response.json({ error: "Mock OTP staging belum dikonfigurasi." }, { status: 503 });
    const challengeId = crypto.randomUUID(); const now = new Date(); const expires = new Date(now.getTime() + 5 * 60 * 1000);
    await database().prepare("INSERT INTO spmb_otp_challenges (id,admission_id,code_hash,attempts,expires_at,used_at,created_at) VALUES (?,?,?,0,?,'',?)").bind(challengeId, admission.id, await hash(`${challengeId}:${code}`), expires.toISOString(), now.toISOString()).run();
    const sent = mockOtp ? { automatic: true } : await sendWhatsappNotification({ recipient: normalizeGuardianPhone(admission.guardian_phone), message: `SINURMAN SPMB: kode OTP pelacakan pendaftaran Anda adalah ${code}. Berlaku 5 menit. Jangan bagikan kode ini kepada siapa pun.`, channel: "SPMB OTP", sensitive: true });
    if (!sent.automatic) return Response.json({ error: "OTP belum dapat dikirim oleh layanan WhatsApp. Hubungi panitia SPMB." }, { status: 502 });
    return Response.json({ ok:true, challengeId, expiresIn:300 });
  } catch { return Response.json({ error: "Layanan pelacakan belum dapat digunakan." }, { status: 500 }); }
}

import { registerGuardianAccount } from "../_lib";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { phone?: string; pin?: string };
    const result = await registerGuardianAccount(body.phone, String(body.pin ?? ""));
    return Response.json(
      {
        ok: true,
        phone: result.phone,
        status: result.status,
        message: "Pendaftaran terkirim. Tunggu persetujuan Admin sebelum masuk.",
      },
      { status: result.created ? 201 : 200 },
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Pendaftaran akun wali gagal." },
      { status: 400 },
    );
  }
}

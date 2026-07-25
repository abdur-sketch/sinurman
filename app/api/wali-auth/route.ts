import {
  createGuardianSession,
  getGuardianSession,
  removeGuardianSession,
  verifyGuardianPin,
} from "../_lib";

export async function GET(request: Request) {
  const session = await getGuardianSession(request);
  return Response.json({
    authenticated: Boolean(session),
    phone: session?.phone ?? "",
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { phone?: string; pin?: string };
    const pin = String(body.pin ?? "");
    if (!/^\d{6}$/.test(pin)) {
      return Response.json({ error: "Masukkan PIN 6 angka." }, { status: 400 });
    }
    const verified = await verifyGuardianPin(body.phone, pin);
    if (!verified.ok) {
      return Response.json({ error: verified.message }, { status: 401 });
    }
    const session = await createGuardianSession(verified.accountId);
    return Response.json(
      { ok: true, redirectTo: "/portal-wali", phone: verified.phone },
      { headers: { "set-cookie": session.cookie } },
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Gagal masuk ke Portal Wali." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  const cookie = await removeGuardianSession(request);
  return Response.json({ ok: true }, { headers: { "set-cookie": cookie } });
}

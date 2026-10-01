export const runtime = "nodejs";

// Firebase Auth is enabled in production and in the explicitly opt-in local
// emulator harness only. No QA flag is present in deployed environments.
const firebaseAuthEnabled = () => process.env.FIREBASE_RUNTIME === "true" || process.env.RBAC_QA_EMULATOR === "true";

export async function GET(request: Request) {
  if (!firebaseAuthEnabled()) {
    return Response.json({ authenticated: false }, { status: 404 });
  }
  const { getFirebaseSession } = await import("../../../lib/firebase/session");
  const session = await getFirebaseSession(request);
  return Response.json({
    authenticated: Boolean(session),
    email: session?.email ?? "",
    name: session?.name ?? "",
  });
}

export async function POST(request: Request) {
  try {
    if (!firebaseAuthEnabled()) {
      return Response.json({ error: "Login Firebase hanya tersedia pada Firebase App Hosting." }, { status: 404 });
    }
    const { createFirebaseSession } = await import("../../../lib/firebase/session");
    const body = await request.json() as { idToken?: string };
    if (!body.idToken) {
      return Response.json({ error: "Token login tidak tersedia." }, { status: 400 });
    }
    const result = await createFirebaseSession(body.idToken,request);
    return Response.json(
      { ok: true, email: result.session.email, redirectTo: "/" },
      { headers: { "set-cookie": result.cookie } },
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Login Firebase gagal." },
      { status: 401 },
    );
  }
}

export async function DELETE(request: Request) {
  if (!firebaseAuthEnabled()) {
    return Response.json({ ok: true }, { status: 404 });
  }
  const { removeFirebaseSession } = await import("../../../lib/firebase/session");
  const cookie = await removeFirebaseSession(request);
  return Response.json({ ok: true }, { headers: { "set-cookie": cookie } });
}

export async function PUT(request: Request) {
  try {
    if (!firebaseAuthEnabled()) {
      return Response.json({ error: "Sesi Firebase tidak tersedia." }, { status: 404 });
    }
    const { rotateFirebaseSession } = await import("../../../lib/firebase/session");
    const body = await request.json() as { idToken?: string };
    if (!body.idToken) {
      return Response.json({ error: "Token login tidak tersedia." }, { status: 400 });
    }
    const result = await rotateFirebaseSession(request, body.idToken);
    return Response.json(
      { ok: true, message: "Kata sandi berhasil diubah dan sesi lain telah dikeluarkan." },
      { headers: { "set-cookie": result.cookie } },
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Sesi baru gagal dibuat." },
      { status: 401 },
    );
  }
}

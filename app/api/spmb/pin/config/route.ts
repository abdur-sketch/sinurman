import { registrationPinEnabled } from "../../../../../lib/spmb-pin.mjs";

export async function GET() {
  const processEnv = Reflect.get(Reflect.get(globalThis, "process") as object, "env") as Record<string, string | undefined>;
  return Response.json({ enabled: registrationPinEnabled(processEnv) }, { headers: { "cache-control": "no-store" } });
}

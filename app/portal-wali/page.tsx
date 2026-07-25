import { headers } from "next/headers";
import { redirect } from "next/navigation";
import DashboardClient from "../dashboard-client";
import { getGuardianSession } from "../api/_lib";

export const dynamic = "force-dynamic";

export default async function GuardianDashboardPage() {
  const requestHeaders = await headers();
  const session = await getGuardianSession(
    new Request("https://sinurman.local/portal-wali", { headers: requestHeaders }),
  );
  if (!session) redirect("/wali");
  return <DashboardClient />;
}

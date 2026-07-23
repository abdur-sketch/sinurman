import DashboardClient from "./dashboard-client";
import { requireChatGPTUser } from "./chatgpt-auth";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  await requireChatGPTUser("/");
  return <DashboardClient />;
}

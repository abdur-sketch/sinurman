import { requireChatGPTUser } from "../chatgpt-auth";
import PrintReportClient from "./print-report-client";

export const dynamic = "force-dynamic";

export default async function PrintReportPage() {
  await requireChatGPTUser("/cetak");
  return <PrintReportClient />;
}

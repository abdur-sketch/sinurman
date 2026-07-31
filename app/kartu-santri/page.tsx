import { requireChatGPTUser } from "../chatgpt-auth";
import BulkStudentCards from "./student-cards-client";

export const dynamic="force-dynamic";

export default async function StudentCardsPage() {
  await requireChatGPTUser("/kartu-santri");
  return <BulkStudentCards/>;
}

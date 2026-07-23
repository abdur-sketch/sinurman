import { headers } from "next/headers";
import { redirect } from "next/navigation";

export type ChatGPTUser = {
  displayName: string;
  email: string;
  fullName: string | null;
};

const SIGN_IN_PATH = "/signin-with-chatgpt";

export async function getChatGPTUser(): Promise<ChatGPTUser | null> {
  const requestHeaders = await headers();
  const email = requestHeaders.get("oai-authenticated-user-email");
  if (!email) return null;
  const encodedName = requestHeaders.get("oai-authenticated-user-full-name");
  const encoded = requestHeaders.get("oai-authenticated-user-full-name-encoding") === "percent-encoded-utf-8";
  let fullName: string | null = null;
  if (encodedName && encoded) {
    try { fullName = decodeURIComponent(encodedName); } catch { fullName = null; }
  }
  return { email, fullName, displayName: fullName ?? email };
}

export async function requireChatGPTUser(returnTo: string): Promise<ChatGPTUser> {
  const user = await getChatGPTUser();
  if (user) return user;
  const safeReturnTo = returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/";
  redirect(`${SIGN_IN_PATH}?return_to=${encodeURIComponent(safeReturnTo)}`);
}

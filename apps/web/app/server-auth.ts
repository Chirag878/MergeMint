import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionFromHeaders } from "@veriflow/auth/server";

export async function requireWebSession() {
  const session = await getSessionFromHeaders(await headers());

  if (!session?.user) {
    redirect("/login");
  }

  return session;
}

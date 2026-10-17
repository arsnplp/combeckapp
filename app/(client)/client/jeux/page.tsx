import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { resolveClientSession } from "@/lib/client-sessions";
import GamesClient from "./GamesClient";

export default async function JeuxClientPage() {
  const token = (await cookies()).get("comeback_client")?.value;
  const email = token ? await resolveClientSession(token) : null;
  if (!email) redirect("/client/login");
  return <GamesClient />;
}

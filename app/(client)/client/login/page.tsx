import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { resolveClientSession } from "@/lib/client-sessions";
import ClientAuthPanel from "@/components/client/ClientAuthPanel";

export default async function ClientLoginPage() {
  // Déjà connecté → directement sur ses cartes
  const cookieStore = await cookies();
  const token = cookieStore.get("comeback_client")?.value;
  const email = token ? await resolveClientSession(token) : null;
  if (email) redirect("/client/cards");

  return (
    <div className="pt-8">
      <ClientAuthPanel />
    </div>
  );
}

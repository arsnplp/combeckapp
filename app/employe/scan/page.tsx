import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { resolveEmployeeSession } from "@/lib/employee-sessions";
import { getEmployeeByEmail, getEmployeeLink } from "@/lib/employees";
import { getUserById } from "@/lib/users";
import EmployeeScan from "@/components/employee/EmployeeScan";

export default async function EmployeeScanPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("comeback_staff")?.value;
  const session = token ? await resolveEmployeeSession(token) : null;
  if (!session) redirect("/employe/login");
  // Aucun commerce déverrouillé (déverrouillage expiré, ou accès retiré) →
  // retour au choix du commerce plutôt qu'un écran vide.
  if (!session.unlockedMerchantId) redirect("/employe");

  const account = await getEmployeeByEmail(session.email);
  if (!account) redirect("/employe/login");
  const link = await getEmployeeLink(account.id, session.unlockedMerchantId);
  if (!link || !link.active) redirect("/employe");

  const merchant = await getUserById(session.unlockedMerchantId);

  return <EmployeeScan storeName={merchant?.storeName ?? "Commerce"} />;
}

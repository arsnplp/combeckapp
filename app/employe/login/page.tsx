import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { resolveEmployeeSession } from "@/lib/employee-sessions";
import EmployeeAuthPanel from "@/components/employee/EmployeeAuthPanel";

export default async function EmployeeLoginPage() {
  // Déjà connecté → directement sur ses commerces
  const cookieStore = await cookies();
  const token = cookieStore.get("comeback_staff")?.value;
  const session = token ? await resolveEmployeeSession(token) : null;
  if (session) redirect("/employe");

  return (
    <div className="pt-8">
      <EmployeeAuthPanel />
    </div>
  );
}

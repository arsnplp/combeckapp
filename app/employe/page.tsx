import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { resolveEmployeeSession } from "@/lib/employee-sessions";
import EmployeeHome from "@/components/employee/EmployeeHome";

export default async function EmployeeHomePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("comeback_staff")?.value;
  const session = token ? await resolveEmployeeSession(token) : null;
  if (!session) redirect("/employe/login");

  return <EmployeeHome />;
}

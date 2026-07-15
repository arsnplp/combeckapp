import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import AppSidebar from "@/components/layout/AppSidebar";
import Topbar from "@/components/layout/Topbar";
import { StoreProvider } from "@/lib/store-context";
import { auth } from "@/auth";
import ImpersonationBanner from "@/components/layout/ImpersonationBanner";
import PlanExpirationBanner from "@/components/dashboard/PlanExpirationBanner";
import { getUserById } from "@/lib/users";
import { getPlanInfo } from "@/lib/plan-billing";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  // Marchands Google sans nom de commerce → onboarding obligatoire
  const dbUser = await getUserById(session.user.id);
  if (dbUser?.onboardingNeeded) redirect("/onboarding");

  // Essai gratuit expiré → page de blocage (le compte est conservé, seule
  // la page 'Choisir un plan' reste accessible)
  if (dbUser && dbUser.plan === "free") {
    const planInfo = getPlanInfo(dbUser.plan, dbUser.planExpiresAt ?? null);
    if (planInfo.isExpired) redirect("/bloque");
  }

  return (
    <StoreProvider tenantId={session.user.id}>
      <div className="min-h-screen bg-[#f8f9fa] text-slate-900">
        {session.user.impersonatedBy && (
          <ImpersonationBanner storeName={session.user.name ?? session.user.id} />
        )}
        <div className="flex min-h-screen">
          <div className="hidden lg:block lg:w-[236px] lg:flex-shrink-0">
            <AppSidebar />
          </div>
          <div className="flex min-w-0 flex-1 flex-col">
            <Topbar />
            <main className="mx-auto w-full max-w-[1060px] px-6 py-7 lg:px-8 lg:py-8">
              <PlanExpirationBanner />
              {children}
            </main>
          </div>
        </div>
      </div>
    </StoreProvider>
  );
}

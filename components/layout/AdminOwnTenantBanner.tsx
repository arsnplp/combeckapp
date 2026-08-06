import Link from "next/link";
import { ShieldAlert } from "lucide-react";

// Le compte admin est aussi une ligne `merchants` valide (is_admin: true) —
// rien n'empêche techniquement de créer des cartes/récompenses "pour lui-même"
// en utilisant le dashboard normalement. Ça n'a jamais de sens : aucun client
// réel n'est jamais rattaché à ce tenant, donc rien de créé ici n'est visible
// nulle part. Ce bandeau rend la situation impossible à manquer plutôt que de
// bloquer l'accès (utile pour tester l'UI ponctuellement).
export default function AdminOwnTenantBanner() {
  return (
    <div className="sticky top-0 z-50 flex items-center justify-between gap-3 bg-red-600 px-5 py-2.5">
      <div className="flex items-center gap-2.5">
        <ShieldAlert className="h-4 w-4 flex-shrink-0 text-white" />
        <span className="text-[13px] font-semibold text-white">
          Compte administrateur — ce n&apos;est pas un vrai compte commerçant. Rien de créé ici (cartes, récompenses…) ne sera visible par un client.
        </span>
      </div>
      <Link
        href="/admin"
        className="flex-shrink-0 rounded-lg bg-white/15 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-white/25 transition-colors"
      >
        Retour admin
      </Link>
    </div>
  );
}

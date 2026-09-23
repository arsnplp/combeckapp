"use client";

import { useLinkStatus } from "next/link";
import { Loader2 } from "lucide-react";
import type { ElementType } from "react";

/**
 * Icône d'un élément de navigation, qui se change en indicateur d'activité
 * pendant que la page demandée arrive.
 *
 * Sans ça, cliquer ne produisait aucun retour visible : le routeur attend la
 * réponse du serveur (~100 ms en local, davantage en 4G) avant de changer
 * quoi que ce soit à l'écran. L'ancienne page restait figée, puis la nouvelle
 * apparaissait d'un coup — d'où l'impression de lenteur, même quand c'est
 * rapide.
 *
 * On remplace l'icône sur place plutôt que d'afficher un squelette plein
 * écran : à 100 ms, remplacer tout le contenu ne ferait que clignoter.
 *
 * `useLinkStatus` ne fonctionne qu'à l'intérieur d'un `<Link>` : ce composant
 * doit rester un enfant du lien dont il reflète l'état.
 */
export default function NavIcon({
  icon: Icon,
  className,
}: {
  icon: ElementType;
  className?: string;
}) {
  const { pending } = useLinkStatus();
  return pending ? (
    <Loader2 className={`${className ?? ""} animate-spin`} aria-hidden />
  ) : (
    <Icon className={className} aria-hidden />
  );
}

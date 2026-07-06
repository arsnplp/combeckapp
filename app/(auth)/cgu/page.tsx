import Link from "next/link";
import { Zap } from "lucide-react";

export default function CguPage() {
  return (
    <div className="min-h-screen bg-white px-4 py-12">
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <div className="mb-10 flex items-center gap-2.5">
          <Link href="/login" className="flex items-center gap-2.5 text-slate-900 hover:opacity-80 transition-opacity">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-green-600">
              <Zap className="h-3.5 w-3.5 text-white" fill="currentColor" />
            </div>
            <span className="text-[15px] font-bold">Comeback</span>
          </Link>
        </div>

        <h1 className="text-[28px] font-bold text-slate-900 mb-2">Conditions Générales d&apos;Utilisation</h1>
        <p className="text-[13px] text-slate-400 mb-8">Dernière mise à jour : juin 2025</p>

        <div className="space-y-8 text-[14px] leading-relaxed text-slate-700">

          <section>
            <h2 className="text-[16px] font-semibold text-slate-900 mb-3">Article 1 — Objet</h2>
            <p>
              Les présentes Conditions Générales d&apos;Utilisation (CGU) ont pour objet de définir les modalités et conditions d&apos;utilisation du service <strong>Comeback</strong>, plateforme SaaS de programme de fidélité destinée aux professionnels (ci-après « le Service »), édité par Nairox.
            </p>
            <p className="mt-2">
              L&apos;utilisation du Service implique l&apos;acceptation pleine et entière des présentes CGU. Toute inscription vaut acceptation sans réserve des présentes conditions.
            </p>
          </section>

          <section>
            <h2 className="text-[16px] font-semibold text-slate-900 mb-3">Article 2 — Inscription et accès</h2>
            <p>
              Pour accéder au Service, l&apos;utilisateur (commerçant ou restaurateur) doit créer un compte en fournissant une adresse email valide, un mot de passe et le nom de son établissement.
            </p>
            <ul className="mt-3 space-y-1.5 pl-4 list-disc text-slate-600">
              <li>L&apos;inscription est réservée aux personnes physiques majeures ou morales.</li>
              <li>Chaque compte est personnel et non cessible.</li>
              <li>L&apos;utilisateur est responsable de la confidentialité de ses identifiants.</li>
              <li>Comeback se réserve le droit de suspendre ou supprimer tout compte en cas d&apos;abus.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-[16px] font-semibold text-slate-900 mb-3">Article 3 — Description du service</h2>
            <p>Comeback met à disposition des commerçants les fonctionnalités suivantes :</p>
            <ul className="mt-3 space-y-1.5 pl-4 list-disc text-slate-600">
              <li>Création et personnalisation de cartes de fidélité Apple Wallet</li>
              <li>Gestion d&apos;une base de clients</li>
              <li>Suivi des points, tampons et récompenses</li>
              <li>Envoi de notifications push</li>
              <li>Tableau de bord analytique</li>
              <li>Export des données clients</li>
            </ul>
          </section>

          <section>
            <h2 className="text-[16px] font-semibold text-slate-900 mb-3">Article 4 — Obligations de l&apos;utilisateur</h2>
            <p>L&apos;utilisateur s&apos;engage à :</p>
            <ul className="mt-3 space-y-1.5 pl-4 list-disc text-slate-600">
              <li>Fournir des informations exactes lors de l&apos;inscription.</li>
              <li>Utiliser le Service conformément à la législation en vigueur.</li>
              <li>Ne pas utiliser le Service à des fins frauduleuses ou illicites.</li>
              <li>Respecter la vie privée de ses clients et obtenir leurs consentements nécessaires.</li>
              <li>Ne pas tenter de compromettre la sécurité du Service.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-[16px] font-semibold text-slate-900 mb-3">Article 5 — Tarifs et facturation</h2>
            <p>
              Comeback propose plusieurs formules d&apos;abonnement détaillées sur la page <Link href="/tarifs" className="text-green-600 hover:underline">Tarifs</Link>. Les prix sont indiqués en euros hors taxes.
            </p>
            <p className="mt-2">
              Comeback se réserve le droit de modifier ses tarifs à tout moment. Les modifications tarifaires seront notifiées à l&apos;utilisateur avec un préavis de 30 jours.
            </p>
          </section>

          <section>
            <h2 className="text-[16px] font-semibold text-slate-900 mb-3">Article 6 — Résiliation</h2>
            <p>
              L&apos;utilisateur peut résilier son abonnement à tout moment depuis son espace compte ou en contactant le support. La résiliation prend effet à la fin de la période d&apos;abonnement en cours.
            </p>
            <p className="mt-2">
              Comeback se réserve le droit de résilier unilatéralement l&apos;accès au Service en cas de violation des présentes CGU, sans préavis ni remboursement.
            </p>
          </section>

          <section>
            <h2 className="text-[16px] font-semibold text-slate-900 mb-3">Article 7 — Limitation de responsabilité</h2>
            <p>
              Comeback s&apos;engage à faire ses meilleurs efforts pour assurer la disponibilité et la sécurité du Service. Toutefois, Comeback ne peut être tenu responsable :
            </p>
            <ul className="mt-3 space-y-1.5 pl-4 list-disc text-slate-600">
              <li>Des interruptions de service dues à des maintenance ou cas de force majeure.</li>
              <li>Des pertes de données résultant d&apos;une mauvaise utilisation du Service.</li>
              <li>Des dommages indirects subis par l&apos;utilisateur.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-[16px] font-semibold text-slate-900 mb-3">Article 8 — Propriété intellectuelle</h2>
            <p>
              L&apos;ensemble des éléments constituant le Service (logiciels, bases de données, textes, images, logos) sont la propriété exclusive de Nairox et sont protégés par le droit de la propriété intellectuelle.
            </p>
            <p className="mt-2">
              L&apos;utilisateur bénéficie d&apos;une licence d&apos;utilisation non exclusive et non transférable du Service pour la durée de son abonnement.
            </p>
          </section>

          <section>
            <h2 className="text-[16px] font-semibold text-slate-900 mb-3">Article 9 — Droit applicable et juridiction</h2>
            <p>
              Les présentes CGU sont régies par le droit français. En cas de litige, les parties s&apos;engagent à rechercher une solution amiable. À défaut, les tribunaux compétents de France seront seuls compétents.
            </p>
          </section>

          <section>
            <h2 className="text-[16px] font-semibold text-slate-900 mb-3">Article 10 — Contact</h2>
            <p>
              Pour toute question relative aux présentes CGU, contactez-nous à :{" "}
              <a href="mailto:enesra92z@gmail.com" className="text-green-600 hover:underline">enesra92z@gmail.com</a>
            </p>
          </section>

        </div>

        <div className="mt-12 flex flex-wrap gap-4 border-t border-slate-100 pt-8 text-[12px] text-slate-400">
          <Link href="/login" className="hover:text-slate-600 transition-colors">Connexion</Link>
          <Link href="/mentions-legales" className="hover:text-slate-600 transition-colors">Mentions légales</Link>
          <Link href="/politique-de-confidentialite" className="hover:text-slate-600 transition-colors">Politique de confidentialité</Link>
        </div>
      </div>
    </div>
  );
}

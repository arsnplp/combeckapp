import Link from "next/link";
import { Zap } from "lucide-react";

export default function PolitiqueConfidentialitePage() {
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

        <h1 className="text-[28px] font-bold text-slate-900 mb-2">Politique de confidentialité</h1>
        <p className="text-[13px] text-slate-400 mb-8">Dernière mise à jour : juin 2025 — Conforme au RGPD</p>

        <div className="space-y-8 text-[14px] leading-relaxed text-slate-700">

          <section>
            <h2 className="text-[16px] font-semibold text-slate-900 mb-3">1. Responsable du traitement</h2>
            <p>
              Le responsable du traitement des données personnelles collectées via le Service Comeback est :
            </p>
            <ul className="mt-3 space-y-1.5 pl-4 list-disc text-slate-600">
              <li><strong>Nairox</strong> — entreprise individuelle</li>
              <li>Email DPO : <a href="mailto:enesra92z@gmail.com" className="text-green-600 hover:underline">enesra92z@gmail.com</a></li>
            </ul>
          </section>

          <section>
            <h2 className="text-[16px] font-semibold text-slate-900 mb-3">2. Données collectées</h2>
            <p>Nous collectons les catégories de données suivantes :</p>

            <h3 className="mt-4 text-[14px] font-semibold text-slate-800 mb-2">a) Comptes commerçants</h3>
            <ul className="space-y-1.5 pl-4 list-disc text-slate-600">
              <li>Adresse email</li>
              <li>Mot de passe (chiffré — non accessible en clair)</li>
              <li>Nom de l&apos;établissement et ville</li>
              <li>Date de création du compte</li>
            </ul>

            <h3 className="mt-4 text-[14px] font-semibold text-slate-800 mb-2">b) Clients des commerçants</h3>
            <ul className="space-y-1.5 pl-4 list-disc text-slate-600">
              <li>Nom et prénom</li>
              <li>Adresse email</li>
              <li>Numéro de téléphone</li>
              <li>Historique de fidélité (points, tampons, visites, récompenses)</li>
              <li>Date d&apos;inscription et date de dernière activité</li>
            </ul>

            <h3 className="mt-4 text-[14px] font-semibold text-slate-800 mb-2">c) Données techniques</h3>
            <ul className="space-y-1.5 pl-4 list-disc text-slate-600">
              <li>Adresses IP (à des fins de sécurité et de limitation des requêtes)</li>
              <li>Journaux de connexion</li>
            </ul>
          </section>

          <section>
            <h2 className="text-[16px] font-semibold text-slate-900 mb-3">3. Finalités du traitement</h2>
            <p>Vos données sont traitées aux fins suivantes :</p>
            <ul className="mt-3 space-y-1.5 pl-4 list-disc text-slate-600">
              <li><strong>Fourniture du service</strong> — gestion des comptes, des cartes de fidélité et des récompenses</li>
              <li><strong>Communication</strong> — envoi d&apos;emails transactionnels (vérification, réinitialisation de mot de passe)</li>
              <li><strong>Sécurité</strong> — protection contre les abus et les accès non autorisés</li>
              <li><strong>Amélioration du service</strong> — analyse des usages agrégés et anonymisés</li>
            </ul>
          </section>

          <section>
            <h2 className="text-[16px] font-semibold text-slate-900 mb-3">4. Base légale des traitements</h2>
            <ul className="space-y-2 pl-4 list-disc text-slate-600">
              <li><strong>Exécution du contrat</strong> — pour les données nécessaires à la fourniture du Service (art. 6.1.b RGPD)</li>
              <li><strong>Consentement</strong> — pour les communications marketing (art. 6.1.a RGPD)</li>
              <li><strong>Intérêt légitime</strong> — pour la sécurité du service et la prévention des fraudes (art. 6.1.f RGPD)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-[16px] font-semibold text-slate-900 mb-3">5. Durée de conservation</h2>
            <ul className="space-y-2 pl-4 list-disc text-slate-600">
              <li><strong>Comptes actifs</strong> — conservés pendant toute la durée de l&apos;abonnement</li>
              <li><strong>Après résiliation</strong> — données supprimées sous 30 jours, sauf obligation légale</li>
              <li><strong>Données de sécurité (IP)</strong> — conservées 12 mois maximum</li>
              <li><strong>Emails transactionnels</strong> — journaux conservés 6 mois</li>
            </ul>
          </section>

          <section>
            <h2 className="text-[16px] font-semibold text-slate-900 mb-3">6. Partage des données</h2>
            <p>
              Nous ne vendons ni ne louons vos données personnelles à des tiers. Vos données peuvent être partagées avec :
            </p>
            <ul className="mt-3 space-y-1.5 pl-4 list-disc text-slate-600">
              <li><strong>Resend</strong> — service d&apos;envoi d&apos;emails transactionnels (données chiffrées en transit)</li>
              <li><strong>OVH</strong> — hébergeur de l&apos;infrastructure serveur en France</li>
            </ul>
            <p className="mt-3">
              Ces prestataires sont soumis à des obligations contractuelles strictes de confidentialité et ne peuvent utiliser vos données qu&apos;aux fins pour lesquelles elles leur ont été transmises.
            </p>
          </section>

          <section>
            <h2 className="text-[16px] font-semibold text-slate-900 mb-3">7. Vos droits (RGPD)</h2>
            <p>Conformément au Règlement Général sur la Protection des Données (RGPD), vous disposez des droits suivants :</p>
            <ul className="mt-3 space-y-1.5 pl-4 list-disc text-slate-600">
              <li><strong>Droit d&apos;accès</strong> — obtenir une copie de vos données personnelles</li>
              <li><strong>Droit de rectification</strong> — corriger des données inexactes</li>
              <li><strong>Droit à l&apos;effacement</strong> — demander la suppression de vos données (&laquo;&nbsp;droit à l&apos;oubli&nbsp;&raquo;)</li>
              <li><strong>Droit à la portabilité</strong> — recevoir vos données dans un format lisible par machine</li>
              <li><strong>Droit d&apos;opposition</strong> — vous opposer au traitement de vos données</li>
              <li><strong>Droit à la limitation</strong> — demander la limitation du traitement</li>
            </ul>
            <p className="mt-3">
              Pour exercer ces droits, contactez-nous à{" "}
              <a href="mailto:enesra92z@gmail.com" className="text-green-600 hover:underline">enesra92z@gmail.com</a>. Nous répondrons dans un délai maximum de 30 jours.
            </p>
            <p className="mt-2">
              Vous avez également le droit d&apos;introduire une réclamation auprès de la <strong>CNIL</strong> (Commission Nationale de l&apos;Informatique et des Libertés) si vous estimez que vos droits ne sont pas respectés.
            </p>
          </section>

          <section>
            <h2 className="text-[16px] font-semibold text-slate-900 mb-3">8. Sécurité des données</h2>
            <p>
              Nous mettons en œuvre des mesures techniques et organisationnelles appropriées pour protéger vos données contre tout accès non autorisé, perte, destruction ou divulgation :
            </p>
            <ul className="mt-3 space-y-1.5 pl-4 list-disc text-slate-600">
              <li>Chiffrement des mots de passe avec bcrypt</li>
              <li>Communications chiffrées via HTTPS/TLS</li>
              <li>Limitation du taux de requêtes (rate limiting)</li>
              <li>Accès aux données restreint au personnel autorisé</li>
            </ul>
          </section>

          <section>
            <h2 className="text-[16px] font-semibold text-slate-900 mb-3">9. Cookies</h2>
            <p>
              Comeback utilise des cookies strictement nécessaires au fonctionnement du service (session d&apos;authentification). Aucun cookie de traçage ou publicitaire n&apos;est utilisé.
            </p>
          </section>

          <section>
            <h2 className="text-[16px] font-semibold text-slate-900 mb-3">10. Contact DPO</h2>
            <p>
              Pour toute question relative à la protection de vos données personnelles :{" "}
              <a href="mailto:enesra92z@gmail.com" className="text-green-600 hover:underline">enesra92z@gmail.com</a>
            </p>
          </section>

        </div>

        <div className="mt-12 flex flex-wrap gap-4 border-t border-slate-100 pt-8 text-[12px] text-slate-400">
          <Link href="/login" className="hover:text-slate-600 transition-colors">Connexion</Link>
          <Link href="/mentions-legales" className="hover:text-slate-600 transition-colors">Mentions légales</Link>
          <Link href="/cgu" className="hover:text-slate-600 transition-colors">CGU</Link>
        </div>
      </div>
    </div>
  );
}

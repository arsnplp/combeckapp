import Link from "next/link";
import { Zap } from "lucide-react";

export default function MentionsLegalesPage() {
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

        <h1 className="text-[28px] font-bold text-slate-900 mb-8">Mentions légales</h1>

        <div className="space-y-8 text-[14px] leading-relaxed text-slate-700">

          <section>
            <h2 className="text-[16px] font-semibold text-slate-900 mb-3">Éditeur du site</h2>
            <p>Le site <strong>Comeback</strong> est édité par <strong>Nairox</strong>, entreprise individuelle.</p>
            <ul className="mt-3 space-y-1.5 pl-4 list-disc text-slate-600">
              <li>Site web : <a href="https://nairox.fr" className="text-green-600 hover:underline">nairox.fr</a></li>
              <li>Email de contact : <a href="mailto:enesra92z@gmail.com" className="text-green-600 hover:underline">enesra92z@gmail.com</a></li>
            </ul>
          </section>

          <section>
            <h2 className="text-[16px] font-semibold text-slate-900 mb-3">Hébergement</h2>
            <p>Le site est hébergé par :</p>
            <ul className="mt-3 space-y-1.5 pl-4 list-disc text-slate-600">
              <li><strong>OVH SAS</strong></li>
              <li>2 rue Kellermann — 59100 Roubaix, France</li>
              <li>Site : <a href="https://www.ovh.com" className="text-green-600 hover:underline">www.ovh.com</a></li>
            </ul>
            <p className="mt-3 text-slate-600">Le service est déployé sur un serveur dédié OVH situé en France.</p>
          </section>

          <section>
            <h2 className="text-[16px] font-semibold text-slate-900 mb-3">Propriété intellectuelle</h2>
            <p>
              L&apos;ensemble du contenu de ce site (textes, graphismes, logotypes, images, sons et vidéos) est la propriété exclusive de Nairox ou de ses partenaires et est protégé par les lois françaises et internationales relatives à la propriété intellectuelle.
            </p>
            <p className="mt-2">
              Toute reproduction, représentation, modification, publication, adaptation de tout ou partie des éléments du site, quel que soit le moyen ou le procédé utilisé, est interdite sans l&apos;autorisation préalable et écrite de Nairox.
            </p>
          </section>

          <section>
            <h2 className="text-[16px] font-semibold text-slate-900 mb-3">Responsabilité</h2>
            <p>
              Nairox s&apos;efforce d&apos;assurer l&apos;exactitude et la mise à jour des informations diffusées sur ce site. Toutefois, Nairox ne peut garantir l&apos;exactitude, la précision ou l&apos;exhaustivité des informations mises à disposition sur ce site.
            </p>
            <p className="mt-2">
              En conséquence, Nairox décline toute responsabilité pour toute imprécision, inexactitude ou omission portant sur des informations disponibles sur ce site.
            </p>
          </section>

          <section>
            <h2 className="text-[16px] font-semibold text-slate-900 mb-3">Droit applicable</h2>
            <p>
              Les présentes mentions légales sont soumises au droit français. En cas de litige et à défaut de résolution amiable, les tribunaux français seront seuls compétents.
            </p>
          </section>

          <section>
            <h2 className="text-[16px] font-semibold text-slate-900 mb-3">Contact</h2>
            <p>
              Pour toute question ou réclamation, vous pouvez nous contacter à l&apos;adresse suivante :{" "}
              <a href="mailto:enesra92z@gmail.com" className="text-green-600 hover:underline">enesra92z@gmail.com</a>
            </p>
          </section>

        </div>

        <div className="mt-12 flex flex-wrap gap-4 border-t border-slate-100 pt-8 text-[12px] text-slate-400">
          <Link href="/login" className="hover:text-slate-600 transition-colors">Connexion</Link>
          <Link href="/cgu" className="hover:text-slate-600 transition-colors">CGU</Link>
          <Link href="/politique-de-confidentialite" className="hover:text-slate-600 transition-colors">Politique de confidentialité</Link>
        </div>
      </div>
    </div>
  );
}

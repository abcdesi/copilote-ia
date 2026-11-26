import Link from "next/link";
import { SiteHeader } from "@/components/marketing/SiteHeader";

export const metadata = { title: "Pilotzia Agency | Automatisation des entreprises", description: "Découvrez les possibilités d'accompagnement et d'automatisation de Pilotzia." };

const services = [
  ["Commercial", "Qualification des demandes, suivi des prospects et relance des devis."],
  ["Administration", "Préparation de documents, suivi des échéances et réduction des saisies répétitives."],
  ["Relation client", "Qualification des messages, rendez-vous et transfert des demandes complexes."],
  ["Pilotage", "Connexion des outils, indicateurs et suivi des résultats."]
];

export default function AgencyPage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-6 py-16">
        <p className="text-sm font-semibold uppercase tracking-wide text-accent">Pilotzia Agency</p>
        <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight">Identifiez les processus que votre entreprise pourrait automatiser.</h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">Commencez par un diagnostic gratuit. Les intégrations, le périmètre et les conditions d'accompagnement sont à confirmer selon vos outils et vos besoins.</p>
        <Link href="/#diagnostic" className="mt-6 inline-flex rounded-xl bg-accent px-5 py-3 font-semibold text-white">Commencer le diagnostic gratuit</Link>
        <section className="mt-12 grid gap-4 sm:grid-cols-2" aria-label="Domaines d'automatisation">
          {services.map(([title, description]) => (
            <article key={title} className="rounded-2xl border border-border bg-card p-6">
              <h2 className="text-xl font-semibold">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
            </article>
          ))}
        </section>
        <section className="mt-12 rounded-2xl border border-border p-6">
          <h2 className="text-xl font-semibold">Un parcours progressif</h2>
          <p className="mt-3 text-muted-foreground">Diagnostic, validation du besoin, proposition adaptée, puis installation et mesure des résultats. Aucun déploiement ni achat n'est déclenché par le diagnostic.</p>
        </section>
      </main>
    </div>
  );
}

import { SiteHeader } from "@/components/marketing/SiteHeader";

export default function LegalNoticePage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-6 py-12 sm:py-16">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Informations légales</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Mentions légales</h1>
        <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900">
          Cette page est volontairement préparée sans inventer d'informations juridiques. Les éléments d'identification de l'éditeur doivent être complétés avant ouverture commerciale publique.
        </div>
        <div className="mt-10 space-y-7 text-sm leading-6 text-muted-foreground">
          <section><h2 className="font-semibold text-foreground">Éditeur</h2><p className="mt-2">Pilotzia — raison sociale / nom de l'exploitant, forme juridique, capital social le cas échéant, adresse du siège, SIREN/RCS, numéro de TVA et coordonnées à compléter.</p></section>
          <section><h2 className="font-semibold text-foreground">Directrice de la publication</h2><p className="mt-2">YERRO Maddy.</p></section>
          <section><h2 className="font-semibold text-foreground">Hébergement</h2><p className="mt-2">Les informations de l'hébergeur de production doivent être indiquées ici une fois l'architecture de production définitivement arrêtée.</p></section>
          <section><h2 className="font-semibold text-foreground">Contact</h2><p className="mt-2">Une adresse de contact dédiée devra être publiée pour les demandes contractuelles, légales et relatives aux données personnelles.</p></section>
          <section><h2 className="font-semibold text-foreground">Propriété intellectuelle</h2><p className="mt-2">Sauf mention contraire, les éléments composant Pilotzia, notamment la marque, le logiciel, les interfaces, textes, illustrations et modèles, sont protégés par les droits applicables.</p></section>
        </div>
      </main>
    </div>
  );
}

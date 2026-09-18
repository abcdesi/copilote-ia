import { SiteHeader } from "@/components/marketing/SiteHeader";

export default function LegalNoticePage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-6 py-12 sm:py-16">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Informations légales</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Mentions légales</h1>
        <p className="mt-4 text-sm leading-6 text-muted-foreground">Dernière mise à jour : 18 septembre 2026.</p>

        <div className="mt-10 space-y-7 text-sm leading-6 text-muted-foreground">
          <section>
            <h2 className="font-semibold text-foreground">Éditeur</h2>
            <p className="mt-2">
              Le service Pilotzia est édité par <strong className="text-foreground">EVOLUSS</strong>, société par actions simplifiée unipersonnelle (SASU),
              dont le siège social est situé <strong className="text-foreground">1 rue Marguerin, 75014 Paris, France</strong>.
            </p>
            <p className="mt-2">SIREN : 982 385 544 · SIRET : 982 385 544 00019.</p>
            <p className="mt-2">Représentante légale : <strong className="text-foreground">YERRO Maddy</strong>.</p>
            <p className="mt-2">Nom commercial et service : <strong className="text-foreground">Pilotzia</strong>.</p>
          </section>

          <section>
            <h2 className="font-semibold text-foreground">Directrice de la publication</h2>
            <p className="mt-2">YERRO Maddy.</p>
          </section>

          <section>
            <h2 className="font-semibold text-foreground">Hébergement</h2>
            <p className="mt-2">
              IONOS SARL — 7 Place de la Gare, BP 70109, 57200 Sarreguemines Cedex, France.
              Assistance IONOS France : 08 05 54 21 80.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-foreground">Contact</h2>
            <p className="mt-2">Contact général et contractuel : <a className="font-semibold text-accent" href="mailto:contact@pilotzia.com">contact@pilotzia.com</a>.</p>
            <p className="mt-1">Données personnelles : <a className="font-semibold text-accent" href="mailto:dpo-contact@pilotzia.com">dpo-contact@pilotzia.com</a>.</p>
          </section>

          <section>
            <h2 className="font-semibold text-foreground">Propriété intellectuelle</h2>
            <p className="mt-2">
              Sauf mention contraire, les éléments composant Pilotzia, notamment la marque, le logiciel, les interfaces, textes, illustrations,
              modèles et éléments de conception, sont protégés par les droits de propriété intellectuelle applicables.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-foreground">Portée du service</h2>
            <p className="mt-2">
              Pilotzia est commercialisé à destination de clients professionnels (B2B), principalement en France métropolitaine et dans les territoires français d'outre-mer.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}

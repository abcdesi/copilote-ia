import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Check, ShieldCheck } from "lucide-react";
import { SiteHeader } from "@/components/marketing/SiteHeader";
import { Button } from "@/components/ui/Button";
import { APP_NAME, SITE_URL } from "@/lib/config";
import { getMarketingSolution, MARKETING_SOLUTIONS } from "@/lib/marketing/solutions";

export function generateStaticParams() {
  return MARKETING_SOLUTIONS.map((solution) => ({ slug: solution.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const solution = getMarketingSolution(slug);
  if (!solution) return {};
  const title = solution.title;
  return {
    title,
    description: solution.description,
    alternates: { canonical: `/solutions/${solution.slug}` },
    openGraph: {
      type: "article",
      url: `/solutions/${solution.slug}`,
      title,
      description: solution.description,
    },
  };
}

export default async function SolutionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const solution = getMarketingSolution(slug);
  if (!solution) notFound();

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: solution.title,
    description: solution.description,
    provider: { "@type": "Organization", name: APP_NAME, url: SITE_URL },
    areaServed: "FR",
    serviceType: "Business AI software",
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main>
        <section className="mx-auto max-w-5xl px-6 pb-14 pt-10 sm:pb-20 sm:pt-16">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">{solution.eyebrow}</p>
            <h1 className="mt-3 text-balance text-4xl font-semibold tracking-tight sm:text-5xl">{solution.title}</h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">{solution.description}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button href="/#diagnostic" size="lg">
                Tester sur mon entreprise <ArrowRight size={17} />
              </Button>
              <Button href="/signup" variant="outline" size="lg">
                Créer mon espace gratuitement
              </Button>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Diagnostic initial gratuit · Sans carte bancaire · Essai IA borné ensuite</p>
          </div>
        </section>

        <section className="border-y border-border bg-card/60">
          <div className="mx-auto grid max-w-5xl gap-8 px-6 py-12 md:grid-cols-2 sm:py-16">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Le problème</p>
              <p className="mt-3 text-base leading-7 text-foreground/85">{solution.problem}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Le résultat visé</p>
              <p className="mt-3 text-base leading-7 text-foreground/85">{solution.outcome}</p>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-6 py-14 sm:py-20">
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Signaux à surveiller</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {solution.signals.map((signal) => (
                  <span key={signal} className="rounded-full border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground">
                    {signal}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Comment Pilotzia raisonne</p>
              <div className="mt-4 space-y-3">
                {solution.approach.map((step, index) => (
                  <div key={step} className="flex gap-3 rounded-xl border border-border bg-card p-4">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent">{index + 1}</span>
                    <p className="text-sm leading-6 text-foreground/85">{step}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-10 rounded-2xl border border-accent/20 bg-accent-soft p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <ShieldCheck size={20} className="mt-0.5 shrink-0 text-accent" />
              <div>
                <p className="font-semibold">Conseil traçable, pas chiffres inventés</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{solution.proofNote}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-border bg-card/60">
          <div className="mx-auto max-w-4xl px-6 py-14 text-center sm:py-20">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Voyez ce que Pilotzia détecte avec votre contexte réel</h2>
            <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
              Le diagnostic public donne une première hypothèse. Après inscription, Pilotzia enrichit progressivement le diagnostic avec vos outils, vos volumes et les faits réellement observés.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Button href="/#diagnostic">Faire le diagnostic gratuit</Button>
              <Link href="/faq" className="inline-flex items-center gap-1 text-sm font-semibold text-accent">
                Comprendre Pilotzia <Check size={14} />
              </Link>
            </div>
          </div>
        </section>
      </main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SiteHeader } from "@/components/marketing/SiteHeader";
import { MARKETING_SOLUTIONS } from "@/lib/marketing/solutions";

export const metadata: Metadata = {
  title: "Solutions — ventes, finance, opérations et direction",
  description:
    "Découvrez comment Pilotzia raisonne sur la relance prospects, le recouvrement, l'onboarding client et le pilotage financier à partir du contexte réel de l'entreprise.",
  alternates: { canonical: "/solutions" },
  openGraph: {
    url: "/solutions",
    title: "Solutions Pilotzia",
    description: "Des cas d'usage business reliés au contexte réel, au niveau de preuve et à la mesure des résultats.",
  },
};

export default function SolutionsPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-6 py-12 sm:py-16">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Solutions</p>
          <h1 className="mt-2 text-balance text-3xl font-semibold tracking-tight sm:text-5xl">Commencez par le problème business que vous voulez résoudre</h1>
          <p className="mt-4 text-lg leading-8 text-muted-foreground">
            Pilotzia ne part pas d'une bibliothèque de fonctionnalités. Il part du résultat recherché, cherche les faits qui manquent, puis relie diagnostic, action et mesure.
          </p>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {MARKETING_SOLUTIONS.map((solution) => (
            <Link key={solution.slug} href={`/solutions/${solution.slug}`} className="group rounded-2xl border border-border bg-card p-6 transition-colors hover:border-accent/40">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">{solution.eyebrow}</p>
              <h2 className="mt-2 text-xl font-semibold leading-7">{solution.title}</h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{solution.description}</p>
              <span className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-accent">Voir la méthode <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" /></span>
            </Link>
          ))}
        </div>

        <section className="mt-12 rounded-2xl border border-accent/20 bg-accent-soft p-6 text-center sm:p-8">
          <h2 className="text-xl font-semibold">Votre problème ne rentre pas dans une case ?</h2>
          <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Décrivez-le directement. La première lecture est gratuite et Pilotzia vous dira ce qu'il peut raisonnablement déduire — et ce qu'il doit encore apprendre.</p>
          <Link href="/#diagnostic" className="mt-5 inline-flex rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground">Poser ma question</Link>
        </section>
      </main>
    </div>
  );
}

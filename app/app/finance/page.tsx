import { ArrowRight, BrainCircuit, FileSearch, ShieldCheck, TrendingUp } from "lucide-react";
import { auth } from "@/lib/auth";
import { getCurrentCompany } from "@/lib/companies/current";
import { isPilotziaAdmin } from "@/lib/admin/access";
import { getCompanyEntitlements } from "@/lib/billing/entitlements";
import { FinancialAuditUpload } from "@/components/finance/FinancialAuditUpload";
import { Button } from "@/components/ui/Button";

export default async function FinancePage() {
  const [session, company] = await Promise.all([auth(), getCurrentCompany()]);
  const entitlements = await getCompanyEntitlements(company.id);
  const access = entitlements.canUseFinancialAudit || isPilotziaAdmin(session?.user?.email);

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Scale · Intelligence financière</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Des états financiers aux questions et décisions opérationnelles</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          Pilotzia ne se contente pas de résumer un bilan. Il extrait les postes disponibles, calcule des ratios déterministes, signale les limites de preuve et cherche les causes opérationnelles à investiguer avant de recommander une action.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <ValueCard icon={FileSearch} title="Lire & normaliser" body="Bilan ou compte de résultat PDF, unités et période comprises lorsque le document le permet." />
        <ValueCard icon={BrainCircuit} title="Auditer & questionner" body="Ratios, alertes, données manquantes et questions de clarification plutôt qu'une conclusion automatique." />
        <ValueCard icon={TrendingUp} title="Prioriser" body="Relier trésorerie, marge, risque et productivité aux prochaines investigations et automatisations possibles." />
      </div>

      {access ? (
        <FinancialAuditUpload />
      ) : (
        <section className="rounded-2xl border border-accent/20 bg-accent-soft p-6 sm:p-8">
          <div className="flex items-start gap-3">
            <ShieldCheck size={22} className="mt-0.5 shrink-0 text-accent" />
            <div className="max-w-3xl">
              <h2 className="text-lg font-semibold">L'audit financier documentaire est inclus dans Scale</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Scale ajoute la profondeur nécessaire aux analyses de direction : lecture de documents financiers, ratios traçables, questions d'audit et priorités reliées aux processus de l'entreprise. Le document brut n'est pas conservé par cette fonctionnalité.
              </p>
              <div className="mt-5">
                <Button href="/app/settings">Voir Scale à 249 €/mois <ArrowRight size={16} /></Button>
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <h2 className="font-semibold">Ce que Pilotzia cherchera ensuite</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Un état financier isolé ne suffit pas à diriger une entreprise. La prochaine étape est de comparer plusieurs périodes, relier les écarts aux ventes, opérations et processus, puis vérifier quelles actions ont réellement amélioré la marge, la trésorerie ou le temps mobilisé. C'est cette boucle qui transforme un lecteur de PDF en système de décision.
        </p>
      </section>
    </div>
  );
}

function ValueCard({ icon: Icon, title, body }: { icon: typeof FileSearch; title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-soft text-accent"><Icon size={17} /></div>
      <h2 className="mt-3 font-semibold">{title}</h2>
      <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{body}</p>
    </div>
  );
}

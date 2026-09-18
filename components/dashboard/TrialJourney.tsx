import { ArrowRight, Check, Clock3, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface TrialJourneyProps {
  paid: boolean;
  trialStartedAt: Date | null;
  trialEndsAt: Date | null;
  trialActive: boolean;
  trialExpired: boolean;
  creditsUsed: number;
  creditsLimit: number;
  hasCompanyContext: boolean;
  hasConnection: boolean;
  opportunitiesCount: number;
  pendingActionsCount: number;
  activeAutomationsCount: number;
  hasMeasuredOutcome: boolean;
  totalHoursPerMonth: number;
}

function daysBetween(start: Date, end: Date) {
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 86_400_000));
}

function formatDate(value: Date | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(value);
}

export function TrialJourney(props: TrialJourneyProps) {
  if (props.paid) return null;

  const now = new Date();
  const day = props.trialStartedAt ? Math.min(14, daysBetween(props.trialStartedAt, now) + 1) : 0;
  const remainingDays = props.trialEndsAt ? Math.max(0, Math.ceil((props.trialEndsAt.getTime() - now.getTime()) / 86_400_000)) : 14;

  const milestones = [
    {
      done: props.hasCompanyContext,
      label: "Donner le contexte de votre entreprise",
      detail: "Objectifs, irritants et priorités pour obtenir des recommandations crédibles.",
      href: "/app/company",
    },
    {
      done: props.hasConnection,
      label: "Connecter une première source réelle",
      detail: "Pilotzia commence à raisonner sur ce qui se passe vraiment dans votre entreprise.",
      href: "/app/tools",
    },
    {
      done: props.opportunitiesCount > 0,
      label: "Identifier votre premier levier prioritaire",
      detail: "Une recommandation reliée à un gain de temps ou à un résultat business.",
      href: "/app/opportunities",
    },
    {
      done: props.pendingActionsCount > 0 || props.activeAutomationsCount > 0,
      label: "Passer du conseil à l'action",
      detail: "Préparer une action ou une automatisation, avec validation avant exécution sensible.",
      href: props.pendingActionsCount > 0 ? "/app/actions" : "/app/opportunities",
    },
    {
      done: props.hasMeasuredOutcome,
      label: "Mesurer une première valeur réelle",
      detail: "Suivre ce qui fonctionne, le temps récupéré et les prochaines améliorations.",
      href: "/app/results",
    },
  ];

  const completed = milestones.filter((m) => m.done).length;
  const next = milestones.find((m) => !m.done);

  let title = "Transformez votre essai en preuve de valeur";
  let body = "Commencez gratuitement. Pilotzia devient vraiment utile à mesure qu'il comprend votre contexte, observe vos outils et vous aide à agir.";
  let phase = "Avant le démarrage";

  if (props.trialExpired) {
    phase = "Essai terminé";
    title = "Votre travail n'est pas perdu";
    body = "Votre contexte, vos connexions et votre historique restent disponibles. Un abonnement réactive l'analyse continue et les actions.";
  } else if (props.trialActive) {
    if (day <= 3) {
      phase = `Jour ${day} · Comprendre`;
      title = "Donnez à Pilotzia assez de contexte pour être pertinent";
      body = "Le début de l'essai sert à remplacer les suppositions par des recommandations fondées sur votre entreprise réelle.";
    } else if (day <= 7) {
      phase = `Jour ${day} · Prioriser`;
      title = "Faites ressortir les 1 à 3 leviers qui comptent vraiment";
      body = "Pilotzia doit maintenant vous montrer où se trouvent le meilleur rapport impact, temps gagné et effort.";
    } else if (day <= 10) {
      phase = `Jour ${day} · Agir`;
      title = "Passez de la recommandation à une action concrète";
      body = "Testez une première action contrôlée. C'est ici que le potentiel devient une preuve de fonctionnement.";
    } else {
      phase = `Jour ${day} · Mesurer`;
      title = "Décidez avec des preuves, pas avec une promesse";
      body = "Regardez ce que Pilotzia a compris, préparé ou automatisé et choisissez le niveau d'accompagnement qui vaut réellement le coût pour votre entreprise.";
    }
  }

  const usagePct = props.creditsLimit > 0 ? Math.min(100, Math.round((props.creditsUsed / props.creditsLimit) * 100)) : 0;

  return (
    <section className="rounded-2xl border border-accent/20 bg-accent-soft p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-accent">
            <Sparkles size={14} /> {phase}
          </div>
          <h2 className="mt-2 text-xl font-semibold tracking-tight">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
        </div>
        <div className="min-w-[170px] rounded-xl border border-border bg-card px-4 py-3">
          <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <span>{props.trialActive ? `${remainingDays} j restants` : props.trialExpired ? "Essai terminé" : "14 jours disponibles"}</span>
            <Clock3 size={14} />
          </div>
          <p className="mt-1 text-sm font-semibold">{props.creditsLimit - props.creditsUsed} crédits disponibles</p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-accent" style={{ width: `${usagePct}%` }} />
          </div>
          {props.trialEndsAt && <p className="mt-2 text-[11px] text-muted-foreground">Fin prévue : {formatDate(props.trialEndsAt)}</p>}
        </div>
      </div>

      <div className="mt-5 grid gap-2 lg:grid-cols-5">
        {milestones.map((item, index) => (
          <a key={item.label} href={item.href} className="rounded-xl border border-border bg-card p-3 transition hover:border-accent/40">
            <div className="flex items-center gap-2">
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold ${item.done ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
                {item.done ? <Check size={12} /> : index + 1}
              </span>
              <p className="text-xs font-semibold">{item.label}</p>
            </div>
            <p className="mt-2 text-[11px] leading-5 text-muted-foreground">{item.detail}</p>
          </a>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-accent/10 pt-4">
        <p className="text-xs text-muted-foreground">
          {completed}/5 étapes de preuve de valeur · {props.totalHoursPerMonth > 0 ? `~${props.totalHoursPerMonth} h/mois déjà identifiées ou actives` : "la valeur se précise avec votre contexte réel"}
        </p>
        <div className="flex flex-wrap gap-2">
          {next && !props.trialExpired && (
            <Button href={next.href} size="sm" variant="outline">
              Prochaine étape <ArrowRight size={14} />
            </Button>
          )}
          <Button href="/app/settings" size="sm">
            {props.trialExpired ? "Réactiver Pilotzia" : day >= 8 ? "Voir ce que débloque Action" : "Comparer les options"}
            <ArrowRight size={14} />
          </Button>
        </div>
      </div>
    </section>
  );
}

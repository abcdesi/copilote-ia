import Link from "next/link";
import { CheckCircle2, CreditCard, Database, LifeBuoy, Settings2, ShieldCheck, Wrench } from "lucide-react";
import { getCurrentCompanyAccess, hasCompanyPermission } from "@/lib/companies/access";
import { prisma } from "@/lib/db/client";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

const HELP_CARDS = [
  {
    icon: CreditCard,
    title: "Abonnement & crédits",
    body: "Suivez votre capacité, achetez des crédits additionnels ou changez d'offre depuis Paramètres.",
    href: "/app/settings",
    label: "Gérer mon abonnement",
  },
  {
    icon: Database,
    title: "Données & contexte",
    body: "Vérifiez ce que Pilotzia connaît, les sources utilisées et les informations à compléter.",
    href: "/app/context",
    label: "Voir le contexte IA",
  },
  {
    icon: ShieldCheck,
    title: "Confidentialité & droits",
    body: "Demandez l’accès, l’export, la rectification ou l’effacement des données concernées. Pilotzia conserve uniquement ce qui doit l’être pour la sécurité, la preuve ou les obligations légales.",
    href: "/app/support?category=privacy",
    label: "Faire une demande",
  },
  {
    icon: Wrench,
    title: "Connexions & outils",
    body: "Reconnectez un fournisseur, lancez une synchronisation ou contrôlez les autorisations.",
    href: "/app/tools",
    label: "Voir mes connexions",
  },
  {
    icon: Settings2,
    title: "Une réponse ne semble pas logique",
    body: "Complétez d'abord le contexte de l'entreprise. Si le problème persiste, ouvrez un ticket ci-dessous avec l'exemple précis.",
    href: "/app/company",
    label: "Vérifier mon entreprise",
  },
] as const;

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(value);
}

function statusLabel(status: string) {
  if (status === "resolved") return "Résolu";
  if (status === "in_progress") return "En cours";
  return "Ouvert";
}

export default async function SupportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const access = await getCurrentCompanyAccess();
  const company = access.company;
  const params = await searchParams;
  const canManageBilling = hasCompanyPermission(access.role, "manage_billing");
  const canSeeCompanyTickets = access.role === "owner" || access.role === "admin";
  const sent = params.sent === "1";
  const requestedCategory = typeof params.category === "string" && ["technical", "billing", "data", "privacy", "automation", "feature", "other"].includes(params.category) ? params.category : "technical";
  const requesterEmail = access.session.user.email ?? null;
  const tickets = await prisma.supportRequest.findMany({
    where: {
      companyId: company.id,
      ...(canSeeCompanyTickets && requesterEmail
        ? {
            OR: [
              { category: { not: "privacy" } },
              { category: "privacy", requesterEmail },
            ],
          }
        : requesterEmail
          ? { requesterEmail }
          : { id: "__none__" }),
    },
    orderBy: { createdAt: "desc" },
    take: 8,
  });

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent"><LifeBuoy size={20} /></div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Assistance</h1>
          <p className="mt-1 text-sm text-muted-foreground">Trouvez la solution immédiatement quand c'est possible, puis transmettez le minimum utile à l'équipe si une intervention est nécessaire.</p>
        </div>
      </div>

      {sent && (
        <div className="flex items-start gap-3 rounded-2xl border border-success/20 bg-success/5 p-4 text-sm">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-success" />
          <div><p className="font-semibold">Demande envoyée</p><p className="mt-1 text-muted-foreground">Le ticket est enregistré dans Pilotzia. Son contexte d'abonnement a été joint automatiquement.</p></div>
        </div>
      )}

      <section>
        <h2 className="font-semibold">Résoudre rapidement</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {HELP_CARDS.map(({ icon: Icon, title, body, href, label }) => {
            const billingCard = title === "Abonnement & crédits";
            const effectiveBody = billingCard && !canManageBilling
              ? "Consultez la capacité de l'entreprise. Seul le Propriétaire peut acheter des crédits ou modifier l'abonnement."
              : body;
            const effectiveLabel = billingCard && !canManageBilling ? "Voir l'usage" : label;
            return (
            <div key={title} className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent"><Icon size={17} /></div>
                <div>
                  <h3 className="font-semibold">{title}</h3>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{effectiveBody}</p>
                  <Link href={href} className="mt-3 inline-flex text-sm font-semibold text-accent hover:underline">{effectiveLabel}</Link>
                </div>
              </div>
            </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Pour les questions générales, la <Link href="/faq" className="font-semibold text-accent hover:underline">FAQ Pilotzia</Link> reste accessible sans ouvrir de ticket.</p>
      </section>

      <section className="rounded-2xl border border-border bg-card p-6">
        <h2 className="font-semibold">Contacter l'assistance</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">Décrivez le résultat attendu et ce qui s'est passé. Pilotzia joint automatiquement votre plan, votre période et l'état de vos crédits — jamais vos clés API, mots de passe ou PDF bruts.</p>
        <form method="post" action="/api/support" className="mt-5 grid gap-4">
          <label className="grid gap-1.5 text-sm font-medium">
            Catégorie
            <select name="category" defaultValue={requestedCategory} className="h-10 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-accent">
              <option value="technical">Problème technique</option>
              <option value="billing">Facturation & crédits</option>
              <option value="data">Données & contexte</option>
              <option value="privacy">Confidentialité & droits sur les données</option>
              <option value="automation">Automatisation & action</option>
              <option value="feature">Question produit</option>
              <option value="other">Autre</option>
            </select>
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Sujet
            <input name="subject" required minLength={3} maxLength={120} className="h-10 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-accent" placeholder="Ex. Mon analyse Finance ne se lance plus" />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Détails
            <textarea name="message" required minLength={10} maxLength={5000} rows={6} className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm leading-6 outline-none focus:border-accent" placeholder="Ce que je voulais faire, ce que j'ai observé, et le message affiché s'il y en a un." />
          </label>
          <div><Button type="submit">Envoyer la demande</Button></div>
        </form>
      </section>

      {tickets.length > 0 && (
        <section>
          <h2 className="font-semibold">{canSeeCompanyTickets ? "Demandes récentes de l’entreprise" : "Mes demandes récentes"}</h2>
          <div className="mt-4 space-y-3">
            {tickets.map((ticket) => (
              <div key={ticket.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><p className="font-medium">{ticket.subject}</p><p className="mt-1 text-xs text-muted-foreground">{formatDate(ticket.createdAt)} · {ticket.category}</p></div>
                  <Badge tone={ticket.status === "resolved" ? "success" : ticket.status === "in_progress" ? "accent" : "neutral"}>{statusLabel(ticket.status)}</Badge>
                </div>
                <p className="mt-3 line-clamp-2 text-sm leading-6 text-muted-foreground">{ticket.message}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

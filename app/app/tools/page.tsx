import { AlertCircle, CheckCircle2, Cloud, LockKeyhole, Plus, RefreshCcw, ShieldCheck, Unplug, X } from "lucide-react";
import { getDashboardShellAccess, hasCompanyPermission } from "@/lib/companies/access";
import { safeRead } from "@/lib/runtime/safe-read";
import { addToolAction, removeToolAction } from "@/lib/companies/actions";
import { KNOWN_TOOLS } from "@/lib/automations/types";
import { getIntegrationDefinition } from "@/lib/integrations/registry";
import {
  integrationConnectionStateLabel,
  integrationConnectionStateTone,
  normalizeIntegrationConnectionState,
  type IntegrationConnectionState,
} from "@/lib/integrations/connection-framework";
import {
  GOOGLE_SCOPES,
  getGoogleConfigurationStatus,
  googleRedirectUri,
  parseStoredGoogleScopes,
} from "@/lib/integrations/google";
import { getHubSpotConfigurationStatus, hubspotRedirectUri, hubspotWebhookUrl } from "@/lib/integrations/hubspot";
import { stripeBusinessWebhookUrl } from "@/lib/integrations/stripe-business";
import { prisma } from "@/lib/db/client";
import { APP_NAME } from "@/lib/config";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

function formatSync(date: Date | null) {
  if (!date) return "Aucune synchronisation réelle effectuée";
  return `Dernière synchronisation réelle : ${new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date)}`;
}

const GOOGLE_MESSAGES: Record<string, { tone: "success" | "warning" | "danger" | "accent"; title: string; body: string }> = {
  connected: {
    tone: "success",
    title: "Google Workspace est connecté",
    body: "L'autorisation a été enregistrée et une première synchronisation Gmail / Calendar a réussi.",
  },
  synced: {
    tone: "success",
    title: "Synchronisation terminée",
    body: "Le contexte opérationnel Google a été actualisé et transmis au Business Graph.",
  },
  disconnected: {
    tone: "accent",
    title: "Google Workspace est déconnecté",
    body: "Pilotzia n'utilise plus les jetons stockés pour ce compte.",
  },
  cancelled: {
    tone: "accent",
    title: "Connexion annulée",
    body: "Aucune nouvelle autorisation Google n'a été enregistrée.",
  },
  "connected-sync-error": {
    tone: "warning",
    title: "Google est autorisé, mais la synchronisation a échoué",
    body: "La connexion est conservée. Relancez la synchronisation ci-dessous ; si l'erreur persiste, vérifiez que les API Gmail et Calendar sont activées dans le projet Google OAuth.",
  },
  "reauth-required": {
    tone: "warning",
    title: "Google doit être reconnecté",
    body: "Le jeton n'est plus utilisable. Reconnectez le compte pour renouveler l'autorisation.",
  },
  "scope-or-api-error": {
    tone: "warning",
    title: "Google refuse l'accès à une API demandée",
    body: "Vérifiez que Gmail API et Google Calendar API sont activées et que le compte est autorisé dans l'écran de consentement OAuth.",
  },
  "permission-denied": {
    tone: "danger",
    title: "Permission Pilotzia insuffisante",
    body: "Seul un propriétaire ou un administrateur peut connecter ou déconnecter un compte Google.",
  },
  "config-error": {
    tone: "danger",
    title: "Configuration Google incomplète côté Pilotzia",
    body: "La connexion est désactivée tant que les paramètres OAuth et le chiffrement des jetons ne sont pas correctement configurés.",
  },
  "secure-storage-error": {
    tone: "danger",
    title: "Stockage sécurisé indisponible",
    body: "Pilotzia a refusé d'enregistrer les jetons Google car le chiffrement serveur n'est pas correctement configuré.",
  },
  "token-error": {
    tone: "danger",
    title: "Google n'a pas pu finaliser l'autorisation",
    body: "Le code OAuth n'a pas pu être échangé. Vérifiez notamment l'URL de redirection configurée dans Google Cloud.",
  },
  "state-error": {
    tone: "danger",
    title: "Session OAuth invalide ou expirée",
    body: "Recommencez la connexion depuis cette page. Pilotzia n'a enregistré aucun accès issu de cette tentative.",
  },
  "profile-error": {
    tone: "danger",
    title: "Profil Google inaccessible",
    body: "Google a autorisé l'échange mais n'a pas permis de lire l'identité du compte connecté.",
  },
  "provider-error": {
    tone: "danger",
    title: "Google a refusé la connexion",
    body: "Le fournisseur OAuth a renvoyé une erreur. Vérifiez la configuration du projet Google et les utilisateurs de test.",
  },
  "invalid-response": {
    tone: "danger",
    title: "Réponse Google incomplète",
    body: "Aucun code OAuth exploitable n'a été reçu. Recommencez la connexion depuis Pilotzia.",
  },
  "start-error": {
    tone: "danger",
    title: "Impossible de démarrer la connexion Google",
    body: "Pilotzia a bloqué le démarrage avant toute autorisation. Vérifiez la configuration technique de l'intégration.",
  },
  "callback-error": {
    tone: "danger",
    title: "Connexion Google non finalisée",
    body: "Une erreur inattendue est survenue pendant le retour OAuth. Aucun secret n'est affiché ici ; utilisez l'assistance si elle persiste.",
  },
  "disconnect-error": {
    tone: "danger",
    title: "Déconnexion incomplète",
    body: "Pilotzia n'a pas pu terminer proprement la déconnexion. Réessayez ou contactez l'assistance.",
  },
};

const HUBSPOT_MESSAGES: Record<string, { tone: "success" | "warning" | "danger" | "accent"; title: string; body: string }> = {
  connected: { tone: "success", title: "HubSpot est connecté", body: "Pilotzia peut lire les contacts et les deals pour observer les opportunités gagnées reliées à une relance." },
  disconnected: { tone: "accent", title: "HubSpot est déconnecté", body: "Les jetons HubSpot locaux ont été supprimés et ne seront plus utilisés." },
  cancelled: { tone: "accent", title: "Connexion HubSpot annulée", body: "Aucune nouvelle autorisation n'a été enregistrée." },
  "permission-denied": { tone: "danger", title: "Permission Pilotzia insuffisante", body: "Seul un propriétaire ou un administrateur peut gérer HubSpot." },
  "config-error": { tone: "danger", title: "Configuration HubSpot incomplète", body: "Les identifiants OAuth ou le chiffrement serveur ne sont pas prêts." },
  "secure-storage-error": { tone: "danger", title: "Stockage sécurisé indisponible", body: "Pilotzia a refusé de conserver les jetons HubSpot sans chiffrement valide." },
  "token-error": { tone: "danger", title: "Autorisation HubSpot non finalisée", body: "L'échange du code OAuth avec HubSpot a échoué." },
  "state-error": { tone: "danger", title: "Session OAuth HubSpot invalide", body: "Recommencez la connexion depuis cette page." },
  "account-error": { tone: "danger", title: "Compte HubSpot non identifié", body: "L'autorisation a réussi mais le portail HubSpot n'a pas pu être identifié." },
  "provider-error": { tone: "danger", title: "HubSpot a refusé la connexion", body: "Le fournisseur OAuth a renvoyé une erreur." },
  "invalid-response": { tone: "danger", title: "Réponse HubSpot incomplète", body: "Aucun code OAuth exploitable n'a été reçu." },
  "start-error": { tone: "danger", title: "Impossible de démarrer HubSpot", body: "Pilotzia a bloqué la connexion avant toute autorisation." },
  "callback-error": { tone: "danger", title: "Connexion HubSpot non finalisée", body: "Une erreur inattendue est survenue pendant le retour OAuth." },
  "disconnect-error": { tone: "danger", title: "Déconnexion HubSpot incomplète", body: "Réessayez la déconnexion ou contactez l'assistance." },
};

const STRIPE_BUSINESS_MESSAGES: Record<string, { tone: "success" | "warning" | "danger" | "accent"; title: string; body: string }> = {
  connected: { tone: "success", title: "Stripe métier est connecté", body: "Les factures payées signées peuvent maintenant fermer la boucle de preuve des relances de factures." },
  disconnected: { tone: "accent", title: "Stripe métier est déconnecté", body: "Pilotzia n'accepte plus les événements de ce webhook." },
  "permission-denied": { tone: "danger", title: "Permission Pilotzia insuffisante", body: "Seul un propriétaire ou un administrateur peut gérer Stripe métier." },
  "config-error": { tone: "danger", title: "Secret Stripe métier invalide", body: "Utilisez le secret de signature whsec_ du webhook dédié aux factures payées." },
  "disconnect-error": { tone: "danger", title: "Déconnexion Stripe métier incomplète", body: "Réessayez ou contactez l'assistance." },
};

export default async function ToolsPage({
  searchParams,
}: {
  searchParams: Promise<{ google?: string; hubspot?: string; stripeBusiness?: string }>;
}) {
  const access = await getDashboardShellAccess();
  const companyTools = await safeRead(
    "tools.company-tools",
    () =>
      prisma.companyTool.findMany({
        where: { companyId: access.company.id },
        select: { id: true, name: true, detected: true },
        orderBy: { name: "asc" },
      }),
    []
  );
  const company = { ...access.company, tools: companyTools };
  const params = await searchParams;
  const googleMessage = params.google ? GOOGLE_MESSAGES[params.google] : null;
  const hubspotMessage = params.hubspot ? HUBSPOT_MESSAGES[params.hubspot] : null;
  const stripeBusinessMessage = params.stripeBusiness ? STRIPE_BUSINESS_MESSAGES[params.stripeBusiness] : null;
  const googleConfiguration = getGoogleConfigurationStatus();
  const hubspotConfiguration = getHubSpotConfigurationStatus();
  const canManageGoogle = hasCompanyPermission(access.role, "manage_integrations");
  const canManageIntegrations = hasCompanyPermission(access.role, "manage_integrations");
  const canSyncGoogle = hasCompanyPermission(access.role, "sync_integrations");

  const connections = await safeRead(
    "tools.connections",
    () =>
      prisma.integrationConnection.findMany({
        where: { companyId: company.id },
        select: {
          id: true,
          provider: true,
          accountLabel: true,
          status: true,
          scopes: true,
          lastSyncedAt: true,
          lastError: true,
        },
      }),
    []
  );
  const google = connections.find((connection) => connection.provider === "google");
  const googleScopes = parseStoredGoogleScopes(google?.scopes);
  const workspaceRequiredScopes = GOOGLE_SCOPES.filter(
    (scope) => scope.includes("gmail.") || scope.includes("calendar.")
  );
  const googleRequirementsSatisfied = workspaceRequiredScopes.every((scope) => googleScopes.includes(scope));
  const googleState = normalizeIntegrationConnectionState(google, {
    requirementsSatisfied: !google || googleRequirementsSatisfied,
  });
  const googleConnected = googleState === "connected" || googleState === "degraded";
  const googleNeedsReauth = googleState === "needs_reauth";
  const googleRedirect = googleConfiguration.configured ? googleRedirectUri() : null;
  const hubspot = connections.find((connection) => connection.provider === "hubspot");
  const hubspotState = normalizeIntegrationConnectionState(hubspot);
  const hubspotConnected = hubspotState === "connected" || hubspotState === "degraded";
  const hubspotNeedsReauth = hubspotState === "needs_reauth";
  const hubspotRedirect = hubspotConfiguration.configured ? hubspotRedirectUri() : null;
  const stripeBusiness = connections.find((connection) => connection.provider === "stripe_business");
  const stripeBusinessState = normalizeIntegrationConnectionState(stripeBusiness);
  const stripeBusinessConnected = stripeBusinessState === "connected" || stripeBusinessState === "degraded";
  const stripeWebhook = stripeBusinessWebhookUrl(company.id);
  const currentNames = new Set(company.tools.map((t) => t.name));
  const suggestions = KNOWN_TOOLS.filter((t) => !currentNames.has(t));

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Contexte opérationnel</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Outils & connexions</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Renseignez les applications utilisées par votre entreprise puis connectez uniquement celles dont {APP_NAME}
          a besoin pour observer ou agir. Les permissions sont explicites et les actions sensibles restent soumises à validation.
        </p>
      </div>

      {googleMessage && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex gap-3">
            <AlertCircle size={18} className={googleMessage.tone === "danger" ? "mt-0.5 text-danger" : googleMessage.tone === "warning" ? "mt-0.5 text-warning" : "mt-0.5 text-accent"} />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold">{googleMessage.title}</p>
                <Badge tone={googleMessage.tone}>{params.google}</Badge>
              </div>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{googleMessage.body}</p>
            </div>
          </div>
        </div>
      )}
      {hubspotMessage && (
        <ConnectionMessage message={hubspotMessage} code={params.hubspot} />
      )}
      {stripeBusinessMessage && (
        <ConnectionMessage message={stripeBusinessMessage} code={params.stripeBusiness} />
      )}

      <div className="rounded-2xl border border-accent/20 bg-accent-soft p-5">
        <div className="flex gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-card text-accent">
            <ShieldCheck size={17} />
          </div>
          <div>
            <p className="font-semibold">Vos outils, vos comptes, vos abonnements</p>
            <p className="mt-1 text-sm leading-6 text-foreground/75">
              Une application renseignée n'est jamais présentée comme connectée. Votre entreprise conserve son compte,
              son abonnement et sa relation avec chaque fournisseur ; Pilotzia ne souscrit jamais HubSpot, Google Workspace,
              Stripe, Slack ou un autre logiciel à votre place. Pilotzia utilise uniquement les accès que vous autorisez,
              avec des permissions explicites et révocables.
            </p>
          </div>
        </div>
      </div>

      <section className="rounded-2xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Cloud size={18} className="text-accent" />
              <h2 className="font-semibold">Google Workspace</h2>
              <ConnectionStateBadge state={googleState} connectedLabel="Connecté · lecture seule" />
            </div>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
              Gmail et Google Calendar alimentent le contexte opérationnel. La connexion initiale est limitée à la lecture ;
              aucune création, modification ou envoi n'est autorisé implicitement.
            </p>
            {google && (
              <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                <p>Compte : {google.accountLabel ?? "Compte Google"}</p>
                <p>{formatSync(google.lastSyncedAt)}</p>
                {googleNeedsReauth && <p className="font-medium text-warning">Le compte doit être reconnecté avant la prochaine lecture.</p>}
                {google.lastError && !googleNeedsReauth && (
                  <p className="font-medium text-warning">La dernière tentative a rencontré une erreur. Relancez la synchronisation.</p>
                )}
              </div>
            )}
            {!googleConfiguration.configured && canManageGoogle && (
              <p className="mt-3 text-xs font-medium text-danger">
                Configuration serveur Google incomplète : connexion temporairement indisponible.
              </p>
            )}
            {googleRedirect && canManageGoogle && (
              <div className="mt-3 rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                <p className="font-medium text-foreground">Callback OAuth à autoriser dans Google Cloud</p>
                <code className="mt-1 block break-all">{googleRedirect}</code>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {googleConnected && canSyncGoogle && (
              <form method="post" action="/api/integrations/google/sync">
                <button className="inline-flex items-center gap-2 rounded-xl border border-border px-3.5 py-2 text-sm font-medium transition-colors hover:bg-muted">
                  <RefreshCcw size={15} /> Synchroniser
                </button>
              </form>
            )}
            {(googleNeedsReauth || !googleConnected) && canManageGoogle && googleConfiguration.configured && (
              <a
                href="/api/integrations/google/connect"
                className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90"
              >
                <RefreshCcw size={15} /> {googleNeedsReauth ? "Reconnecter Google" : "Connecter Google"}
              </a>
            )}
            {googleConnected && canManageGoogle && (
              <form method="post" action="/api/integrations/google/disconnect">
                <button className="inline-flex items-center gap-2 rounded-xl border border-border px-3.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-danger">
                  <Unplug size={15} /> Déconnecter
                </button>
              </form>
            )}
            {!canManageGoogle && !googleConnected && (
              <span className="rounded-xl border border-border px-3.5 py-2 text-xs text-muted-foreground">Administrateur requis</span>
            )}
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <ConnectionCapability title="Gmail" body="Lecture du contexte utile. Aucun email n'est envoyé avec l'autorisation initiale." connected={googleConnected} />
          <ConnectionCapability title="Google Calendar" body="Lecture des rendez-vous. Aucune création ou modification n'est autorisée avec l'accès initial." connected={googleConnected} />
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Cloud size={18} className="text-accent" />
              <h2 className="font-semibold">HubSpot</h2>
              <ConnectionStateBadge state={hubspotState} connectedLabel="Connecté · lecture seule" />
            </div>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
              Pilotzia lit uniquement les contacts et les deals nécessaires pour confirmer qu&apos;une opportunité est réellement gagnée après une relance.
              Aucune modification du CRM n&apos;est effectuée. Le portail HubSpot et son abonnement restent ceux de votre entreprise.
            </p>
            {hubspot && (
              <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                <p>Compte : {hubspot.accountLabel ?? "Compte HubSpot"}</p>
                {hubspotNeedsReauth && <p className="font-medium text-warning">Le compte doit être reconnecté avant la prochaine observation.</p>}
                {hubspot.lastError && !hubspotNeedsReauth && <p className="font-medium text-warning">Dernière erreur HubSpot enregistrée.</p>}
              </div>
            )}
            {!hubspotConfiguration.configured && canManageIntegrations && (
              <p className="mt-3 text-xs font-medium text-danger">Configuration serveur HubSpot incomplète.</p>
            )}
            {hubspotRedirect && canManageIntegrations && (
              <div className="mt-3 rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                <p className="font-medium text-foreground">Callback OAuth HubSpot</p>
                <code className="mt-1 block break-all">{hubspotRedirect}</code>
                <p className="mt-3 font-medium text-foreground">Webhook HubSpot à configurer</p>
                <code className="mt-1 block break-all">{hubspotWebhookUrl()}</code>
                <p className="mt-1">Événement : deal.propertyChange · propriété hs_is_closed_won.</p>
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {(!hubspotConnected || hubspotNeedsReauth) && canManageIntegrations && hubspotConfiguration.configured && (
              <a
                href="/api/integrations/hubspot/connect"
                className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90"
              >
                <RefreshCcw size={15} /> {hubspotNeedsReauth ? "Reconnecter HubSpot" : "Connecter HubSpot"}
              </a>
            )}
            {hubspotConnected && canManageIntegrations && (
              <form method="post" action="/api/integrations/hubspot/disconnect">
                <button className="inline-flex items-center gap-2 rounded-xl border border-border px-3.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-danger">
                  <Unplug size={15} /> Déconnecter
                </button>
              </form>
            )}
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <ConnectionCapability title="Deals gagnés" body="Observation signée puis rapprochement avec une relance Pilotzia antérieure." connected={hubspotConnected} />
          <ConnectionCapability title="CRM en lecture seule" body="Contacts et associations nécessaires à la preuve ; aucune écriture HubSpot." connected={hubspotConnected} />
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Cloud size={18} className="text-accent" />
              <h2 className="font-semibold">Stripe métier</h2>
              <ConnectionStateBadge state={stripeBusinessState} connectedLabel="Connecté · invoice.paid" />
            </div>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
              Ce connecteur est distinct du Stripe qui facture Pilotzia. Il observe uniquement les factures payées du compte métier et
              les rapproche d&apos;une relance de facture Pilotzia au même contact. Le compte Stripe métier et ses frais restent directement
              gérés par votre entreprise auprès de Stripe.
            </p>
            <div className="mt-3 rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">Endpoint webhook à créer dans Stripe</p>
              <code className="mt-1 block break-all">{stripeWebhook}</code>
              <p className="mt-2">Événement unique : <code>invoice.paid</code>. Copiez ensuite son secret de signature <code>whsec_…</code> ci-dessous.</p>
            </div>
            {stripeBusinessConnected && (
              <p className="mt-3 text-xs text-success">Secret de signature chiffré au repos · aucun accès aux remboursements ou transferts.</p>
            )}
          </div>
          {stripeBusinessConnected && canManageIntegrations && (
            <form method="post" action="/api/integrations/stripe-business/disconnect">
              <button className="inline-flex items-center gap-2 rounded-xl border border-border px-3.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-danger">
                <Unplug size={15} /> Déconnecter
              </button>
            </form>
          )}
        </div>
        {canManageIntegrations && (
          <form method="post" action="/api/integrations/stripe-business/configure" className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="min-w-0 flex-1 text-xs font-medium text-foreground">
              Secret de signature Stripe métier
              <input
                type="password"
                name="webhookSecret"
                required
                autoComplete="off"
                placeholder="whsec_…"
                className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-accent"
              />
            </label>
            <button className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90">
              <ShieldCheck size={15} /> {stripeBusinessConnected ? "Remplacer le secret" : "Activer Stripe métier"}
            </button>
          </form>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">Applications connues de Pilotzia</h2>
            <p className="mt-1 text-xs text-muted-foreground">Contexte déclaré séparé des connexions API.</p>
          </div>
          <Badge tone="accent">{company.tools.length} renseignée{company.tools.length > 1 ? "s" : ""}</Badge>
        </div>

        {company.tools.length === 0 ? (
          <div className="mt-5 rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground">
            Aucun outil renseigné. Ajoutez ceux que vous utilisez pour améliorer le diagnostic et les recommandations.
          </div>
        ) : (
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {company.tools.map((tool) => {
              const definition = getIntegrationDefinition(tool.name);
              const isGoogleTool = tool.name === "Gmail" || tool.name === "Google Calendar";
              const isReallyConnected =
                (isGoogleTool && googleConnected) ||
                (tool.name === "HubSpot" && hubspotConnected) ||
                (tool.name === "Stripe" && stripeBusinessConnected);
              return (
                <li key={tool.id} className="rounded-xl border border-border bg-background p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold">{tool.name}</span>
                        <Badge tone="accent">Renseigné</Badge>
                        {isReallyConnected && <Badge tone="success">API active</Badge>}
                      </div>
                      <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <CheckCircle2 size={13} className="text-success" /> Connu du copilote
                      </div>
                      <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <LockKeyhole size={13} /> {definition.permissionLabel}
                      </div>
                      <p className="mt-2 text-[11px] font-medium text-muted-foreground">
                        Connexion API : {isReallyConnected ? "active" : "non activée"}
                      </p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Compte et abonnement fournisseur : gérés par votre entreprise · connexion {formatAuthMode(definition.authMode)}
                      </p>
                    </div>
                    {hasCompanyPermission(access.role, "edit_company") && (
                      <form action={removeToolAction}>
                        <input type="hidden" name="toolId" value={tool.id} />
                        <button
                          type="submit"
                          aria-label={`Retirer ${tool.name}`}
                          className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-danger"
                        >
                          <X size={15} />
                        </button>
                      </form>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {suggestions.length > 0 && hasCompanyPermission(access.role, "edit_company") && (
        <section className="rounded-2xl border border-border bg-card p-6">
          <h2 className="font-semibold">Ajouter une application à votre contexte</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Cette étape indique simplement à {APP_NAME} que votre entreprise utilise cet outil.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {suggestions.map((tool) => (
              <form action={addToolAction} key={tool}>
                <input type="hidden" name="name" value={tool} />
                <Button type="submit" variant="outline" size="sm">
                  <Plus size={14} /> {tool}
                </Button>
              </form>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function ConnectionMessage({
  message,
  code,
}: {
  message: { tone: "success" | "warning" | "danger" | "accent"; title: string; body: string };
  code?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex gap-3">
        <AlertCircle
          size={18}
          className={message.tone === "danger" ? "mt-0.5 text-danger" : message.tone === "warning" ? "mt-0.5 text-warning" : "mt-0.5 text-accent"}
        />
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold">{message.title}</p>
            {code && <Badge tone={message.tone}>{code}</Badge>}
          </div>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{message.body}</p>
        </div>
      </div>
    </div>
  );
}

function ConnectionStateBadge({
  state,
  connectedLabel,
}: {
  state: IntegrationConnectionState;
  connectedLabel: string;
}) {
  const label = state === "connected" ? connectedLabel : integrationConnectionStateLabel(state);
  return <Badge tone={integrationConnectionStateTone(state)}>{label}</Badge>;
}

function formatAuthMode(authMode: ReturnType<typeof getIntegrationDefinition>["authMode"]) {
  if (authMode === "oauth") return "OAuth";
  if (authMode === "signed_webhook") return "webhook signé";
  if (authMode === "api_key") return "clé API";
  if (authMode === "service_account") return "compte de service";
  return "manuelle";
}

function ConnectionCapability({ title, body, connected }: { title: string; body: string; connected: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold">{title}</p>
        <span className={`h-2 w-2 rounded-full ${connected ? "bg-success" : "bg-muted-foreground/30"}`} />
      </div>
      <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{body}</p>
    </div>
  );
}

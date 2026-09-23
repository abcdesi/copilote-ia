import { AlertCircle, CheckCircle2, Cloud, LockKeyhole, Plus, RefreshCcw, ShieldCheck, Unplug, X } from "lucide-react";
import { getCurrentCompanyAccess, hasCompanyPermission } from "@/lib/companies/access";
import { addToolAction, removeToolAction } from "@/lib/companies/actions";
import { KNOWN_TOOLS } from "@/lib/automations/types";
import { getIntegrationDefinition } from "@/lib/integrations/registry";
import { getGoogleConfigurationStatus } from "@/lib/integrations/google";
import { getHubSpotConfigurationStatus } from "@/lib/integrations/hubspot";
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
  connected: {
    tone: "success",
    title: "HubSpot est connecté",
    body: "L'autorisation lecture seule a été enregistrée et une première synchronisation CRM a réussi.",
  },
  synced: {
    tone: "success",
    title: "Synchronisation HubSpot terminée",
    body: "Les signaux CRM ont été actualisés et transmis au Business Graph sans copier les fiches individuelles.",
  },
  disconnected: {
    tone: "accent",
    title: "HubSpot est déconnecté",
    body: "Pilotzia n'utilise plus les jetons stockés pour ce compte.",
  },
  cancelled: {
    tone: "accent",
    title: "Connexion HubSpot annulée",
    body: "Aucune nouvelle autorisation HubSpot n'a été enregistrée.",
  },
  "connected-sync-error": {
    tone: "warning",
    title: "HubSpot est autorisé mais la première synchronisation a échoué",
    body: "La connexion est conservée. Relancez la synchronisation ou vérifiez les scopes CRM autorisés dans l'application HubSpot.",
  },
  "permission-denied": {
    tone: "danger",
    title: "Permission Pilotzia insuffisante",
    body: "Seul un propriétaire ou un administrateur peut connecter ou déconnecter HubSpot.",
  },
  "config-error": {
    tone: "danger",
    title: "Configuration HubSpot incomplète côté Pilotzia",
    body: "La connexion est désactivée tant que HUBSPOT_CLIENT_ID, HUBSPOT_CLIENT_SECRET et le stockage chiffré ne sont pas configurés.",
  },
  "token-error": {
    tone: "danger",
    title: "HubSpot n'a pas pu finaliser l'autorisation",
    body: "Le code OAuth n'a pas pu être échangé. Vérifiez l'URL de redirection de l'application HubSpot.",
  },
  "state-error": {
    tone: "danger",
    title: "Session OAuth HubSpot invalide ou expirée",
    body: "Recommencez depuis cette page. Aucun accès issu de cette tentative n'a été enregistré.",
  },
  "scope-error": {
    tone: "danger",
    title: "Scopes HubSpot insuffisants",
    body: "Pilotzia demande uniquement contacts, sociétés et deals en lecture. Vérifiez les scopes autorisés dans l'application HubSpot.",
  },
  "sync-error": {
    tone: "warning",
    title: "Synchronisation HubSpot impossible",
    body: "La connexion est conservée mais les données n'ont pas été actualisées. Réessayez ou reconnectez le compte.",
  },
  "provider-error": {
    tone: "danger",
    title: "HubSpot a refusé la connexion",
    body: "Le fournisseur OAuth a renvoyé une erreur. Vérifiez la configuration de l'application HubSpot.",
  },
  "invalid-response": {
    tone: "danger",
    title: "Réponse HubSpot incomplète",
    body: "Aucun code OAuth exploitable n'a été reçu.",
  },
  "start-error": {
    tone: "danger",
    title: "Impossible de démarrer la connexion HubSpot",
    body: "Pilotzia a bloqué le démarrage avant toute autorisation.",
  },
  "callback-error": {
    tone: "danger",
    title: "Connexion HubSpot non finalisée",
    body: "Une erreur inattendue est survenue pendant le retour OAuth.",
  },
  "disconnect-error": {
    tone: "danger",
    title: "Déconnexion HubSpot incomplète",
    body: "Pilotzia n'a pas pu terminer proprement la déconnexion.",
  },
};

export default async function ToolsPage({
  searchParams,
}: {
  searchParams: Promise<{ google?: string; hubspot?: string }>;
}) {
  const access = await getCurrentCompanyAccess();
  const company = access.company;
  const params = await searchParams;
  const googleMessage = params.google ? GOOGLE_MESSAGES[params.google] : null;
  const hubSpotMessage = params.hubspot ? HUBSPOT_MESSAGES[params.hubspot] : null;
  const googleConfiguration = getGoogleConfigurationStatus();
  const hubSpotConfiguration = getHubSpotConfigurationStatus();
  const canManageIntegrations = hasCompanyPermission(access.role, "manage_integrations");
  const canSyncIntegrations = hasCompanyPermission(access.role, "sync_integrations");

  const connections = await prisma.integrationConnection.findMany({ where: { companyId: company.id } });
  const google = connections.find((connection) => connection.provider === "google");
  const googleConnected = google?.status === "connected";
  const googleNeedsReauth = google?.status === "needs_reauth";
  const hubSpot = connections.find((connection) => connection.provider === "hubspot");
  const hubSpotConnected = hubSpot?.status === "connected";
  const hubSpotNeedsReauth = hubSpot?.status === "needs_reauth";
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

      {hubSpotMessage && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex gap-3">
            <AlertCircle size={18} className={hubSpotMessage.tone === "danger" ? "mt-0.5 text-danger" : hubSpotMessage.tone === "warning" ? "mt-0.5 text-warning" : "mt-0.5 text-accent"} />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold">{hubSpotMessage.title}</p>
                <Badge tone={hubSpotMessage.tone}>{params.hubspot}</Badge>
              </div>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{hubSpotMessage.body}</p>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-accent/20 bg-accent-soft p-5">
        <div className="flex gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-card text-accent">
            <ShieldCheck size={17} />
          </div>
          <div>
            <p className="font-semibold">Une application renseignée n'est jamais présentée comme connectée</p>
            <p className="mt-1 text-sm leading-6 text-foreground/75">
              Les connexions réelles affichent le compte autorisé, le niveau de permission et la dernière synchronisation effective.
              Pilotzia commence en lecture seule et ne demande un droit d'action que lorsqu'une fonctionnalité d'écriture l'exige réellement.
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
              {googleConnected ? (
                <Badge tone="success">Connecté · lecture seule</Badge>
              ) : googleNeedsReauth ? (
                <Badge tone="warning">Reconnexion requise</Badge>
              ) : (
                <Badge tone="accent">Disponible</Badge>
              )}
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
            {!googleConfiguration.configured && canManageIntegrations && (
              <p className="mt-3 text-xs font-medium text-danger">
                Configuration serveur Google incomplète : connexion temporairement indisponible.
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {googleConnected && canSyncIntegrations && (
              <form method="post" action="/api/integrations/google/sync">
                <button className="inline-flex items-center gap-2 rounded-xl border border-border px-3.5 py-2 text-sm font-medium transition-colors hover:bg-muted">
                  <RefreshCcw size={15} /> Synchroniser
                </button>
              </form>
            )}
            {(googleNeedsReauth || !googleConnected) && canManageIntegrations && googleConfiguration.configured && (
              <a
                href="/api/integrations/google/connect"
                className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90"
              >
                <RefreshCcw size={15} /> {googleNeedsReauth ? "Reconnecter Google" : "Connecter Google"}
              </a>
            )}
            {googleConnected && canManageIntegrations && (
              <form method="post" action="/api/integrations/google/disconnect">
                <button className="inline-flex items-center gap-2 rounded-xl border border-border px-3.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-danger">
                  <Unplug size={15} /> Déconnecter
                </button>
              </form>
            )}
            {!canManageIntegrations && !googleConnected && (
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
              <h2 className="font-semibold">HubSpot CRM</h2>
              {hubSpotConnected ? (
                <Badge tone="success">Connecté · lecture seule</Badge>
              ) : hubSpotNeedsReauth ? (
                <Badge tone="warning">Reconnexion requise</Badge>
              ) : hubSpotConfiguration.configured ? (
                <Badge tone="accent">Disponible</Badge>
              ) : (
                <Badge tone="neutral">Configuration requise</Badge>
              )}
            </div>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
              Pilotzia lit uniquement des signaux CRM utiles : volumes de contacts, sociétés et deals, ainsi que l'état du pipeline.
              Les fiches individuelles ne sont pas copiées dans le Business Graph.
            </p>
            {hubSpot && (
              <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                <p>Compte : {hubSpot.accountLabel ?? "Compte HubSpot"}</p>
                <p>{formatSync(hubSpot.lastSyncedAt)}</p>
                {hubSpotNeedsReauth && <p className="font-medium text-warning">Le compte doit être reconnecté.</p>}
                {hubSpot.lastError && !hubSpotNeedsReauth && <p className="font-medium text-warning">La dernière synchronisation a rencontré une erreur.</p>}
              </div>
            )}
            {!hubSpotConfiguration.configured && canManageIntegrations && (
              <p className="mt-3 text-xs font-medium text-danger">
                Configuration serveur HubSpot incomplète : connexion temporairement indisponible.
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {hubSpotConnected && canSyncIntegrations && (
              <form method="post" action="/api/integrations/hubspot/sync">
                <button className="inline-flex items-center gap-2 rounded-xl border border-border px-3.5 py-2 text-sm font-medium transition-colors hover:bg-muted">
                  <RefreshCcw size={15} /> Synchroniser
                </button>
              </form>
            )}
            {(hubSpotNeedsReauth || !hubSpotConnected) && canManageIntegrations && hubSpotConfiguration.configured && (
              <a href="/api/integrations/hubspot/connect" className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90">
                <RefreshCcw size={15} /> {hubSpotNeedsReauth ? "Reconnecter HubSpot" : "Connecter HubSpot"}
              </a>
            )}
            {hubSpotConnected && canManageIntegrations && (
              <form method="post" action="/api/integrations/hubspot/disconnect">
                <button className="inline-flex items-center gap-2 rounded-xl border border-border px-3.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-danger">
                  <Unplug size={15} /> Déconnecter
                </button>
              </form>
            )}
            {!canManageIntegrations && !hubSpotConnected && (
              <span className="rounded-xl border border-border px-3.5 py-2 text-xs text-muted-foreground">Administrateur requis</span>
            )}
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <ConnectionCapability title="Contacts" body="Comptages et signaux CRM en lecture seule." connected={hubSpotConnected} />
          <ConnectionCapability title="Sociétés" body="Volume de sociétés connu du CRM, sans copier les fiches." connected={hubSpotConnected} />
          <ConnectionCapability title="Deals" body="Pipeline ouvert, gagné et perdu pour aider le Copilote à prioriser." connected={hubSpotConnected} />
        </div>
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
              const isHubSpotTool = tool.name === "HubSpot";
              const isReallyConnected = (isGoogleTool && googleConnected) || (isHubSpotTool && hubSpotConnected);
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

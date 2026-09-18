import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  CircleDollarSign,
  Link2,
  MousePointerClick,
  RefreshCcw,
  Target,
  UsersRound,
} from "lucide-react";
import { getCurrentCompanyAccess, hasCompanyPermission } from "@/lib/companies/access";
import { getLatestMarketingKpiSnapshot, deriveMarketingKpis } from "@/lib/marketing/kpis";
import {
  saveGoogleMarketingSettingsAction,
  saveMarketingKpiSnapshotAction,
  syncGoogleMarketingAction,
} from "@/lib/marketing/actions";
import {
  getGoogleMarketingState,
  listGa4Properties,
} from "@/lib/integrations/google-marketing";
import {
  getGoogleConfigurationStatus,
  googleRedirectUri,
} from "@/lib/integrations/google";
import { getIntegrationDefinition } from "@/lib/integrations/registry";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { formatEur } from "@/lib/format";

const MARKETING_TOOLS = ["Google Analytics 4", "Google Ads", "Meta Ads", "LinkedIn Ads"] as const;

const GOOGLE_MESSAGES: Record<
  string,
  { tone: "success" | "warning" | "danger" | "accent"; title: string; body: string }
> = {
  "marketing-authorized": {
    tone: "success",
    title: "Google Marketing est autorisé",
    body: "Choisissez maintenant la propriété GA4 et, si nécessaire, le compte Google Ads à synchroniser.",
  },
  "settings-saved": {
    tone: "accent",
    title: "Sources Google enregistrées",
    body: "Vous pouvez lancer la première synchronisation réelle.",
  },
  synced: {
    tone: "success",
    title: "KPI Google synchronisés",
    body: "Le cockpit et le Copilote utilisent désormais le dernier instantané observé.",
  },
  "sync-error": {
    tone: "warning",
    title: "Synchronisation Google incomplète",
    body: "La connexion est conservée. Vérifiez la propriété GA4, le compte Google Ads et les API activées.",
  },
  "settings-invalid": {
    tone: "danger",
    title: "Configuration marketing invalide",
    body: "Vérifiez les identifiants de propriété et de compte saisis.",
  },
  "permission-denied": {
    tone: "danger",
    title: "Permission insuffisante",
    body: "Un propriétaire ou administrateur doit gérer la connexion Google.",
  },
  cancelled: {
    tone: "accent",
    title: "Autorisation annulée",
    body: "Aucun nouvel accès marketing n'a été accordé.",
  },
  "provider-error": {
    tone: "danger",
    title: "Google a refusé l'autorisation",
    body: "Vérifiez l'écran de consentement OAuth, les utilisateurs de test et les URI autorisées.",
  },
  "token-error": {
    tone: "danger",
    title: "Google n'a pas pu finaliser l'autorisation",
    body: "Le code OAuth n'a pas pu être échangé. Vérifiez notamment l'URI de redirection.",
  },
  "callback-error": {
    tone: "danger",
    title: "Connexion Google non finalisée",
    body: "Une erreur est survenue pendant le retour OAuth. Réessayez après vérification de la configuration Google Cloud.",
  },
};

function formatMetric(value: number | null, suffix = "") {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(value >= 10 ? 1 : 2)}${suffix}`;
}

function formatCount(value: number | null) {
  return value == null ? "—" : Math.round(value).toLocaleString("fr-FR");
}

function formatMoney(value: number | null) {
  return value == null ? "—" : formatEur(value);
}

export default async function MarketingPage({
  searchParams,
}: {
  searchParams: Promise<{ google?: string }>;
}) {
  const access = await getCurrentCompanyAccess();
  const params = await searchParams;
  const [snapshot, googleState] = await Promise.all([
    getLatestMarketingKpiSnapshot(access.company.id).catch((error) => {
      console.error("Marketing KPI snapshot unavailable", error);
      return null;
    }),
    getGoogleMarketingState(access.company.id).catch((error) => {
      console.error("Google marketing state unavailable", error);
      return {
        connection: null,
        scopes: [] as string[],
        settings: {
          ga4PropertyId: undefined,
          googleAdsCustomerId: undefined,
          googleAdsLoginCustomerId: undefined,
        },
        analyticsAuthorized: false,
        adsAuthorized: false,
        adsServerConfigured: Boolean(process.env.GOOGLE_ADS_DEVELOPER_TOKEN?.trim()),
      };
    }),
  ]);
  const derived = snapshot ? deriveMarketingKpis(snapshot) : null;
  const canEdit = hasCompanyPermission(access.role, "edit_company");
  const canManage = hasCompanyPermission(access.role, "manage_integrations");
  const canSync = hasCompanyPermission(access.role, "sync_integrations");
  const knownTools = new Set(access.company.tools.map((tool) => tool.name));
  const googleConfiguration = getGoogleConfigurationStatus();
  const redirectUri = googleConfiguration.configured ? googleRedirectUri() : null;
  const googleMessage = params.google ? GOOGLE_MESSAGES[params.google] : null;

  const ga4Properties = googleState.analyticsAuthorized
    ? await listGa4Properties(access.company.id).catch((error) => {
        console.error("Unable to list GA4 properties", error);
        return [];
      })
    : [];

  const hasConfiguredSource =
    (googleState.analyticsAuthorized && Boolean(googleState.settings.ga4PropertyId)) ||
    (googleState.adsAuthorized &&
      googleState.adsServerConfigured &&
      Boolean(googleState.settings.googleAdsCustomerId));

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Acquisition & performance</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Pilotage marketing</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          GA4 et Google Ads peuvent alimenter ce cockpit en lecture. Chaque métrique conserve sa provenance ;
          les valeurs manuelles restent séparées des données réellement synchronisées.
        </p>
      </div>

      {googleMessage && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex gap-3">
            <AlertCircle
              size={18}
              className={
                googleMessage.tone === "danger"
                  ? "mt-0.5 text-danger"
                  : googleMessage.tone === "warning"
                    ? "mt-0.5 text-warning"
                    : "mt-0.5 text-accent"
              }
            />
            <div>
              <p className="text-sm font-semibold">{googleMessage.title}</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{googleMessage.body}</p>
            </div>
          </div>
        </div>
      )}

      <Card className="border-accent/20">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Connexion Google Marketing</CardTitle>
              <CardDescription>
                OAuth Google partagé, avec lecture GA4 et lecture des performances Google Ads côté Pilotzia.
              </CardDescription>
            </div>
            {googleState.connection?.status === "connected" ? (
              <Badge tone="success">Compte Google autorisé</Badge>
            ) : googleState.connection?.status === "needs_reauth" ? (
              <Badge tone="warning">Reconnexion requise</Badge>
            ) : (
              <Badge tone="accent">À connecter</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <ConnectionState
              title="Google Analytics 4"
              connected={googleState.analyticsAuthorized}
              detail={
                googleState.settings.ga4PropertyId
                  ? `Propriété ${googleState.settings.ga4PropertyId}`
                  : "Autorisation analytics.readonly + propriété à choisir"
              }
            />
            <ConnectionState
              title="Google Ads"
              connected={
                googleState.adsAuthorized &&
                googleState.adsServerConfigured &&
                Boolean(googleState.settings.googleAdsCustomerId)
              }
              detail={
                !googleState.adsServerConfigured
                  ? "Developer token serveur manquant"
                  : googleState.settings.googleAdsCustomerId
                    ? `Client ${googleState.settings.googleAdsCustomerId}`
                    : "Autorisation reçue + identifiant client à renseigner"
              }
            />
          </div>

          {redirectUri && (
            <div className="rounded-xl border border-border bg-muted/40 p-4">
              <div className="flex items-start gap-2">
                <Link2 size={16} className="mt-0.5 shrink-0 text-accent" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold">URI de redirection OAuth à autoriser dans Google Cloud</p>
                  <code className="mt-2 block break-all rounded-lg bg-card px-3 py-2 text-xs">{redirectUri}</code>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    L&apos;erreur Google <strong>redirect_uri_mismatch</strong> disparaît uniquement si cette valeur est
                    ajoutée à l&apos;identique dans les URI de redirection autorisées du client OAuth.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {canManage && googleConfiguration.configured && (
              <Button href="/api/integrations/google/connect?mode=marketing">
                <RefreshCcw size={15} />
                {googleState.analyticsAuthorized || googleState.adsAuthorized
                  ? "Actualiser les autorisations Google"
                  : "Autoriser GA4 + Google Ads"}
              </Button>
            )}
            {!googleConfiguration.configured && (
              <span className="rounded-xl border border-danger/20 bg-danger-soft px-3 py-2 text-xs font-medium text-danger">
                Configuration OAuth serveur incomplète
              </span>
            )}
            {googleState.connection?.accountLabel && (
              <span className="self-center text-xs text-muted-foreground">
                Compte : {googleState.connection.accountLabel}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {(googleState.analyticsAuthorized || googleState.adsAuthorized) && canManage && (
        <Card>
          <CardHeader>
            <CardTitle>Sources à synchroniser</CardTitle>
            <CardDescription>
              La fenêtre d&apos;observation utilisée par Pilotzia est de 30 jours. Aucun changement de campagne n&apos;est effectué.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={saveGoogleMarketingSettingsAction} className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ga4PropertyId">Propriété Google Analytics 4</Label>
                {ga4Properties.length > 0 ? (
                  <select
                    id="ga4PropertyId"
                    name="ga4PropertyId"
                    defaultValue={googleState.settings.ga4PropertyId ?? ""}
                    className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
                  >
                    <option value="">Ne pas synchroniser GA4</option>
                    {ga4Properties.map((property) => (
                      <option key={property.propertyId} value={property.propertyId}>
                        {property.displayName} · {property.accountDisplayName} · {property.propertyId}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Input
                    id="ga4PropertyId"
                    name="ga4PropertyId"
                    inputMode="numeric"
                    placeholder="Ex. 123456789"
                    defaultValue={googleState.settings.ga4PropertyId ?? ""}
                  />
                )}
                <p className="text-xs leading-5 text-muted-foreground">
                  {googleState.analyticsAuthorized
                    ? ga4Properties.length > 0
                      ? `${ga4Properties.length} propriété(s) accessible(s) détectée(s) via l'API Admin.`
                      : "Aucune propriété n'a pu être listée automatiquement ; l'identifiant peut être saisi manuellement."
                    : "Autorisez d'abord l'accès GA4."}
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="googleAdsCustomerId">Identifiant client Google Ads</Label>
                  <Input
                    id="googleAdsCustomerId"
                    name="googleAdsCustomerId"
                    placeholder="Ex. 123-456-7890"
                    defaultValue={googleState.settings.googleAdsCustomerId ?? ""}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="googleAdsLoginCustomerId">Compte manager Google Ads (facultatif)</Label>
                  <Input
                    id="googleAdsLoginCustomerId"
                    name="googleAdsLoginCustomerId"
                    placeholder="Ex. 111-222-3333"
                    defaultValue={googleState.settings.googleAdsLoginCustomerId ?? ""}
                  />
                  <p className="text-xs leading-5 text-muted-foreground">
                    À renseigner uniquement si le compte client est accédé via un compte manager.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 md:col-span-2">
                <Button type="submit">Enregistrer les sources</Button>
              </div>
            </form>

            {canSync && hasConfiguredSource && (
              <form action={syncGoogleMarketingAction} className="mt-4 border-t border-border pt-4">
                <Button type="submit" variant="outline">
                  <RefreshCcw size={15} /> Synchroniser maintenant
                </Button>
                <p className="mt-2 text-xs text-muted-foreground">
                  Une synchronisation automatique est aussi exécutée pendant le refresh hebdomadaire Pilotzia.
                </p>
              </form>
            )}
          </CardContent>
        </Card>
      )}

      {snapshot ? (
        <>
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle>Instantané marketing · {snapshot.periodDays} jours</CardTitle>
                  <CardDescription>
                    {snapshot.source === "google_marketing" ? "Données synchronisées" : "Données déclarées"} ·{" "}
                    {new Intl.DateTimeFormat("fr-FR", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(snapshot.observedAt))}
                  </CardDescription>
                </div>
                <Badge tone={snapshot.source === "google_marketing" ? "success" : "accent"}>
                  {snapshot.source === "google_marketing"
                    ? `Google · ${snapshot.providers.join(" + ") || "API"}`
                    : "Source manuelle"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Metric icon={UsersRound} label="Utilisateurs GA4" value={formatCount(snapshot.users)} />
              <Metric icon={BarChart3} label="Sessions GA4" value={formatCount(snapshot.sessions)} />
              <Metric icon={MousePointerClick} label="Clics Ads" value={formatCount(snapshot.clicks)} />
              <Metric icon={Target} label="Conversions" value={formatMetric(snapshot.conversions)} />
              <Metric icon={CircleDollarSign} label="Dépenses Ads" value={formatMoney(snapshot.spendEur)} />
              <Metric icon={BarChart3} label="Revenu site GA4" value={formatMoney(snapshot.revenueEur)} />
              <Metric
                icon={CircleDollarSign}
                label="Valeur conversions Ads"
                value={formatMoney(snapshot.attributedRevenueEur)}
              />
              <Metric icon={UsersRound} label="Leads" value={formatCount(snapshot.leads)} />
            </CardContent>
          </Card>

          <Card className="border-accent/20">
            <CardHeader>
              <CardTitle>KPI calculés</CardTitle>
              <CardDescription>
                Calculs déterministes ; un KPI reste vide si ses données sources ne sont pas disponibles.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Kpi label="ROAS Ads" value={formatMetric(derived?.roas ?? null, "×")} />
              <Kpi label="CPA" value={derived?.cpaEur == null ? "—" : formatEur(derived.cpaEur)} />
              <Kpi label="CPC" value={derived?.costPerClickEur == null ? "—" : formatEur(derived.costPerClickEur)} />
              <Kpi label="CTR" value={formatMetric(derived?.clickThroughRate ?? null, "%")} />
              <Kpi label="CPL" value={derived?.cplEur == null ? "—" : formatEur(derived.cplEur)} />
              <Kpi label="CAC" value={derived?.cacEur == null ? "—" : formatEur(derived.cacEur)} />
              <Kpi label="Lead → client" value={formatMetric(derived?.leadToCustomerRate ?? null, "%")} />
              <Kpi label="Impressions Ads" value={formatCount(snapshot.impressions)} />
            </CardContent>
          </Card>
        </>
      ) : (
        <Card className="border-accent/20 bg-accent-soft">
          <CardHeader>
            <CardTitle>Aucun KPI marketing observé</CardTitle>
            <CardDescription>
              Connectez Google ou ajoutez un premier instantané manuel pour donner au Copilote une base chiffrée vérifiable.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {canEdit && (
        <Card>
          <CardHeader>
            <CardTitle>Saisie manuelle de secours</CardTitle>
            <CardDescription>
              À utiliser uniquement si une source n&apos;est pas encore connectée. Une synchronisation Google ultérieure
              devient automatiquement la source la plus récente.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={saveMarketingKpiSnapshotAction} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <Field name="spendEur" label="Dépenses €" defaultValue={snapshot?.spendEur} />
              <Field name="leads" label="Leads" defaultValue={snapshot?.leads} step="1" />
              <Field name="conversions" label="Conversions" defaultValue={snapshot?.conversions} step="1" />
              <Field name="customers" label="Clients acquis" defaultValue={snapshot?.customers} step="1" />
              <Field name="revenueEur" label="Revenu attribué €" defaultValue={snapshot?.revenueEur} />
              <div className="sm:col-span-2 lg:col-span-5">
                <Button type="submit" variant="outline">Enregistrer manuellement</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>État des sources marketing</CardTitle>
          <CardDescription>
            Les badges API active ne sont affichés que lorsque la source est réellement autorisée et configurée.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {MARKETING_TOOLS.map((tool) => {
            const definition = getIntegrationDefinition(tool);
            const known = knownTools.has(tool);
            const live =
              tool === "Google Analytics 4"
                ? googleState.analyticsAuthorized && Boolean(googleState.settings.ga4PropertyId)
                : tool === "Google Ads"
                  ? googleState.adsAuthorized &&
                    googleState.adsServerConfigured &&
                    Boolean(googleState.settings.googleAdsCustomerId)
                  : false;
            return (
              <div key={tool} className="rounded-xl border border-border bg-background p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold">{tool}</p>
                  <div className="flex gap-1.5">
                    {known && <Badge tone="accent">Renseigné</Badge>}
                    {live ? <Badge tone="success">API active</Badge> : <Badge tone="warning">API non active</Badge>}
                  </div>
                </div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{definition.permissionLabel}</p>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

function ConnectionState({
  title,
  connected,
  detail,
}: {
  title: string;
  connected: boolean;
  detail: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold">{title}</p>
        {connected ? (
          <CheckCircle2 size={16} className="text-success" />
        ) : (
          <span className="h-2 w-2 rounded-full bg-muted-foreground/30" />
        )}
      </div>
      <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{detail}</p>
    </div>
  );
}

function Field({
  name,
  label,
  defaultValue,
  step = "0.01",
}: {
  name: string;
  label: string;
  defaultValue?: number | null;
  step?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        type="number"
        min="0"
        step={step}
        required
        defaultValue={typeof defaultValue === "number" ? String(defaultValue) : undefined}
      />
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icon size={14} />
        <span className="text-[11px]">{label}</span>
      </div>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}

import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const BASE_URL = process.env.E2E_BASE_URL || "http://127.0.0.1:3000";
const PASSWORD = "ProfileE2E!2026";

type Profile = {
  key: string;
  email: string;
  name: string;
  companyName: string;
  industry: string;
  country: string;
  sizeRange: string;
  employeeCount: number;
  plan: "starter" | "pro" | "business";
  objective: string;
  painPoint: string;
  businessModel: string;
  customerProfile: string;
  domainContext: Partial<{
    financeContext: string;
    marketingContext: string;
    salesContext: string;
    operationsContext: string;
  }>;
  tools: string[];
};

const PROFILES: Profile[] = [
  {
    key: "ceo",
    email: "e2e-ceo@pilotzia.local",
    name: "Claire Direction",
    companyName: "E2E Horizon Direction",
    industry: "Services B2B",
    country: "France métropolitaine",
    sizeRange: "21-50",
    employeeCount: 32,
    plan: "business",
    objective: "Piloter la croissance, la marge et les priorités de direction.",
    painPoint: "Trop de décisions sont dispersées entre les équipes et les outils.",
    businessModel: "Abonnements et prestations B2B récurrentes.",
    customerProfile: "PME et ETI françaises.",
    domainContext: {
      financeContext: "Suivi mensuel du chiffre d'affaires, de la marge et de la trésorerie.",
      operationsContext: "Revue hebdomadaire des priorités et incidents.",
    },
    tools: ["Gmail", "Google Calendar", "Stripe"],
  },
  {
    key: "company-60",
    email: "e2e-60@pilotzia.local",
    name: "Alexis Operations",
    companyName: "E2E Industrie 60",
    industry: "Services industriels",
    country: "France métropolitaine",
    sizeRange: "51-200",
    employeeCount: 60,
    plan: "business",
    objective: "Structurer l'exécution et la gouvernance entre plusieurs équipes.",
    painPoint: "Les relances, validations et suivis sont encore trop manuels.",
    businessModel: "Contrats B2B et prestations récurrentes.",
    customerProfile: "Entreprises multi-sites.",
    domainContext: {
      salesContext: "Pipeline commercial partagé entre direction et équipe opérations.",
      operationsContext: "Processus avec validations par rôle et responsables identifiés.",
    },
    tools: ["Gmail", "Google Calendar", "HubSpot", "Slack"],
  },
  {
    key: "marketing",
    email: "e2e-marketing@pilotzia.local",
    name: "Maya Marketing",
    companyName: "E2E Growth Studio",
    industry: "Marketing digital",
    country: "France métropolitaine",
    sizeRange: "6-20",
    employeeCount: 14,
    plan: "pro",
    objective: "Suivre l'acquisition et automatiser le reporting marketing.",
    painPoint: "Les KPI sont répartis entre plusieurs régies et feuilles de calcul.",
    businessModel: "Agence avec forfaits mensuels.",
    customerProfile: "PME investissant dans l'acquisition digitale.",
    domainContext: {
      marketingContext: "Suivi des dépenses, conversions, CPA, CAC et ROAS par canal.",
      salesContext: "Qualification des leads marketing avant transmission commerciale.",
    },
    tools: ["Google Analytics 4", "Google Ads", "Meta Ads", "LinkedIn Ads"],
  },
  {
    key: "solopreneur",
    email: "e2e-solo@pilotzia.local",
    name: "Sam Solo",
    companyName: "E2E Atelier Solo",
    industry: "Conseil",
    country: "Martinique",
    sizeRange: "1-5",
    employeeCount: 1,
    plan: "starter",
    objective: "Réduire le temps administratif et mieux relancer les prospects.",
    painPoint: "Je gère seul les demandes clients, les relances et l'administratif.",
    businessModel: "Prestations de conseil au forfait.",
    customerProfile: "TPE et indépendants.",
    domainContext: {
      salesContext: "Prospection et relances gérées directement par le dirigeant.",
    },
    tools: ["Gmail", "Google Calendar"],
  },
];

const COMMON_ROUTES = [
  "/app",
  "/app/company",
  "/app/context",
  "/app/copilot",
  "/app/opportunities",
  "/app/automations",
  "/app/actions",
  "/app/results",
  "/app/marketing",
  "/app/tools",
  "/app/settings",
  "/app/team",
  "/app/finance",
];

class CookieJar {
  private readonly values = new Map<string, string>();

  absorb(response: Response) {
    const headers = response.headers as Headers & { getSetCookie?: () => string[] };
    const cookies = headers.getSetCookie?.() ?? (headers.get("set-cookie") ? [headers.get("set-cookie") as string] : []);
    for (const cookie of cookies) {
      const pair = cookie.split(";", 1)[0];
      const index = pair.indexOf("=");
      if (index <= 0) continue;
      const name = pair.slice(0, index).trim();
      const value = pair.slice(index + 1).trim();
      if (value) this.values.set(name, value);
      else this.values.delete(name);
    }
  }

  header() {
    return [...this.values.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
  }
}

async function ensureProfile(profile: Profile) {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const user = await prisma.user.upsert({
    where: { email: profile.email },
    update: { name: profile.name, passwordHash },
    create: { email: profile.email, name: profile.name, passwordHash },
  });

  const existingCompany = await prisma.company.findFirst({
    where: { userId: user.id, name: profile.companyName },
  });

  const companyData = {
    name: profile.companyName,
    industry: profile.industry,
    country: profile.country,
    sizeRange: profile.sizeRange,
    employeeCount: profile.employeeCount,
    objectives: profile.objective,
    painPoints: profile.painPoint,
    businessModel: profile.businessModel,
    customerProfile: profile.customerProfile,
    financeContext: profile.domainContext.financeContext ?? null,
    marketingContext: profile.domainContext.marketingContext ?? null,
    salesContext: profile.domainContext.salesContext ?? null,
    operationsContext: profile.domainContext.operationsContext ?? null,
    automationScore: profile.key === "solopreneur" ? 35 : 62,
  };

  const company = existingCompany
    ? await prisma.company.update({ where: { id: existingCompany.id }, data: companyData })
    : await prisma.company.create({ data: { userId: user.id, ...companyData } });

  await prisma.companyMembership.upsert({
    where: { companyId_userId: { companyId: company.id, userId: user.id } },
    update: { role: "owner", status: "active" },
    create: { companyId: company.id, userId: user.id, role: "owner", status: "active" },
  });

  const subscription = await prisma.subscription.findFirst({
    where: { companyId: company.id },
    orderBy: { createdAt: "desc" },
  });
  if (subscription) {
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: { plan: profile.plan, status: "active" },
    });
  } else {
    await prisma.subscription.create({
      data: { companyId: company.id, plan: profile.plan, status: "active" },
    });
  }

  await prisma.companyTool.deleteMany({ where: { companyId: company.id } });
  await prisma.companyTool.createMany({
    data: profile.tools.map((name) => ({ companyId: company.id, name, detected: true })),
  });

  if (profile.key === "marketing") {
    await prisma.event.deleteMany({ where: { companyId: company.id, type: "MARKETING_KPI_SNAPSHOT" } });
    await prisma.event.create({
      data: {
        companyId: company.id,
        userId: user.id,
        type: "MARKETING_KPI_SNAPSHOT",
        metadata: JSON.stringify({
          source: "manual",
          observedAt: new Date().toISOString(),
          spendEur: 12000,
          leads: 480,
          conversions: 96,
          customers: 32,
          revenueEur: 42000,
        }),
      },
    });
  }

  return company;
}

async function login(profile: Profile) {
  const jar = new CookieJar();

  const request = async (path: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers);
    const cookie = jar.header();
    if (cookie) headers.set("cookie", cookie);
    headers.set("x-forwarded-host", new URL(BASE_URL).host);
    headers.set("x-forwarded-proto", new URL(BASE_URL).protocol.replace(":", ""));
    const response = await fetch(new URL(path, BASE_URL), {
      ...init,
      headers,
      redirect: "manual",
    });
    jar.absorb(response);
    return response;
  };

  const csrfResponse = await request("/api/auth/csrf");
  assert.equal(csrfResponse.status, 200, `[${profile.key}] CSRF endpoint should be available`);
  const csrf = (await csrfResponse.json()) as { csrfToken?: string };
  assert.ok(csrf.csrfToken, `[${profile.key}] CSRF token missing`);

  const loginResponse = await request("/api/auth/callback/credentials", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      csrfToken: csrf.csrfToken,
      email: profile.email,
      password: PASSWORD,
      callbackUrl: `${BASE_URL}/app`,
    }),
  });

  assert.ok(
    [200, 302, 303].includes(loginResponse.status),
    `[${profile.key}] login failed with HTTP ${loginResponse.status}`
  );
  const loginLocation = loginResponse.headers.get("location") ?? "";
  assert.ok(!/error=/i.test(loginLocation), `[${profile.key}] login redirected to an error: ${loginLocation}`);

  const sessionResponse = await request("/api/auth/session");
  assert.equal(sessionResponse.status, 200, `[${profile.key}] session endpoint should be available`);
  const session = (await sessionResponse.json()) as { user?: { email?: string } };
  assert.equal(session.user?.email, profile.email, `[${profile.key}] authenticated session mismatch`);

  return request;
}

async function testRuntimeProfile(profile: Profile) {
  const company = await ensureProfile(profile);
  const request = await login(profile);

  for (const route of COMMON_ROUTES) {
    const response = await request(route);
    const body = await response.text();
    const location = response.headers.get("location") ?? "";

    assert.equal(
      response.status,
      200,
      `[${profile.key}] ${route} returned HTTP ${response.status}${location ? ` -> ${location}` : ""}`
    );
    assert.ok(
      !body.includes("Une erreur est survenue"),
      `[${profile.key}] ${route} rendered the global error boundary`
    );
    assert.ok(
      !/Internal Server Error|Application error: a server-side exception/i.test(body),
      `[${profile.key}] ${route} rendered a server error`
    );
  }

  const dashboard = await request("/app");
  assert.match(await dashboard.text(), /Pilotage de direction/i, `[${profile.key}] executive scorecard should render`);

  if (profile.key === "ceo") {
    const finance = await request("/app/finance");
    assert.match(await finance.text(), /Intelligence financière/i, "[ceo] Scale finance surface should render");
  }

  if (profile.key === "company-60") {
    assert.equal(company.employeeCount, 60);
    assert.equal(company.sizeRange, "51-200");
    const team = await request("/app/team");
    assert.match(await team.text(), /Membres actifs/i, "[company-60] team governance surface should render");
  }

  if (profile.key === "marketing") {
    const tools = await request("/app/tools");
    const html = await tools.text();
    for (const tool of profile.tools) {
      assert.ok(html.includes(tool), `[marketing] ${tool} should be visible in tools`);
    }
    const marketing = await request("/app/marketing");
    const marketingHtml = await marketing.text();
    assert.match(marketingHtml, /Pilotage marketing/i, "[marketing] marketing cockpit should render");
    assert.match(marketingHtml, /ROAS/i, "[marketing] ROAS should be exposed");
  }

  if (profile.key === "solopreneur") {
    assert.equal(company.employeeCount, 1);
    assert.equal(company.country, "Martinique");
    const soloDashboard = await request("/app");
    assert.match(await soloDashboard.text(), /Connaissance de votre entreprise/i, "[solopreneur] dashboard should render");
  }

  console.log(`Runtime profile ${profile.key}: OK`);
}

async function main() {
  for (const profile of PROFILES) {
    await testRuntimeProfile(profile);
  }
  console.log("Four-profile authenticated runtime smoke tests: OK");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

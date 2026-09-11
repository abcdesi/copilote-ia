import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function daysAgo(n: number) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}
function hoursAgo(n: number) {
  return new Date(Date.now() - n * 60 * 60 * 1000);
}

async function main() {
  const email = "demo@pilote.app";
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log("Le compte démo existe déjà — seed ignoré.");
    return;
  }

  const passwordHash = await bcrypt.hash("demo12345", 10);
  const user = await prisma.user.create({
    data: { email, passwordHash, name: "Camille (Nova Studio)" },
  });

  const company = await prisma.company.create({
    data: {
      userId: user.id,
      name: "Nova Studio",
      industry: "Agence marketing",
      country: "France",
      sizeRange: "6-20",
      employeeCount: 8,
      objectives: "Gagner du temps sur les tâches répétitives et mieux suivre nos prospects.",
      painPoints: "Nous perdons beaucoup de temps à relancer les prospects et à rédiger les comptes-rendus.",
      automationScore: 72,
      createdAt: daysAgo(52),
    },
  });

  await prisma.companyTool.createMany({
    data: [
      { companyId: company.id, name: "Gmail", detected: true },
      { companyId: company.id, name: "HubSpot", detected: true },
      { companyId: company.id, name: "Slack", detected: true },
      { companyId: company.id, name: "Notion", detected: true },
    ],
  });

  await prisma.subscription.create({
    data: { companyId: company.id, plan: "pro", status: "active" },
  });

  const automations = await Promise.all([
    prisma.automation.create({
      data: {
        companyId: company.id,
        name: "Relance automatique des prospects",
        businessGoal: "Ne plus jamais oublier de relancer un prospect silencieux",
        status: "active",
        health: "green",
        toolsUsed: JSON.stringify(["Gmail", "HubSpot", "Slack"]),
        estimatedHoursPerMonth: 8,
        estimatedValueEur: 280,
        usageCount: 134,
        errorCount: 0,
        installedAt: daysAgo(48),
        lastCheckedAt: hoursAgo(2),
        lastModifiedAt: daysAgo(12),
      },
    }),
    prisma.automation.create({
      data: {
        companyId: company.id,
        name: "Génération des comptes-rendus de réunion",
        businessGoal: "Ne plus jamais retranscrire une réunion à la main",
        status: "active",
        health: "green",
        toolsUsed: JSON.stringify(["Google Meet", "Notion"]),
        estimatedHoursPerMonth: 3,
        estimatedValueEur: 105,
        usageCount: 21,
        errorCount: 0,
        installedAt: daysAgo(30),
        lastCheckedAt: hoursAgo(5),
        lastModifiedAt: daysAgo(30),
      },
    }),
    prisma.automation.create({
      data: {
        companyId: company.id,
        name: "Notification des nouveaux leads",
        businessGoal: "Réagir en quelques minutes à chaque opportunité entrante",
        status: "warning",
        health: "orange",
        toolsUsed: JSON.stringify(["HubSpot", "Slack"]),
        estimatedHoursPerMonth: 2,
        estimatedValueEur: 70,
        usageCount: 58,
        errorCount: 4,
        installedAt: daysAgo(20),
        lastCheckedAt: hoursAgo(1),
        lastModifiedAt: daysAgo(3),
      },
    }),
    prisma.automation.create({
      data: {
        companyId: company.id,
        name: "Synchronisation CRM et reporting",
        businessGoal: "Garder une vision fiable et à jour de chaque prospect et client",
        status: "active",
        health: "green",
        toolsUsed: JSON.stringify(["HubSpot", "Notion"]),
        estimatedHoursPerMonth: 4,
        estimatedValueEur: 140,
        usageCount: 40,
        errorCount: 0,
        installedAt: daysAgo(14),
        lastCheckedAt: hoursAgo(3),
        lastModifiedAt: daysAgo(14),
      },
    }),
  ]);

  await prisma.automationFeedback.createMany({
    data: [
      { automationId: automations[0].id, sentiment: "great", timeSavedPerWeek: 2, createdAt: daysAgo(10) },
      { automationId: automations[1].id, sentiment: "good", timeSavedPerWeek: 1, createdAt: daysAgo(20) },
      { automationId: automations[2].id, sentiment: "meh", createdAt: daysAgo(2) },
    ],
  });

  await prisma.opportunity.createMany({
    data: [
      {
        companyId: company.id,
        templateId: "support-questions-frequentes",
        title: "Réponses automatiques aux questions fréquentes",
        description:
          "Identifie les demandes récurrentes et propose une réponse adaptée avant escalade humaine.",
        category: "Support",
        impactLevel: "medium",
        complexity: "medium",
        estimatedHoursPerMonth: 7,
        estimatedValueEur: 245,
        priceEur: 59,
        status: "detected",
        createdAt: daysAgo(4),
      },
      {
        companyId: company.id,
        templateId: "generation-devis",
        title: "Génération automatique de devis",
        description: "Génère et envoie automatiquement un devis dès qu'une demande qualifiée est détectée.",
        category: "Ventes",
        impactLevel: "high",
        complexity: "medium",
        estimatedHoursPerMonth: 5,
        estimatedValueEur: 175,
        priceEur: 59,
        status: "detected",
        createdAt: daysAgo(1),
      },
    ],
  });

  const seedConversation = await prisma.conversation.create({
    data: { companyId: company.id, createdAt: daysAgo(5) },
  });

  await prisma.chatMessage.createMany({
    data: [
      {
        companyId: company.id,
        conversationId: seedConversation.id,
        role: "user",
        content: "Combien de temps avons-nous économisé ce mois-ci ?",
        createdAt: daysAgo(5),
      },
      {
        companyId: company.id,
        conversationId: seedConversation.id,
        role: "assistant",
        content:
          "Ce mois-ci, Nova Studio a économisé environ 17 h grâce à vos automatisations actives, soit une valeur estimée à 595 €.",
        createdAt: daysAgo(5),
      },
    ],
  });

  const eventTypes: { type: string; offsetDays: number; metadata?: Record<string, unknown> }[] = [
    { type: "USER_CREATED", offsetDays: 52 },
    { type: "COMPANY_CREATED", offsetDays: 52 },
    { type: "DIAGNOSTIC_COMPLETED", offsetDays: 52, metadata: { opportunityCount: 4 } },
    { type: "AUTOMATION_PURCHASED", offsetDays: 48 },
    { type: "AUTOMATION_INSTALLED", offsetDays: 48 },
    { type: "AUTOMATION_INSTALLED", offsetDays: 30 },
    { type: "AUTOMATION_INSTALLED", offsetDays: 20 },
    { type: "AUTOMATION_INSTALLED", offsetDays: 14 },
    { type: "FEEDBACK_SUBMITTED", offsetDays: 10, metadata: { sentiment: "great" } },
    { type: "RECOMMENDATION_SHOWN", offsetDays: 4 },
    { type: "RECOMMENDATION_SHOWN", offsetDays: 1 },
  ];

  await prisma.event.createMany({
    data: eventTypes.map((e) => ({
      type: e.type,
      userId: user.id,
      companyId: company.id,
      metadata: e.metadata ? JSON.stringify(e.metadata) : null,
      createdAt: daysAgo(e.offsetDays),
    })),
  });

  console.log("Compte démo créé : demo@pilote.app / demo12345");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

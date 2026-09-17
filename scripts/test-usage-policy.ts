import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/client";
import { getUsageStatus, refundUsage, reserveUsage } from "@/lib/billing/usage-policy";

async function createCompany(label: string) {
  const suffix = randomUUID();
  const user = await prisma.user.create({
    data: {
      email: `ci-${label}-${suffix}@pilotzia.invalid`,
      name: "CI Billing",
      passwordHash: "not-used-in-test",
    },
  });
  const company = await prisma.company.create({
    data: { userId: user.id, name: `CI ${label} ${suffix}` },
  });
  return { user, company };
}

async function cleanup(userId: string) {
  await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
}

async function testConcurrentReservations() {
  const { user, company } = await createCompany("concurrency");
  try {
    await prisma.subscription.create({
      data: {
        companyId: company.id,
        plan: "business",
        status: "active",
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 86400000),
        billingInterval: "month",
      },
    });

    const results = await Promise.all(
      Array.from({ length: 11 }, () =>
        reserveUsage({
          companyId: company.id,
          kind: "ai_smart",
          credits: 500,
          reservedCostEur: 5,
        })
      )
    );
    const allowed = results.filter((result) => result.allowed);
    const denied = results.filter((result) => !result.allowed);
    assert.equal(allowed.length, 10, "Le plafond doit autoriser exactement 10 réservations de 5 € sur Scale.");
    assert.equal(denied.length, 1, "La 11e réservation concurrente doit être bloquée.");

    const status = await getUsageStatus(company.id);
    assert.equal(status.creditsUsed, 5000);
    assert.equal(status.reservedCostEur, 50);

    const first = allowed[0];
    assert.ok(first?.allowed && first.reservationId);
    await Promise.all([
      refundUsage({ companyId: company.id, reservationId: first.reservationId, kind: "ai_smart", credits: 500, reservedCostEur: 5 }),
      refundUsage({ companyId: company.id, reservationId: first.reservationId, kind: "ai_smart", credits: 500, reservedCostEur: 5 }),
    ]);
    const afterRefund = await getUsageStatus(company.id);
    assert.equal(afterRefund.creditsUsed, 4500, "Un remboursement concurrent ne doit être appliqué qu'une fois.");
    assert.equal(afterRefund.reservedCostEur, 45);
  } finally {
    await cleanup(user.id);
  }
}

async function testInactiveSubscriptionCannotRestartTrial() {
  const { user, company } = await createCompany("past-due");
  try {
    await prisma.subscription.create({
      data: { companyId: company.id, plan: "starter", status: "past_due" },
    });
    const result = await reserveUsage({
      companyId: company.id,
      kind: "ai_fast",
      credits: 1,
      reservedCostEur: 0.03,
    });
    assert.equal(result.allowed, false);
    if (!result.allowed) assert.equal(result.reason, "subscription_inactive");
    const trial = await prisma.event.findFirst({ where: { companyId: company.id, type: "TRIAL_STARTED" } });
    assert.equal(trial, null, "Un ancien abonnement non actif ne doit jamais recréer un essai.");
  } finally {
    await cleanup(user.id);
  }
}

async function main() {
  await testConcurrentReservations();
  await testInactiveSubscriptionCannotRestartTrial();
  console.log("Usage policy concurrency and abuse tests: OK");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

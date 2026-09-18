import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../lib/db/client";
import { transferCompanyOwnership } from "../lib/companies/team";

async function main() {
  const suffix = randomUUID();
  const [owner, nextOwner] = await Promise.all([
    prisma.user.create({
      data: { email: `owner-${suffix}@pilotzia.invalid`, passwordHash: "test", name: "Owner Test" },
    }),
    prisma.user.create({
      data: { email: `next-owner-${suffix}@pilotzia.invalid`, passwordHash: "test", name: "Next Owner Test" },
    }),
  ]);

  const company = await prisma.company.create({
    data: {
      userId: owner.id,
      name: "Governance Test",
      memberships: {
        create: [
          { userId: owner.id, role: "owner", status: "active" },
          { userId: nextOwner.id, role: "admin", status: "active" },
        ],
      },
    },
  });

  try {
    const targetMembership = await prisma.companyMembership.findUniqueOrThrow({
      where: { companyId_userId: { companyId: company.id, userId: nextOwner.id } },
    });

    const result = await transferCompanyOwnership({
      companyId: company.id,
      currentOwnerUserId: owner.id,
      currentOwnerEmail: owner.email,
      targetMembershipId: targetMembership.id,
    });
    assert.equal(result.previousOwnerUserId, owner.id);
    assert.equal(result.nextOwnerUserId, nextOwner.id);

    const [updatedCompany, oldMembership, newMembership, audit] = await Promise.all([
      prisma.company.findUniqueOrThrow({ where: { id: company.id } }),
      prisma.companyMembership.findUniqueOrThrow({
        where: { companyId_userId: { companyId: company.id, userId: owner.id } },
      }),
      prisma.companyMembership.findUniqueOrThrow({
        where: { companyId_userId: { companyId: company.id, userId: nextOwner.id } },
      }),
      prisma.event.findFirst({
        where: { companyId: company.id, type: "TEAM_OWNERSHIP_TRANSFERRED" },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    assert.equal(updatedCompany.userId, nextOwner.id);
    assert.equal(oldMembership.role, "admin");
    assert.equal(newMembership.role, "owner");
    assert.ok(audit, "Le transfert de propriété doit laisser une preuve d'audit.");

    await assert.rejects(
      () =>
        transferCompanyOwnership({
          companyId: company.id,
          currentOwnerUserId: owner.id,
          currentOwnerEmail: owner.email,
          targetMembershipId: targetMembership.id,
        }),
      /OWNERSHIP_CHANGED/,
      "L'ancien propriétaire ne doit plus pouvoir retransférer la société."
    );

    console.log("Team governance tests: OK");
  } finally {
    await prisma.company.delete({ where: { id: company.id } }).catch(() => undefined);
    await prisma.user.deleteMany({ where: { id: { in: [owner.id, nextOwner.id] } } }).catch(() => undefined);
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

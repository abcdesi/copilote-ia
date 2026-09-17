import { NextRequest, NextResponse } from "next/server";
import { requireCompanyPermission } from "@/lib/companies/access";
import { prisma } from "@/lib/db/client";
import { track } from "@/lib/analytics/track";
import { EVENTS } from "@/lib/analytics/events";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const access = await requireCompanyPermission("configure_automations");
    const { id } = await params;
    const automation = await prisma.automation.findFirst({ where: { id, companyId: access.company.id } });
    if (!automation) return NextResponse.json({ error: "Automatisation introuvable." }, { status: 404 });

    const reactivating = automation.status === "inactive";
    if (reactivating && !automation.approvedConfigHash) {
      await prisma.automation.update({
        where: { id: automation.id },
        data: { status: "needs_review", health: "orange", lastModifiedAt: new Date() },
      });
      await prisma.automationAuditEvent.create({
        data: {
          automationId: automation.id,
          actorUserId: access.session.user.id,
          actorName: access.session.user.name ?? null,
          actorEmail: access.session.user.email ?? null,
          actorRole: access.role,
          eventType: "reactivation_blocked",
          detailsJson: JSON.stringify({ reason: "configuration_not_approved" }),
        },
      });
      return NextResponse.json(
        { error: "La configuration doit être validée avant réactivation.", approvalRequired: true, status: "needs_review" },
        { status: 409 }
      );
    }

    const updated = await prisma.automation.update({
      where: { id: automation.id },
      data: reactivating
        ? { status: "active", health: automation.health === "red" ? "orange" : automation.health, lastModifiedAt: new Date() }
        : { status: "inactive", lastModifiedAt: new Date() },
    });

    await Promise.all([
      prisma.automationAuditEvent.create({
        data: {
          automationId: automation.id,
          actorUserId: access.session.user.id,
          actorName: access.session.user.name ?? null,
          actorEmail: access.session.user.email ?? null,
          actorRole: access.role,
          eventType: reactivating ? "automation_reactivated" : "automation_deactivated",
          detailsJson: JSON.stringify({ previousStatus: automation.status, nextStatus: updated.status }),
        },
      }),
      track(reactivating ? EVENTS.AUTOMATION_REACTIVATED : EVENTS.AUTOMATION_DEACTIVATED, {
        companyId: access.company.id,
        metadata: { automationId: automation.id, actorUserId: access.session.user.id, actorRole: access.role },
      }),
    ]);

    return NextResponse.json({ status: updated.status });
  } catch (error) {
    if (error instanceof Error && error.message === "COMPANY_PERMISSION_DENIED") {
      return NextResponse.json({ error: "Permission insuffisante." }, { status: 403 });
    }
    throw error;
  }
}

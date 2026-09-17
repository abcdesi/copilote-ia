ALTER TABLE "Company"
ADD COLUMN "siret" TEXT,
ADD COLUMN "address" TEXT,
ADD COLUMN "phone" TEXT;

ALTER TABLE "Automation"
ADD COLUMN "messageVersion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "approvalMode" TEXT NOT NULL DEFAULT 'first_then_auto',
ADD COLUMN "riskLevel" TEXT NOT NULL DEFAULT 'low',
ADD COLUMN "cadenceDays" INTEGER,
ADD COLUMN "maxSendsPerContact" INTEGER,
ADD COLUMN "replyToEmail" TEXT,
ADD COLUMN "approvedConfigHash" TEXT,
ADD COLUMN "lastApprovedAt" TIMESTAMP(3),
ADD COLUMN "lastApprovedBy" TEXT,
ADD COLUMN "configuredAt" TIMESTAMP(3);

ALTER TABLE "Prospect"
ADD COLUMN "contactCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "lastOutcome" TEXT,
ADD COLUMN "archivedAt" TIMESTAMP(3);

CREATE INDEX "Automation_companyId_status_idx" ON "Automation"("companyId", "status");
CREATE INDEX "Prospect_companyId_templateId_status_idx" ON "Prospect"("companyId", "templateId", "status");

CREATE TABLE "AutomationAuditEvent" (
  "id" TEXT NOT NULL,
  "automationId" TEXT NOT NULL,
  "actorUserId" TEXT,
  "eventType" TEXT NOT NULL,
  "detailsJson" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AutomationAuditEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AutomationAuditEvent_automationId_createdAt_idx" ON "AutomationAuditEvent"("automationId", "createdAt");
CREATE INDEX "AutomationAuditEvent_eventType_createdAt_idx" ON "AutomationAuditEvent"("eventType", "createdAt");
ALTER TABLE "AutomationAuditEvent" ADD CONSTRAINT "AutomationAuditEvent_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "Automation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "AutomationContactEvent" (
  "id" TEXT NOT NULL,
  "automationId" TEXT NOT NULL,
  "automationRunId" TEXT,
  "prospectId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "recipientName" TEXT NOT NULL,
  "recipientEmail" TEXT NOT NULL,
  "renderedSubject" TEXT,
  "renderedBody" TEXT,
  "provider" TEXT,
  "providerMessageId" TEXT,
  "messageVersion" INTEGER NOT NULL,
  "error" TEXT,
  "evidenceJson" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AutomationContactEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AutomationContactEvent_automationId_createdAt_idx" ON "AutomationContactEvent"("automationId", "createdAt");
CREATE INDEX "AutomationContactEvent_prospectId_createdAt_idx" ON "AutomationContactEvent"("prospectId", "createdAt");
CREATE INDEX "AutomationContactEvent_automationRunId_idx" ON "AutomationContactEvent"("automationRunId");
ALTER TABLE "AutomationContactEvent" ADD CONSTRAINT "AutomationContactEvent_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "Automation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AutomationContactEvent" ADD CONSTRAINT "AutomationContactEvent_automationRunId_fkey" FOREIGN KEY ("automationRunId") REFERENCES "AutomationRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AutomationContactEvent" ADD CONSTRAINT "AutomationContactEvent_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE;

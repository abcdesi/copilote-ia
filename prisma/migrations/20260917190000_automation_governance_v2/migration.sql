ALTER TABLE "Company"
ADD COLUMN "siret" TEXT,
ADD COLUMN "address" TEXT,
ADD COLUMN "phone" TEXT;

CREATE TABLE "CompanyMembership" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'viewer',
  "status" TEXT NOT NULL DEFAULT 'active',
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CompanyMembership_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CompanyMembership_companyId_userId_key" ON "CompanyMembership"("companyId", "userId");
CREATE INDEX "CompanyMembership_userId_status_idx" ON "CompanyMembership"("userId", "status");
CREATE INDEX "CompanyMembership_companyId_status_idx" ON "CompanyMembership"("companyId", "status");
ALTER TABLE "CompanyMembership" ADD CONSTRAINT "CompanyMembership_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompanyMembership" ADD CONSTRAINT "CompanyMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "CompanyMembership" ("id", "companyId", "userId", "role", "status", "joinedAt", "createdAt", "updatedAt")
SELECT 'cm_' || md5("id" || ':' || "userId"), "id", "userId", 'owner', 'active', "createdAt", "createdAt", CURRENT_TIMESTAMP
FROM "Company"
ON CONFLICT ("companyId", "userId") DO NOTHING;

CREATE TABLE "CompanyInvitation" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'viewer',
  "tokenHash" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "invitedByUserId" TEXT NOT NULL,
  "invitedByName" TEXT,
  "invitedByEmail" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CompanyInvitation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CompanyInvitation_tokenHash_key" ON "CompanyInvitation"("tokenHash");
CREATE INDEX "CompanyInvitation_companyId_status_idx" ON "CompanyInvitation"("companyId", "status");
CREATE INDEX "CompanyInvitation_email_status_idx" ON "CompanyInvitation"("email", "status");
ALTER TABLE "CompanyInvitation" ADD CONSTRAINT "CompanyInvitation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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

ALTER TABLE "AutomationRun"
ADD COLUMN "actorUserId" TEXT,
ADD COLUMN "actorName" TEXT,
ADD COLUMN "actorEmail" TEXT,
ADD COLUMN "actorRole" TEXT;

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
  "actorName" TEXT,
  "actorEmail" TEXT,
  "actorRole" TEXT,
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

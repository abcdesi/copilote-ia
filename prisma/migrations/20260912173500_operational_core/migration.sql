-- Operational core: real integrations, confirmation-gated actions, automation run history, Stripe ids.

CREATE TABLE "IntegrationConnection" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "accountLabel" TEXT,
  "externalAccountId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'connected',
  "permissionMode" TEXT NOT NULL DEFAULT 'read_action_confirm',
  "scopes" TEXT NOT NULL,
  "accessTokenEncrypted" TEXT NOT NULL,
  "refreshTokenEncrypted" TEXT,
  "expiresAt" TIMESTAMP(3),
  "lastSyncedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "IntegrationConnection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PendingAction" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "payloadJson" TEXT NOT NULL,
  "riskLevel" TEXT NOT NULL DEFAULT 'medium',
  "status" TEXT NOT NULL DEFAULT 'pending',
  "resultJson" TEXT,
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3),
  "executedAt" TIMESTAMP(3),
  CONSTRAINT "PendingAction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AutomationRun" (
  "id" TEXT NOT NULL,
  "automationId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'scheduled',
  "itemsProcessed" INTEGER NOT NULL DEFAULT 0,
  "durationMs" INTEGER,
  "errorCode" TEXT,
  "metadata" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  CONSTRAINT "AutomationRun_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Subscription" ADD COLUMN "stripeCustomerId" TEXT;
ALTER TABLE "Subscription" ADD COLUMN "stripeSubId" TEXT;
ALTER TABLE "Purchase" ALTER COLUMN "status" SET DEFAULT 'pending';
ALTER TABLE "Purchase" ALTER COLUMN "provider" SET DEFAULT 'stripe';

CREATE UNIQUE INDEX "IntegrationConnection_companyId_provider_key" ON "IntegrationConnection"("companyId", "provider");
CREATE INDEX "IntegrationConnection_companyId_status_idx" ON "IntegrationConnection"("companyId", "status");
CREATE INDEX "PendingAction_companyId_status_idx" ON "PendingAction"("companyId", "status");
CREATE INDEX "PendingAction_createdAt_idx" ON "PendingAction"("createdAt");
CREATE INDEX "AutomationRun_automationId_startedAt_idx" ON "AutomationRun"("automationId", "startedAt");
CREATE INDEX "AutomationRun_status_idx" ON "AutomationRun"("status");

ALTER TABLE "IntegrationConnection" ADD CONSTRAINT "IntegrationConnection_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PendingAction" ADD CONSTRAINT "PendingAction_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AutomationRun" ADD CONSTRAINT "AutomationRun_automationId_fkey"
  FOREIGN KEY ("automationId") REFERENCES "Automation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

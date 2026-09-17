ALTER TABLE "Subscription"
ADD COLUMN "currentPeriodStart" TIMESTAMP(3),
ADD COLUMN "billingInterval" TEXT;

CREATE TABLE "CreditPurchase" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "packKey" TEXT NOT NULL,
  "credits" INTEGER NOT NULL,
  "costBudgetEur" DOUBLE PRECISION NOT NULL,
  "amountEur" DOUBLE PRECISION NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'paid',
  "stripeCheckoutSessionId" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CreditPurchase_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CreditPurchase_stripeCheckoutSessionId_key" ON "CreditPurchase"("stripeCheckoutSessionId");
CREATE INDEX "CreditPurchase_companyId_status_createdAt_idx" ON "CreditPurchase"("companyId", "status", "createdAt");
CREATE INDEX "CreditPurchase_expiresAt_idx" ON "CreditPurchase"("expiresAt");
ALTER TABLE "CreditPurchase" ADD CONSTRAINT "CreditPurchase_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "SupportRequest" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "requesterEmail" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "priority" TEXT NOT NULL DEFAULT 'normal',
  "status" TEXT NOT NULL DEFAULT 'open',
  "contextJson" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SupportRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SupportRequest_companyId_status_createdAt_idx" ON "SupportRequest"("companyId", "status", "createdAt");
CREATE INDEX "SupportRequest_status_priority_createdAt_idx" ON "SupportRequest"("status", "priority", "createdAt");
ALTER TABLE "SupportRequest" ADD CONSTRAINT "SupportRequest_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

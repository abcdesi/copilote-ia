ALTER TABLE "Purchase"
  ADD COLUMN "paymentUrl" TEXT,
  ADD COLUMN "paidAt" TIMESTAMP(3),
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX "Purchase_providerRef_key"
  ON "Purchase"("providerRef");

CREATE UNIQUE INDEX "Purchase_companyId_opportunityId_key"
  ON "Purchase"("companyId", "opportunityId");

CREATE INDEX "Purchase_companyId_status_idx"
  ON "Purchase"("companyId", "status");

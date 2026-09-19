ALTER TABLE "Purchase"
  ADD COLUMN "termsVersion" TEXT,
  ADD COLUMN "termsAcceptedAt" TIMESTAMP(3),
  ADD COLUMN "termsAcceptedByUserId" TEXT,
  ADD COLUMN "termsAcceptedByEmail" TEXT,
  ADD COLUMN "immediateFulfillmentRequestedAt" TIMESTAMP(3),
  ADD COLUMN "deliveredAt" TIMESTAMP(3),
  ADD COLUMN "firstUsedAt" TIMESTAMP(3);

CREATE INDEX "Purchase_companyId_deliveredAt_idx"
  ON "Purchase"("companyId", "deliveredAt");

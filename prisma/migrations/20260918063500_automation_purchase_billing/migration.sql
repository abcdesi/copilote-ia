ALTER TABLE "Purchase"
  ADD COLUMN "paymentUrl" TEXT,
  ADD COLUMN "paidAt" TIMESTAMP(3),
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Defensive cleanup for legacy rows: keep one purchase per company/opportunity,
-- preferring an already-paid row, then the oldest record.
DELETE FROM "Purchase"
WHERE "id" IN (
  SELECT "id"
  FROM (
    SELECT
      "id",
      ROW_NUMBER() OVER (
        PARTITION BY "companyId", "opportunityId"
        ORDER BY CASE WHEN "status" = 'paid' THEN 0 ELSE 1 END, "createdAt" ASC
      ) AS rn
    FROM "Purchase"
  ) ranked
  WHERE ranked.rn > 1
);

CREATE UNIQUE INDEX "Purchase_providerRef_key"
  ON "Purchase"("providerRef");

CREATE UNIQUE INDEX "Purchase_companyId_opportunityId_key"
  ON "Purchase"("companyId", "opportunityId");

CREATE INDEX "Purchase_companyId_status_idx"
  ON "Purchase"("companyId", "status");

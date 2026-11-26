CREATE TABLE "SalesLead" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "stage" TEXT NOT NULL DEFAULT 'identified',
  "sector" TEXT,
  "sizeRange" TEXT,
  "objective" TEXT,
  "source" TEXT,
  "medium" TEXT,
  "campaign" TEXT,
  "content" TEXT,
  "emailVerifiedAt" TIMESTAMP(3),
  "marketingOptInAt" TIMESTAMP(3),
  "marketingOptOutAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SalesLead_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "SalesLeadEvent" (
  "id" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "dedupeKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SalesLeadEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SalesLead_email_key" ON "SalesLead"("email");
CREATE INDEX "SalesLead_stage_updatedAt_idx" ON "SalesLead"("stage", "updatedAt");
CREATE INDEX "SalesLead_source_campaign_idx" ON "SalesLead"("source", "campaign");
CREATE UNIQUE INDEX "SalesLeadEvent_dedupeKey_key" ON "SalesLeadEvent"("dedupeKey");
CREATE INDEX "SalesLeadEvent_leadId_createdAt_idx" ON "SalesLeadEvent"("leadId", "createdAt");
ALTER TABLE "SalesLeadEvent" ADD CONSTRAINT "SalesLeadEvent_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "SalesLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

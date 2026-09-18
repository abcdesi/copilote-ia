CREATE TABLE "AutomationOutcome" (
  "id" TEXT NOT NULL,
  "automationId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "value" DOUBLE PRECISION NOT NULL,
  "unit" TEXT NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'user_reported',
  "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.75,
  "note" TEXT,
  "evidenceJson" TEXT,
  "actorUserId" TEXT,
  "actorName" TEXT,
  "actorEmail" TEXT,
  "actorRole" TEXT,
  "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AutomationOutcome_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "AutomationOutcome"
  ADD CONSTRAINT "AutomationOutcome_automationId_fkey"
  FOREIGN KEY ("automationId") REFERENCES "Automation"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "AutomationOutcome_automationId_observedAt_idx"
  ON "AutomationOutcome"("automationId", "observedAt");

CREATE INDEX "AutomationOutcome_source_observedAt_idx"
  ON "AutomationOutcome"("source", "observedAt");

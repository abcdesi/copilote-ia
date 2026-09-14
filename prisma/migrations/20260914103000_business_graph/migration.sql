CREATE TABLE "BusinessEntity" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "canonicalKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "attributesJson" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "sourceCount" INTEGER NOT NULL DEFAULT 1,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessEntity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BusinessFact" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "subjectEntityId" TEXT NOT NULL,
    "predicate" TEXT NOT NULL,
    "objectEntityId" TEXT,
    "valueJson" TEXT,
    "sourceProvider" TEXT NOT NULL,
    "sourceRef" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "provenanceJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessFact_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BusinessEntity_companyId_type_canonicalKey_key" ON "BusinessEntity"("companyId", "type", "canonicalKey");
CREATE INDEX "BusinessEntity_companyId_type_idx" ON "BusinessEntity"("companyId", "type");
CREATE INDEX "BusinessEntity_companyId_status_idx" ON "BusinessEntity"("companyId", "status");
CREATE INDEX "BusinessFact_companyId_predicate_idx" ON "BusinessFact"("companyId", "predicate");
CREATE INDEX "BusinessFact_subjectEntityId_idx" ON "BusinessFact"("subjectEntityId");
CREATE INDEX "BusinessFact_objectEntityId_idx" ON "BusinessFact"("objectEntityId");
CREATE INDEX "BusinessFact_companyId_sourceProvider_idx" ON "BusinessFact"("companyId", "sourceProvider");

ALTER TABLE "BusinessEntity" ADD CONSTRAINT "BusinessEntity_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BusinessFact" ADD CONSTRAINT "BusinessFact_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BusinessFact" ADD CONSTRAINT "BusinessFact_subjectEntityId_fkey" FOREIGN KEY ("subjectEntityId") REFERENCES "BusinessEntity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BusinessFact" ADD CONSTRAINT "BusinessFact_objectEntityId_fkey" FOREIGN KEY ("objectEntityId") REFERENCES "BusinessEntity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

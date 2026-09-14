CREATE TABLE "BusinessIdentity" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "displayHint" TEXT,
    "sourceRef" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessIdentity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BusinessIdentity_companyId_provider_kind_sourceRef_key" ON "BusinessIdentity"("companyId", "provider", "kind", "sourceRef");
CREATE INDEX "BusinessIdentity_companyId_kind_fingerprint_idx" ON "BusinessIdentity"("companyId", "kind", "fingerprint");
CREATE INDEX "BusinessIdentity_entityId_idx" ON "BusinessIdentity"("entityId");
CREATE INDEX "BusinessIdentity_companyId_provider_idx" ON "BusinessIdentity"("companyId", "provider");

ALTER TABLE "BusinessIdentity" ADD CONSTRAINT "BusinessIdentity_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BusinessIdentity" ADD CONSTRAINT "BusinessIdentity_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "BusinessEntity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CompanyContextRevision" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "previousValueJson" TEXT,
    "nextValueJson" TEXT,
    "source" TEXT NOT NULL,
    "effectiveAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyContextRevision_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CompanyContextRevision_companyId_effectiveAt_idx"
ON "CompanyContextRevision"("companyId", "effectiveAt");

CREATE INDEX "CompanyContextRevision_companyId_section_effectiveAt_idx"
ON "CompanyContextRevision"("companyId", "section", "effectiveAt");

ALTER TABLE "CompanyContextRevision"
ADD CONSTRAINT "CompanyContextRevision_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
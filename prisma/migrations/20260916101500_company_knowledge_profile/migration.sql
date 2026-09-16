-- Enrichit le profil entreprise avec du contexte métier déclaré.
-- Ces champs alimentent la couverture de connaissance, le Business Graph et le copilote.
ALTER TABLE "Company"
  ADD COLUMN "businessModel" TEXT,
  ADD COLUMN "customerProfile" TEXT,
  ADD COLUMN "localContext" TEXT,
  ADD COLUMN "financeContext" TEXT,
  ADD COLUMN "marketingContext" TEXT,
  ADD COLUMN "accountingContext" TEXT,
  ADD COLUMN "salesContext" TEXT,
  ADD COLUMN "hrContext" TEXT,
  ADD COLUMN "operationsContext" TEXT;

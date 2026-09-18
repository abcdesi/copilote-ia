-- CompanyTool represents applications explicitly known/confirmed by the company.
-- API connections and observed facts carry their own provenance elsewhere.
UPDATE "CompanyTool" SET "detected" = false WHERE "detected" = true;

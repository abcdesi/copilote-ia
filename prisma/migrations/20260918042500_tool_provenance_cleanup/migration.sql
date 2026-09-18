-- CompanyTool represents applications explicitly known/confirmed by the company.
-- API connections and observed facts carry their own provenance elsewhere.
UPDATE "CompanyTool" SET "detected" = false WHERE "detected" = true;

-- Correct legacy managed graph provenance created from the old overloaded flag.
UPDATE "BusinessEntity"
SET "attributesJson" = '{"detected":false}'
WHERE "type" = 'tool'
  AND "attributesJson" LIKE '%"detected":true%';

UPDATE "BusinessFact"
SET "provenanceJson" = '{"method":"declared"}'
WHERE "sourceProvider" = 'pilotzia'
  AND "predicate" = 'uses'
  AND "sourceRef" LIKE 'graph:tool:%';

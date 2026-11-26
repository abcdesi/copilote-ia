import assert from "node:assert/strict";
import { parseAcquisition, campaignQuery } from "../lib/analytics/acquisition";

const campaign = { source: "instagram", medium: "organic_social", campaign: "c12", content: "v3" } as const;
assert.deepEqual(parseAcquisition(new URLSearchParams(campaignQuery(campaign))), campaign);
assert.equal(parseAcquisition(new URLSearchParams()), null);
assert.equal(parseAcquisition(new URLSearchParams("utm_source=unknown&utm_medium=organic_social&utm_campaign=c1")), null);
assert.equal(parseAcquisition(new URLSearchParams("utm_source=tiktok&utm_medium=organic_social&utm_campaign=person@example.com")), null);
assert.equal(parseAcquisition(new URLSearchParams("utm_source=tiktok&utm_medium=organic_social&utm_campaign=c1&utm_content=private")), null);
assert.deepEqual(parseAcquisition(new URLSearchParams("utm_source=tiktok&utm_medium=organic_social&utm_campaign=c1")), { source: "tiktok", medium: "organic_social", campaign: "c1" });
console.log("Acquisition tests passed");

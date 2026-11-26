import assert from "node:assert/strict";
import { advanceSalesStage, maySendMarketingEmail } from "../lib/sales/lifecycle";

assert.equal(advanceSalesStage("identified", "qualification_completed"), "qualified");
assert.equal(advanceSalesStage("qualified", "diagnostic_completed"), "diagnosed");
assert.equal(advanceSalesStage("diagnosed", "offer_prepared"), "offer_recommended");
assert.equal(advanceSalesStage("offer_recommended", "account_created"), "registered");
assert.equal(advanceSalesStage("registered", "trial_activated"), "trial");
assert.equal(advanceSalesStage("trial", "payment_confirmed"), "paying");
assert.equal(advanceSalesStage("paying", "renewal_confirmed"), "retained");
assert.equal(advanceSalesStage("identified", "payment_confirmed"), "identified");
assert.equal(advanceSalesStage("closed", "account_created"), "closed");
assert.equal(maySendMarketingEmail({ optedIn: true, optedOut: false, verifiedEmail: true }), true);
assert.equal(maySendMarketingEmail({ optedIn: true, optedOut: true, verifiedEmail: true }), false);
assert.equal(maySendMarketingEmail({ optedIn: false, optedOut: false, verifiedEmail: true }), false);
assert.equal(maySendMarketingEmail({ optedIn: true, optedOut: false, verifiedEmail: false }), false);
console.log("Sales lifecycle tests passed");

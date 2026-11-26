// Pilotzia's own commercial lifecycle, separate from customer Prospect records.
export const SALES_STAGES = ["identified", "qualified", "diagnosed", "offer_recommended", "registered", "trial", "paying", "retained", "closed"] as const;
export type SalesStage = typeof SALES_STAGES[number];
export type SalesSignal = "contact_verified" | "qualification_completed" | "diagnostic_completed" | "offer_prepared" | "account_created" | "trial_activated" | "payment_confirmed" | "renewal_confirmed" | "closed";
const transitions: Partial<Record<SalesStage, Partial<Record<SalesSignal, SalesStage>>>> = {
  identified: { qualification_completed: "qualified", diagnostic_completed: "diagnosed", account_created: "registered", closed: "closed" },
  qualified: { diagnostic_completed: "diagnosed", offer_prepared: "offer_recommended", account_created: "registered", closed: "closed" },
  diagnosed: { offer_prepared: "offer_recommended", account_created: "registered", closed: "closed" },
  offer_recommended: { account_created: "registered", closed: "closed" },
  registered: { trial_activated: "trial", payment_confirmed: "paying", closed: "closed" },
  trial: { payment_confirmed: "paying", closed: "closed" },
  paying: { renewal_confirmed: "retained", closed: "closed" },
  retained: { closed: "closed" },
};
// Payment signals must originate from verified provider events, never browser input.
// This pure function does not persist data or authorize any external action.
export function advanceSalesStage(stage: SalesStage, signal: SalesSignal): SalesStage {
  return transitions[stage]?.[signal] ?? stage;
}
export function maySendMarketingEmail(input: { optedIn: boolean; optedOut: boolean; verifiedEmail: boolean }): boolean {
  return input.verifiedEmail && input.optedIn && !input.optedOut;
}

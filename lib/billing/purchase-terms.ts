export const AUTOMATION_PURCHASE_TERMS_VERSION = "2026-09-19";
export const AUTOMATION_PURCHASE_PRODUCT_KIND = "b2b_digital_automation";

export function acceptsCurrentAutomationPurchaseTerms(input: unknown) {
  if (!input || typeof input !== "object") return false;
  const value = input as Record<string, unknown>;
  return (
    value.acceptDigitalTerms === true &&
    value.termsVersion === AUTOMATION_PURCHASE_TERMS_VERSION
  );
}

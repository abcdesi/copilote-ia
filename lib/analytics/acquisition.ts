// Campaign labels are deliberately restricted to controlled, non-personal identifiers.
// This module does not read cookies, persist identifiers or transmit events.
export const ACQUISITION_SOURCES = ["tiktok", "instagram", "facebook", "linkedin", "youtube", "google", "partner", "newsletter"] as const;
export const ACQUISITION_MEDIA = ["organic_social", "paid_social", "organic_search", "paid_search", "referral", "email"] as const;
export type AcquisitionSource = typeof ACQUISITION_SOURCES[number];
export type AcquisitionMedium = typeof ACQUISITION_MEDIA[number];
export type AcquisitionCampaign = { source: AcquisitionSource; medium: AcquisitionMedium; campaign: string; content?: string };

function isMember<T extends string>(values: readonly T[], value: string): value is T {
  return values.some((item) => item === value);
}

// Only numbered campaign/content identifiers; never arbitrary user-supplied text.
const campaignPattern = /^c[0-9]{1,9}$/;
const contentPattern = /^v[0-9]{1,9}$/;

export function parseAcquisition(params: URLSearchParams): AcquisitionCampaign | null {
  const source = params.get("utm_source") ?? "";
  const medium = params.get("utm_medium") ?? "";
  const campaign = params.get("utm_campaign") ?? "";
  const content = params.get("utm_content") ?? "";
  if (!isMember(ACQUISITION_SOURCES, source) || !isMember(ACQUISITION_MEDIA, medium) || !campaignPattern.test(campaign)) return null;
  if (content && !contentPattern.test(content)) return null;
  return { source, medium, campaign, ...(content ? { content } : {}) };
}

export function campaignQuery(campaign: AcquisitionCampaign): string {
  const params = new URLSearchParams({ utm_source: campaign.source, utm_medium: campaign.medium, utm_campaign: campaign.campaign });
  if (campaign.content) params.set("utm_content", campaign.content);
  if (!parseAcquisition(params)) throw new Error("Invalid acquisition campaign");
  return params.toString();
}

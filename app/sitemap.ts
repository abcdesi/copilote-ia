import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/config";
import { MARKETING_SOLUTIONS } from "@/lib/marketing/solutions";

const PUBLIC_PATHS = ["/", "/faq", "/cgv", "/confidentialite", "/mentions-legales"];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const staticEntries: MetadataRoute.Sitemap = PUBLIC_PATHS.map((path, index) => ({
    url: `${SITE_URL}${path}`,
    lastModified: now,
    changeFrequency: path === "/" ? "weekly" : path === "/faq" ? "monthly" : "yearly",
    priority: path === "/" ? 1 : index === 1 ? 0.8 : 0.3,
  }));

  const solutionEntries: MetadataRoute.Sitemap = MARKETING_SOLUTIONS.map((solution) => ({
    url: `${SITE_URL}/solutions/${solution.slug}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.75,
  }));

  return [...staticEntries, ...solutionEntries];
}

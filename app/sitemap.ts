import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/config";

const PUBLIC_PATHS = ["/", "/faq", "/cgv", "/confidentialite", "/mentions-legales"];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return PUBLIC_PATHS.map((path, index) => ({
    url: `${SITE_URL}${path}`,
    lastModified: now,
    changeFrequency: path === "/" ? "weekly" : path === "/faq" ? "monthly" : "yearly",
    priority: path === "/" ? 1 : index === 1 ? 0.8 : 0.3,
  }));
}

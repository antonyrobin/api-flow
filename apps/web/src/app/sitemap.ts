import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/config";

// Generated once at build time (static export)
export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    { url: `${SITE_URL}/`, lastModified, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/register`, lastModified, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/login`, lastModified, changeFrequency: "monthly", priority: 0.4 },
  ];
}

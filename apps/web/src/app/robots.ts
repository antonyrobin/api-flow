import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/config";

// Generated once at build time (static export)
export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/monitors", "/api/"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}

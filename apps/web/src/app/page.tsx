import { Workspace } from "@/components/workspace/Workspace";
import { SITE, SITE_URL } from "@/lib/config";

/**
 * Home — the API testing workspace.
 * Server component so structured data and the page heading are in the initial HTML.
 */
export default function HomePage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: SITE.name,
    url: SITE_URL,
    description: SITE.description,
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Any (web browser)",
    browserRequirements: "Requires JavaScript",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    featureList: [
      "Send GET, POST, PUT, PATCH, DELETE, HEAD and OPTIONS requests",
      "Headers, query parameters, JSON/XML/text bodies",
      "Bearer, Basic and API key authentication",
      "Response timing breakdown",
      "Save requests to your account",
      "Monitor multiple endpoints with scheduled health checks",
      "Download monitor logs as CSV or JSON",
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        // JSON-LD is static, built from constants
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <h1 className="sr-only">{SITE.title}</h1>
      <p className="sr-only">{SITE.description}</p>
      <Workspace />
    </>
  );
}

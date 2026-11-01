import { ImageResponse } from "next/og";
import { SITE } from "@/lib/config";

// Generated once at build time (static export)
export const dynamic = "force-static";

export const alt = SITE.title;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Statically generated at build time
export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "linear-gradient(135deg, #042f2e 0%, #0a0a0f 55%, #083344 100%)",
          color: "#f3f4f6",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
          <div
            style={{
              width: "88px",
              height: "88px",
              borderRadius: "22px",
              background: "linear-gradient(135deg, #14b8a6, #0891b2 55%, #4338ca)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="56" height="56" viewBox="0 0 64 64">
          <circle cx="16" cy="20" r="5.5" fill="#fff" />
          <path d="M21 20h6c11 0 1 24 12 24h3" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M41 36.5 50 44l-9 7.5z" fill="#fff" stroke="#fff" strokeWidth="2" strokeLinejoin="round" />
          <circle cx="46" cy="18" r="3" fill="#99f6e4" />
        </svg>
          </div>
          <div style={{ fontSize: "64px", fontWeight: 700, color: "#5eead4" }}>API Flow</div>
        </div>
        <div style={{ marginTop: "48px", fontSize: "56px", fontWeight: 700, lineHeight: 1.15 }}>
          Test, save &amp; monitor APIs from your browser
        </div>
        <div style={{ marginTop: "28px", fontSize: "30px", color: "#9ca3af" }}>
          Free REST client · No sign-up to test · Multi-endpoint health checks
        </div>
        <div style={{ display: "flex", gap: "16px", marginTop: "48px" }}>
          {["GET", "POST", "PUT", "PATCH", "DELETE"].map((m, i) => (
            <div
              key={m}
              style={{
                padding: "10px 22px",
                borderRadius: "10px",
                fontSize: "26px",
                fontWeight: 700,
                color: ["#22c55e", "#3b82f6", "#f59e0b", "#a855f7", "#ef4444"][i],
                border: "2px solid rgba(255,255,255,0.12)",
              }}
            >
              {m}
            </div>
          ))}
        </div>
      </div>
    ),
    size
  );
}

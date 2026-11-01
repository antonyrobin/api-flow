import { ImageResponse } from "next/og";

// Generated once at build time (static export)
export const dynamic = "force-static";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #14b8a6, #0891b2 55%, #4338ca)",
          borderRadius: "40px",
        }}
      >
        <svg width="110" height="110" viewBox="0 0 64 64">
          <circle cx="16" cy="20" r="5.5" fill="#fff" />
          <path d="M21 20h6c11 0 1 24 12 24h3" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M41 36.5 50 44l-9 7.5z" fill="#fff" stroke="#fff" strokeWidth="2" strokeLinejoin="round" />
          <circle cx="46" cy="18" r="3" fill="#99f6e4" />
        </svg>
      </div>
    ),
    size
  );
}

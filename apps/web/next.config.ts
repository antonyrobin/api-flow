import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@api-flow/shared"],

  // Cloudflare Pages output
  // output: "standalone",

  // Allow API proxy in development
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8787"}/:path*`,
      },
    ];
  },
};

export default nextConfig;

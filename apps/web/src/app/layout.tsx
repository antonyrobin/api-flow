import type { Metadata } from "next";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "API Flow — Modern API Testing Platform",
  description:
    "A beautiful, powerful API testing tool. Test, organize, and schedule API calls with an intuitive interface. Like Postman, but built for the modern web.",
  keywords: ["API testing", "REST client", "HTTP client", "Postman alternative"],
  authors: [{ name: "API Flow" }],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="min-h-screen bg-surface-0 font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { MonitorsDashboard } from "@/components/monitors/MonitorsDashboard";

export const metadata: Metadata = {
  title: "API Monitors — Heartbeat & Health Checks",
  description:
    "Monitor multiple API endpoints at once with custom check intervals. View uptime, response times and status codes, and download or clear check logs.",
  alternates: { canonical: "/monitors" },
  // Account-specific dashboard
  robots: { index: false, follow: true },
};

export default function MonitorsPage() {
  return <MonitorsDashboard />;
}

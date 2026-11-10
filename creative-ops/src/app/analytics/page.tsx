import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { getCurrentUser } from "@/lib/session";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { AnalyticsDashboard } from "@/components/analytics/analytics-dashboard";
import { getTeamAnalytics } from "@/server/services/analytics.service";

export const dynamic = "force-dynamic";
export default async function AnalyticsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== Role.MANAGER) redirect("/");
  const initialData = await getTeamAnalytics(user, {});
  return <DashboardShell user={user}><AnalyticsDashboard initialData={JSON.parse(JSON.stringify(initialData))}/></DashboardShell>;
}

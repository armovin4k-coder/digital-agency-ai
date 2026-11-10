import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { listActivity } from "@/server/services/task.service";
import { HistoryFeed } from "@/components/history/history-feed";

export const dynamic = "force-dynamic";
export default async function HistoryPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const initial = await listActivity(user, { page: 1, limit: 30 });
  const serializable = JSON.parse(JSON.stringify(initial));
  return <DashboardShell user={user}><HistoryFeed initial={serializable}/></DashboardShell>;
}

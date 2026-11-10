import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { KanbanBoard } from "@/components/kanban/kanban-board";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return (
    <DashboardShell user={user}>
      <KanbanBoard user={{ id: user.id, name: user.name, role: user.role }} />
    </DashboardShell>
  );
}

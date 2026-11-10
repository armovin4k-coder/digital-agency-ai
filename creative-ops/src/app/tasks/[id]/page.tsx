import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getTaskById } from "@/server/services/task.service";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { TaskDetail } from "@/components/tasks/task-detail";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };
export default async function TaskPage({ params }: PageProps) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  try {
    const task = await getTaskById(user, id);
    const serializable = JSON.parse(JSON.stringify(task, (_key, value) => {
      if (value && typeof value === "object" && typeof value.toNumber === "function") return value.toString();
      return value;
    }));
    return <DashboardShell user={user}><TaskDetail task={serializable} user={{ id: user.id, name: user.name, role: user.role }} /></DashboardShell>;
  } catch (error) {
    if (error instanceof Error && "status" in error && (error as { status?: number }).status === 404) notFound();
    if (error instanceof Error && "status" in error && (error as { status?: number }).status === 403) redirect("/");
    throw error;
  }
}

import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { getCurrentUser } from "@/lib/session";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { CreateTaskForm } from "@/components/tasks/create-task-form";

export const dynamic = "force-dynamic";

export default async function NewTaskPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== Role.BUYER) redirect("/");
  return (
    <DashboardShell user={user}>
      <CreateTaskForm />
    </DashboardShell>
  );
}

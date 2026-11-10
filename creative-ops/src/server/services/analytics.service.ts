import { Role, TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { calculateTaskDurations, average, sumCredits } from "@/lib/metrics";

const DAY = 24 * 60 * 60 * 1000;

function safeRange(from?: string, to?: string) {
  const now = new Date();
  const end = to ? new Date(`${to}T23:59:59.999Z`) : now;
  const start = from ? new Date(`${from}T00:00:00.000Z`) : new Date(now.getTime() - 29 * DAY);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    throw new AppError("Некорректный период аналитики.", 400, "INVALID_DATE_RANGE");
  }
  return { start, end };
}

export async function getTeamAnalytics(actor: { id: string; role: Role }, range: { from?: string; to?: string }) {
  if (actor.role !== Role.MANAGER) throw new AppError("Аналитика доступна только руководителю.", 403, "FORBIDDEN");
  const { start, end } = safeRange(range.from, range.to);
  const now = new Date();
  const [createdTasks, completedTasks, activeTasks, usages, creatives] = await Promise.all([
    // Task volume and status distribution are based on creation date.
    prisma.task.findMany({
      where: { createdAt: { gte: start, lte: end } },
      select: {
        id: true,
        status: true,
        deadline: true,
        assigneeId: true,
        revisionCount: true,
      },
    }),
    // Production time is based on completion date, so older tasks completed
    // during the selected period are included in the performance metrics.
    prisma.task.findMany({
      where: { status: TaskStatus.DONE, completedAt: { gte: start, lte: end } },
      select: {
        id: true,
        assigneeId: true,
        createdAt: true,
        takenAt: true,
        completedAt: true,
        submittedAt: true,
        revisionCount: true,
      },
    }),
    // Current workload is a live snapshot and is intentionally independent
    // of the reporting period.
    prisma.task.findMany({
      where: {
        status: { in: [TaskStatus.IN_PROGRESS, TaskStatus.REVIEW, TaskStatus.REVISION] },
        assigneeId: { not: null },
      },
      select: { assigneeId: true, status: true },
    }),
    prisma.aiUsage.findMany({
      where: { createdAt: { gte: start, lte: end } },
      include: { user: { select: { id: true, name: true, role: true } } },
    }),
    prisma.user.findMany({
      where: { role: Role.CREATIVE },
      select: { id: true, name: true, avatar: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const overdueTasks = createdTasks.filter((task) => task.status !== TaskStatus.DONE && task.deadline < now);
  const production = completedTasks
    .map((task) => calculateTaskDurations(task).productionMs)
    .filter((value): value is number => value !== null);
  const fullCycle = completedTasks
    .map((task) => calculateTaskDurations(task).fullCycleMs)
    .filter((value): value is number => value !== null);

  const statusOrder: TaskStatus[] = [TaskStatus.NEW, TaskStatus.IN_PROGRESS, TaskStatus.REVIEW, TaskStatus.REVISION, TaskStatus.DONE];
  const statusLabels: Record<TaskStatus, string> = {
    NEW: "Новые",
    IN_PROGRESS: "В работе",
    REVIEW: "На проверке",
    REVISION: "Правки",
    DONE: "Готово",
  };
  const statuses = statusOrder.map((status) => ({
    status,
    label: statusLabels[status],
    count: createdTasks.filter((task) => task.status === status).length,
  }));

  const workload = creatives.map((creative) => ({
    id: creative.id,
    name: creative.name,
    active: awaitCountActive(creative.id, activeTasks),
  }));

  const performerTime = creatives.map((creative) => {
    const values = completedTasks
      .filter((task) => task.assigneeId === creative.id)
      .map((task) => calculateTaskDurations(task).productionMs)
      .filter((value): value is number => value !== null);
    return {
      id: creative.id,
      name: creative.name,
      averageHours: values.length ? Number((average(values)! / 3_600_000).toFixed(1)) : 0,
      completed: values.length,
    };
  });

  const serviceMap = new Map<string, number>();
  const personMap = new Map<string, { name: string; credits: number }>();
  for (const usage of usages) {
    const credits = Number(usage.credits);
    serviceMap.set(usage.service, (serviceMap.get(usage.service) ?? 0) + credits);
    const current = personMap.get(usage.userId) ?? { name: usage.user.name, credits: 0 };
    current.credits += credits;
    personMap.set(usage.userId, current);
  }

  const overdueByPerson = creatives.map((creative) => ({
    id: creative.id,
    name: creative.name,
    count: overdueTasks.filter((task) => task.assigneeId === creative.id).length,
  }));

  const performers = creatives.map((creative) => {
    const createdByPerson = createdTasks.filter((task) => task.assigneeId === creative.id);
    const completedByPerson = completedTasks.filter((task) => task.assigneeId === creative.id);
    const durationValues = completedByPerson
      .map((task) => calculateTaskDurations(task).productionMs)
      .filter((value): value is number => value !== null);
    const aiCredits = usages
      .filter((usage) => usage.userId === creative.id)
      .reduce((sum, usage) => sum + Number(usage.credits), 0);
    return {
      id: creative.id,
      name: creative.name,
      tasks: createdByPerson.length,
      completed: completedByPerson.length,
      averageHours: durationValues.length ? Number((average(durationValues)! / 3_600_000).toFixed(1)) : null,
      revisions: createdByPerson.reduce((sum, task) => sum + task.revisionCount, 0),
      credits: Number(aiCredits.toFixed(2)),
    };
  });

  return {
    period: { from: start.toISOString(), to: end.toISOString() },
    kpi: {
      totalTasks: createdTasks.length,
      inProgress: createdTasks.filter((task) => task.status === TaskStatus.IN_PROGRESS).length,
      overdue: overdueTasks.length,
      averageProductionHours: production.length ? Number((average(production)! / 3_600_000).toFixed(1)) : null,
      averageFullCycleHours: fullCycle.length ? Number((average(fullCycle)! / 3_600_000).toFixed(1)) : null,
      aiCredits: Number(sumCredits(usages.map((usage) => usage.credits.toString())).toFixed(2)),
    },
    statuses,
    workload,
    performerTime,
    creditsByService: [...serviceMap.entries()].map(([service, credits]) => ({ service, credits: Number(credits.toFixed(2)) })),
    creditsByPerson: [...personMap.entries()].map(([id, value]) => ({ id, ...value, credits: Number(value.credits.toFixed(2)) })),
    overdueByPerson,
    performers,
  };
}

function awaitCountActive(userId: string, tasks: Array<{ assigneeId: string | null; status: TaskStatus }>) {
  return tasks.filter((task) => task.assigneeId === userId).length;
}

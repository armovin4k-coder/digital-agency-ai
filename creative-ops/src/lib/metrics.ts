export type MetricTask = {
  createdAt: Date;
  takenAt: Date | null;
  submittedAt: Date | null;
  completedAt: Date | null;
  revisionCount: number;
};

export type TaskDurations = {
  productionMs: number | null;
  fullCycleMs: number | null;
  waitingMs: number | null;
};

export function calculateTaskDurations(task: MetricTask): TaskDurations {
  return {
    productionMs: task.completedAt && task.takenAt
      ? Math.max(0, task.completedAt.getTime() - task.takenAt.getTime())
      : null,
    fullCycleMs: task.completedAt
      ? Math.max(0, task.completedAt.getTime() - task.createdAt.getTime())
      : null,
    waitingMs: task.takenAt
      ? Math.max(0, task.takenAt.getTime() - task.createdAt.getTime())
      : null,
  };
}

export function average(values: Array<number | null | undefined>): number | null {
  const valid = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (valid.length === 0) return null;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

export function sumCredits(values: Array<number | string>): number {
  return values.reduce<number>((sum, value) => sum + Number(value), 0);
}

export function getCurrentRevisionRound(revisionCount: number): number {
  return Math.max(0, revisionCount);
}

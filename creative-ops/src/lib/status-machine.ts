import { Role, TaskStatus } from "@prisma/client";
import { AppError } from "@/lib/errors";

const statusLabels: Record<TaskStatus, string> = {
  [TaskStatus.NEW]: "Новые",
  [TaskStatus.IN_PROGRESS]: "В работе",
  [TaskStatus.REVIEW]: "На проверке",
  [TaskStatus.REVISION]: "Правки",
  [TaskStatus.DONE]: "Готово",
};

export type TransitionContext = {
  role: Role;
  from: TaskStatus;
  to: TaskStatus;
  isBuyer: boolean;
  isAssignee: boolean;
  hasResult: boolean;
  comment?: string | null;
};

export function validateTransition(context: TransitionContext): void {
  const { role, from, to, isBuyer, isAssignee, hasResult, comment } = context;

  if (from === TaskStatus.NEW && to === TaskStatus.IN_PROGRESS && role === Role.CREATIVE) {
    return;
  }
  if (from === TaskStatus.REVISION && to === TaskStatus.IN_PROGRESS && role === Role.CREATIVE && isAssignee) {
    return;
  }
  if (from === TaskStatus.IN_PROGRESS && to === TaskStatus.REVIEW && role === Role.CREATIVE && isAssignee) {
    if (!hasResult) {
      throw new AppError("Перед сдачей приложите хотя бы один файл с результатом.", 422, "RESULT_REQUIRED");
    }
    return;
  }
  if (from === TaskStatus.REVIEW && to === TaskStatus.DONE && role === Role.BUYER && isBuyer) {
    return;
  }
  if (from === TaskStatus.REVIEW && to === TaskStatus.REVISION && role === Role.BUYER && isBuyer) {
    if (!comment?.trim()) {
      throw new AppError("Для возврата на правки обязательно оставьте комментарий.", 422, "COMMENT_REQUIRED");
    }
    return;
  }

  const validActorForTarget =
    (role === Role.CREATIVE && isAssignee && to === TaskStatus.IN_PROGRESS) ||
    (role === Role.CREATIVE && isAssignee && to === TaskStatus.REVIEW) ||
    (role === Role.BUYER && isBuyer && (to === TaskStatus.DONE || to === TaskStatus.REVISION));
  if (validActorForTarget) {
    throw new AppError("Статус задачи уже изменился. Обновите страницу и повторите действие.", 409, "INVALID_STATUS");
  }

  throw new AppError(
    `Переход из статуса «${statusLabels[from]}» в «${statusLabels[to]}» запрещён для вашей роли или этой задачи.`,
    403,
    "INVALID_TRANSITION",
  );
}

export function allowedNextStatuses(role: Role, status: TaskStatus, isBuyer: boolean, isAssignee: boolean): TaskStatus[] {
  if (role === Role.CREATIVE) {
    if (status === TaskStatus.NEW) return [TaskStatus.IN_PROGRESS];
    if (status === TaskStatus.REVISION && isAssignee) return [TaskStatus.IN_PROGRESS];
    if (status === TaskStatus.IN_PROGRESS && isAssignee) return [TaskStatus.REVIEW];
  }
  if (role === Role.BUYER && isBuyer && status === TaskStatus.REVIEW) {
    return [TaskStatus.DONE, TaskStatus.REVISION];
  }
  return [];
}

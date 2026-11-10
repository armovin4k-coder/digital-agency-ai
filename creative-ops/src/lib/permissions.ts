import { Role, TaskStatus } from "@prisma/client";
import { AppError } from "@/lib/errors";

type UserIdentity = { id: string; role: Role };
type TaskIdentity = { buyerId: string; assigneeId: string | null; status: TaskStatus };

export function canViewTask(user: UserIdentity, task: TaskIdentity): boolean {
  if (user.role === Role.MANAGER) return true;
  if (user.role === Role.BUYER) return task.buyerId === user.id;
  return task.status === TaskStatus.NEW || task.assigneeId === user.id;
}

export function assertCanViewTask(user: UserIdentity, task: TaskIdentity): void {
  if (!canViewTask(user, task)) {
    throw new AppError("У вас нет доступа к этой задаче.", 403, "FORBIDDEN");
  }
}

export function assertRole(user: UserIdentity, allowed: Role[], message = "Недостаточно прав для выполнения действия."): void {
  if (!allowed.includes(user.role)) {
    throw new AppError(message, 403, "FORBIDDEN");
  }
}

import {
  AiService,
  AttachmentType,
  Priority,
  Prisma,
  Role,
  TaskStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AppError, assertFound } from "@/lib/errors";
import { assertCanViewTask, assertRole } from "@/lib/permissions";
import { getCurrentRevisionRound } from "@/lib/metrics";
import { validateTransition } from "@/lib/status-machine";

type Actor = { id: string; role: Role };
type CreateTaskInput = {
  offer: string;
  geo: string;
  creativeType: Prisma.TaskCreateInput["creativeType"];
  quantity: number;
  description: string;
  references: string[];
  priority: Prisma.TaskCreateInput["priority"];
  deadline: Date;
};
type UpdateTaskInput = Partial<CreateTaskInput>;

const taskDetailInclude = {
  buyer: { select: { id: true, name: true, email: true, avatar: true } },
  assignee: { select: { id: true, name: true, email: true, avatar: true } },
  attachments: { orderBy: { createdAt: "asc" as const }, include: { user: { select: { id: true, name: true, avatar: true } } } },
  aiUsages: { orderBy: { createdAt: "asc" as const }, include: { user: { select: { id: true, name: true } } } },
  comments: { orderBy: { createdAt: "asc" as const }, include: { user: { select: { id: true, name: true, avatar: true, role: true } } } },
  activityLogs: { orderBy: { createdAt: "asc" as const }, include: { user: { select: { id: true, name: true, avatar: true, role: true } } } },
} satisfies Prisma.TaskInclude;

export async function listTasks(actor: Actor, filters: {
  status?: TaskStatus;
  priority?: Priority;
  geo?: string;
  offer?: string;
  assigneeId?: string;
  mine?: boolean;
  page: number;
  limit: number;
}) {
  const where: Prisma.TaskWhereInput = {};

  if (actor.role === Role.BUYER) where.buyerId = actor.id;
  if (actor.role === Role.CREATIVE) {
    where.OR = [{ status: TaskStatus.NEW }, { assigneeId: actor.id }];
  }
  if (actor.role === Role.CREATIVE && filters.mine) where.assigneeId = actor.id;
  if (filters.status) where.status = filters.status;
  if (filters.priority) where.priority = filters.priority;
  if (filters.geo) where.geo = { equals: filters.geo.toUpperCase(), mode: "insensitive" };
  if (filters.offer) where.offer = { contains: filters.offer, mode: "insensitive" };
  if (filters.assigneeId) where.assigneeId = filters.assigneeId;

  const [items, total] = await prisma.$transaction([
    prisma.task.findMany({
      where,
      include: {
        buyer: { select: { id: true, name: true, avatar: true } },
        assignee: { select: { id: true, name: true, avatar: true } },
        _count: { select: { attachments: true, comments: true, aiUsages: true } },
      },
      orderBy: [{ deadline: "asc" }, { createdAt: "desc" }],
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
    }),
    prisma.task.count({ where }),
  ]);

  return { items, page: filters.page, limit: filters.limit, total, pages: Math.ceil(total / filters.limit) };
}

export async function getTaskById(actor: Actor, taskId: string) {
  const task = assertFound(
    await prisma.task.findUnique({ where: { id: taskId }, include: taskDetailInclude }),
    "Задача не найдена.",
  );
  assertCanViewTask(actor, task);
  return task;
}

export async function createTask(actor: Actor, input: CreateTaskInput) {
  assertRole(actor, [Role.BUYER], "Создавать задачи может только байер.");
  return prisma.$transaction(async (tx) => {
    const task = await tx.task.create({
      data: {
        ...input,
        buyerId: actor.id,
        status: TaskStatus.NEW,
      },
    });
    await tx.activityLog.create({
      data: {
        taskId: task.id,
        userId: actor.id,
        action: "TASK_CREATED",
        meta: { offer: task.offer, geo: task.geo, quantity: task.quantity },
      },
    });
    return task;
  });
}

export async function updateTask(actor: Actor, taskId: string, input: UpdateTaskInput) {
  assertRole(actor, [Role.BUYER], "Редактировать ТЗ может только байер.");
  return prisma.$transaction(async (tx) => {
    const current = assertFound(await tx.task.findUnique({ where: { id: taskId } }), "Задача не найдена.");
    if (current.buyerId !== actor.id) throw new AppError("Нельзя редактировать чужую задачу.", 403, "FORBIDDEN");
    if (current.status !== TaskStatus.NEW) {
      throw new AppError("Редактировать можно только задачи со статусом «Новые».", 403, "TASK_LOCKED");
    }

    const changed = await tx.task.updateMany({
      where: { id: taskId, buyerId: actor.id, status: TaskStatus.NEW },
      data: input,
    });
    if (changed.count !== 1) throw new AppError("Задача уже была изменена другим запросом.", 409, "CONCURRENT_UPDATE");

    await tx.activityLog.create({
      data: { taskId, userId: actor.id, action: "TASK_UPDATED", meta: { fields: Object.keys(input) } },
    });
    return tx.task.findUniqueOrThrow({ where: { id: taskId } });
  });
}

export async function transitionTask(
  actor: Actor,
  taskId: string,
  targetStatus: TaskStatus,
  comment?: string,
) {
  try {
    return await prisma.$transaction(async (tx) => {
    const task = assertFound(await tx.task.findUnique({ where: { id: taskId } }), "Задача не найдена.");
    const isBuyer = task.buyerId === actor.id;
    const isAssignee = task.assigneeId === actor.id;
    if (
      actor.role === Role.CREATIVE
      && targetStatus === TaskStatus.IN_PROGRESS
      && task.status === TaskStatus.IN_PROGRESS
      && task.assigneeId !== actor.id
    ) {
      throw new AppError("Задачу уже взял другой исполнитель.", 409, "TASK_ALREADY_TAKEN");
    }
    const currentRevisionRound = getCurrentRevisionRound(task.revisionCount);
    const resultAttachment = task.status === TaskStatus.IN_PROGRESS && targetStatus === TaskStatus.REVIEW
      ? await tx.attachment.findFirst({
          where: { taskId, type: AttachmentType.RESULT, revisionRound: currentRevisionRound },
          select: { id: true },
        })
      : null;

    validateTransition({
      role: actor.role,
      from: task.status,
      to: targetStatus,
      isBuyer,
      isAssignee,
      hasResult: Boolean(resultAttachment),
      comment,
    });

    const now = new Date();
    const where: Prisma.TaskWhereInput = { id: taskId, status: task.status };
    const data: Prisma.TaskUncheckedUpdateManyInput = { status: targetStatus };

    if (task.status === TaskStatus.NEW && targetStatus === TaskStatus.IN_PROGRESS) {
      where.assigneeId = null;
      data.assigneeId = actor.id;
      data.takenAt = task.takenAt ?? now;
    } else if (actor.role === Role.CREATIVE) {
      where.assigneeId = actor.id;
    } else if (actor.role === Role.BUYER) {
      where.buyerId = actor.id;
    }

    if (targetStatus === TaskStatus.REVIEW) data.submittedAt = now;
    if (targetStatus === TaskStatus.DONE) data.completedAt = now;
    if (targetStatus === TaskStatus.REVISION) data.revisionCount = { increment: 1 };

    const updated = await tx.task.updateMany({ where, data });
    if (updated.count !== 1) {
      throw new AppError("Задача уже изменилась. Обновите страницу и повторите действие.", 409, "CONCURRENT_TRANSITION");
    }

    const actionByTransition: Record<string, string> = {
      [`${TaskStatus.NEW}:${TaskStatus.IN_PROGRESS}`]: "TASK_TAKEN",
      [`${TaskStatus.REVISION}:${TaskStatus.IN_PROGRESS}`]: "TASK_REVISION_STARTED",
      [`${TaskStatus.IN_PROGRESS}:${TaskStatus.REVIEW}`]: "TASK_SUBMITTED",
      [`${TaskStatus.REVIEW}:${TaskStatus.DONE}`]: "TASK_ACCEPTED",
      [`${TaskStatus.REVIEW}:${TaskStatus.REVISION}`]: "TASK_RETURNED_FOR_REVISION",
    };
    const action = actionByTransition[`${task.status}:${targetStatus}`];

    if (targetStatus === TaskStatus.REVISION && comment?.trim()) {
      await tx.comment.create({ data: { taskId, userId: actor.id, text: comment.trim() } });
      await tx.activityLog.create({
        data: { taskId, userId: actor.id, action: "COMMENT_ADDED", meta: { kind: "revision_feedback" } },
      });
    }

    await tx.activityLog.create({
      data: {
        taskId,
        userId: actor.id,
        action,
        fromStatus: task.status,
        toStatus: targetStatus,
        meta: {
          revisionRound: currentRevisionRound,
          ...(targetStatus === TaskStatus.REVISION ? { comment: comment?.trim() ?? "" } : {}),
        },
      },
    });

    return tx.task.findUniqueOrThrow({ where: { id: taskId } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
      throw new AppError("Задача одновременно изменяется другим участником. Обновите страницу и повторите действие.", 409, "CONCURRENT_TRANSITION");
    }
    throw error;
  }
}

export async function addComment(actor: Actor, taskId: string, text: string) {
  return prisma.$transaction(async (tx) => {
    const task = assertFound(await tx.task.findUnique({ where: { id: taskId } }), "Задача не найдена.");
    assertCanViewTask(actor, task);
    const comment = await tx.comment.create({ data: { taskId, userId: actor.id, text } });
    await tx.activityLog.create({
      data: { taskId, userId: actor.id, action: "COMMENT_ADDED", meta: { commentId: comment.id } },
    });
    return comment;
  });
}

export async function addAttachment(actor: Actor, taskId: string, input: {
  url?: string;
  storagePath?: string;
  type: AttachmentType;
  fileName?: string;
  mimeType?: string;
  sizeBytes?: number;
}) {
  return prisma.$transaction(async (tx) => {
    const task = assertFound(await tx.task.findUnique({ where: { id: taskId } }), "Задача не найдена.");
    if (input.type === AttachmentType.REFERENCE) {
      if (actor.role !== Role.BUYER || task.buyerId !== actor.id || task.status !== TaskStatus.NEW) {
        throw new AppError("Референсы может добавлять только автор задачи, пока она новая.", 403, "FORBIDDEN");
      }
    } else if (input.type === AttachmentType.RESULT) {
      if (actor.role !== Role.CREATIVE || task.assigneeId !== actor.id || task.status !== TaskStatus.IN_PROGRESS) {
        throw new AppError("Результат может добавлять только назначенный креативщик во время работы над задачей.", 403, "FORBIDDEN");
      }
    }

    const attachment = await tx.attachment.create({
      data: {
        ...input,
        url: input.url ?? "",
        taskId,
        userId: actor.id,
        revisionRound: getCurrentRevisionRound(task.revisionCount),
      },
    });
    if (input.type === AttachmentType.REFERENCE && input.url && !task.references.includes(input.url)) {
      await tx.task.update({
        where: { id: taskId },
        data: { references: { push: input.url } },
      });
    }
    await tx.activityLog.create({
      data: {
        taskId,
        userId: actor.id,
        action: "ATTACHMENT_ADDED",
        meta: { attachmentId: attachment.id, type: attachment.type, fileName: attachment.fileName, revisionRound: attachment.revisionRound },
      },
    });
    return attachment;
  });
}

export async function addAiUsage(actor: Actor, taskId: string, input: {
  service: AiService;
  credits: number;
  revisionRound?: number;
  note?: string;
}) {
  assertRole(actor, [Role.CREATIVE], "AI-расходы может указывать только креативщик.");
  return prisma.$transaction(async (tx) => {
    const task = assertFound(await tx.task.findUnique({ where: { id: taskId } }), "Задача не найдена.");
    if (task.assigneeId !== actor.id || task.status !== TaskStatus.IN_PROGRESS) {
      throw new AppError("Добавлять AI-расходы можно только по своей задаче в работе.", 403, "FORBIDDEN");
    }
    const currentRound = getCurrentRevisionRound(task.revisionCount);
    if (input.revisionRound !== undefined && input.revisionRound !== currentRound) {
      throw new AppError("Расходы необходимо привязать к текущему раунду правок.", 403, "INVALID_REVISION_ROUND");
    }
    const usage = await tx.aiUsage.create({
      data: {
        taskId,
        userId: actor.id,
        service: input.service,
        credits: new Prisma.Decimal(input.credits),
        revisionRound: currentRound,
        note: input.note,
      },
    });
    await tx.activityLog.create({
      data: {
        taskId,
        userId: actor.id,
        action: "AI_USAGE_ADDED",
        meta: { aiUsageId: usage.id, service: usage.service, credits: usage.credits.toString(), revisionRound: usage.revisionRound },
      },
    });
    return usage;
  });
}

export async function assignTask(actor: Actor, taskId: string, assigneeId: string) {
  assertRole(actor, [Role.MANAGER], "Переназначать исполнителей может только руководитель.");
  return prisma.$transaction(async (tx) => {
    const task = assertFound(await tx.task.findUnique({ where: { id: taskId } }), "Задача не найдена.");
    if (task.status === TaskStatus.NEW || task.status === TaskStatus.DONE) {
      throw new AppError("Переназначать можно только активные задачи в работе, на проверке или на правках.", 422, "TASK_NOT_ASSIGNABLE");
    }
    const assignee = assertFound(
      await tx.user.findUnique({ where: { id: assigneeId }, select: { id: true, name: true, role: true } }),
      "Исполнитель не найден.",
    );
    if (assignee.role !== Role.CREATIVE) throw new AppError("Назначить можно только пользователя с ролью креативщика.", 422, "INVALID_ASSIGNEE");
    const oldAssigneeId = task.assigneeId;
    const changed = await tx.task.updateMany({
      where: { id: taskId, status: task.status, assigneeId: oldAssigneeId },
      data: { assigneeId },
    });
    if (changed.count !== 1) throw new AppError("Задача уже изменилась. Обновите страницу.", 409, "CONCURRENT_UPDATE");
    await tx.activityLog.create({
      data: {
        taskId,
        userId: actor.id,
        action: "ASSIGNEE_REASSIGNED",
        meta: { fromAssigneeId: oldAssigneeId, toAssigneeId: assignee.id, toAssigneeName: assignee.name },
      },
    });
    return tx.task.findUniqueOrThrow({ where: { id: taskId } });
  });
}

export async function listActivity(actor: Actor, filters: { action?: string; from?: string; to?: string; q?: string; page: number; limit: number }) {
  const accessScope: Prisma.ActivityLogWhereInput = actor.role === Role.MANAGER
    ? {}
    : actor.role === Role.BUYER
      ? { task: { is: { buyerId: actor.id } } }
      : { OR: [{ task: { is: { status: TaskStatus.NEW } } }, { task: { is: { assigneeId: actor.id } } }] };
  const createdAt: Prisma.DateTimeFilter = {};
  if (filters.from) createdAt.gte = new Date(`${filters.from}T00:00:00.000Z`);
  if (filters.to) createdAt.lte = new Date(`${filters.to}T23:59:59.999Z`);
  const clauses: Prisma.ActivityLogWhereInput[] = [accessScope];
  if (filters.action) clauses.push({ action: filters.action });
  if (filters.from || filters.to) clauses.push({ createdAt });
  if (filters.q) clauses.push({ OR: [
    { action: { contains: filters.q, mode: "insensitive" } },
    { task: { is: { offer: { contains: filters.q, mode: "insensitive" } } } },
    { task: { is: { geo: { contains: filters.q, mode: "insensitive" } } } },
    { user: { is: { name: { contains: filters.q, mode: "insensitive" } } } },
  ] });
  const where: Prisma.ActivityLogWhereInput = { AND: clauses };
  const [items, total] = await prisma.$transaction([
    prisma.activityLog.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, avatar: true, role: true } },
        task: { select: { id: true, offer: true, geo: true, status: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
    }),
    prisma.activityLog.count({ where }),
  ]);
  return { items, page: filters.page, limit: filters.limit, total, pages: Math.ceil(total / filters.limit) };
}

import "dotenv/config";
import bcrypt from "bcryptjs";
import {
  AiService,
  AttachmentType,
  CreativeType,
  Prisma,
  PrismaClient,
  Priority,
  Role,
  TaskStatus,
} from "@prisma/client";
import type { User } from "@prisma/client";

if (process.env.NODE_ENV === "production") {
  throw new Error("The demo seed is disabled in production.");
}

const prisma = new PrismaClient();

const DEMO_PASSWORD = process.env.DEMO_USER_PASSWORD ?? "";
if (!DEMO_PASSWORD) {
  throw new Error("Set DEMO_USER_PASSWORD before running the demo seed.");
}
const now = new Date();

function daysAgo(days: number): Date {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

function daysFromNow(days: number): Date {
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
}

function hoursAfter(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function demoTaskId(sequence: number): string {
  return `00000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`;
}

type DemoUserKey = "buyer1" | "buyer2" | "creative1" | "creative2" | "creative3" | "manager";

type TaskSeed = {
  id: string;
  offer: string;
  geo: string;
  creativeType: CreativeType;
  quantity: number;
  priority: Priority;
  status: TaskStatus;
  buyer: "buyer1" | "buyer2";
  assignee: "creative1" | "creative2" | "creative3" | null;
  createdAt: Date;
  takenAt?: Date;
  submittedAt?: Date;
  completedAt?: Date;
  deadline: Date;
  description: string;
  revisionCount: number;
};

const userDefinitions: Record<DemoUserKey, { name: string; email: string; role: Role; avatar: string }> = {
  buyer1: {
    name: "Анна Смирнова",
    email: "buyer.anna@creativeops.demo",
    role: Role.BUYER,
    avatar: "https://i.pravatar.cc/160?img=47",
  },
  buyer2: {
    name: "Максим Орлов",
    email: "buyer.maxim@creativeops.demo",
    role: Role.BUYER,
    avatar: "https://i.pravatar.cc/160?img=12",
  },
  creative1: {
    name: "Алексей Волков",
    email: "creative.alexey@creativeops.demo",
    role: Role.CREATIVE,
    avatar: "https://i.pravatar.cc/160?img=11",
  },
  creative2: {
    name: "Мария Белова",
    email: "creative.maria@creativeops.demo",
    role: Role.CREATIVE,
    avatar: "https://i.pravatar.cc/160?img=44",
  },
  creative3: {
    name: "Дмитрий Соколов",
    email: "creative.dmitry@creativeops.demo",
    role: Role.CREATIVE,
    avatar: "https://i.pravatar.cc/160?img=13",
  },
  manager: {
    name: "Елена Павлова",
    email: "manager.elena@creativeops.demo",
    role: Role.MANAGER,
    avatar: "https://i.pravatar.cc/160?img=49",
  },
};

const users = {} as Record<DemoUserKey, User>;

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  for (const [key, definition] of Object.entries(userDefinitions) as [DemoUserKey, (typeof userDefinitions)[DemoUserKey]][]) {
    users[key] = await prisma.user.upsert({
      where: { email: definition.email },
      update: {
        name: definition.name,
        role: definition.role,
        avatar: definition.avatar,
        passwordHash,
        isDemo: true,
      },
      create: {
        ...definition,
        passwordHash,
        isDemo: true,
      },
    });
  }

const taskDefinitions: TaskSeed[] = [
  {
    id: demoTaskId(1),
    offer: "Nutra Sleep Complex",
    geo: "BR",
    creativeType: CreativeType.STATIC,
    quantity: 5,
    priority: Priority.URGENT,
    status: TaskStatus.NEW,
    buyer: "buyer1" as const,
    assignee: null,
    createdAt: daysAgo(3.2),
    deadline: daysAgo(0.5),
    description: "Серия статичных креативов для Meta Ads. Нужны 5 вариантов первого экрана, акцент на проблеме сна и понятном CTA. Не использовать медицинские обещания.",
    revisionCount: 0,
  },
  {
    id: demoTaskId(2),
    offer: "Finance Lead Gen",
    geo: "MX",
    creativeType: CreativeType.BANNER,
    quantity: 4,
    priority: Priority.NORMAL,
    status: TaskStatus.NEW,
    buyer: "buyer2" as const,
    assignee: null,
    createdAt: daysAgo(1.1),
    deadline: daysFromNow(2),
    description: "Баннеры для лидогенерации финансового продукта. Нейтральная подача, визуально показать простоту заявки. Подготовить версии 1:1 и 4:5.",
    revisionCount: 0,
  },
  {
    id: demoTaskId(3),
    offer: "Mobile Game Install",
    geo: "IN",
    creativeType: CreativeType.VIDEO,
    quantity: 3,
    priority: Priority.HIGH,
    status: TaskStatus.NEW,
    buyer: "buyer1" as const,
    assignee: null,
    createdAt: daysAgo(0.7),
    deadline: daysFromNow(1.5),
    description: "Короткие вертикальные видео 15–20 секунд для установки мобильной игры. Нужен быстрый hook в первые 2 секунды и финальный CTA.",
    revisionCount: 0,
  },
  {
    id: demoTaskId(4),
    offer: "Casino Welcome Pack",
    geo: "DE",
    creativeType: CreativeType.VIDEO,
    quantity: 3,
    priority: Priority.URGENT,
    status: TaskStatus.IN_PROGRESS,
    buyer: "buyer2" as const,
    assignee: "creative1" as const,
    createdAt: daysAgo(4.1),
    takenAt: daysAgo(3.6),
    deadline: daysAgo(0.8),
    description: "Три UGC-style ролика для welcome-кампании. Проверить требования GEO и ограничения рекламной площадки. Не обещать гарантированный выигрыш.",
    revisionCount: 0,
  },
  {
    id: demoTaskId(5),
    offer: "Skin Care Serum",
    geo: "PL",
    creativeType: CreativeType.UGC,
    quantity: 2,
    priority: Priority.HIGH,
    status: TaskStatus.IN_PROGRESS,
    buyer: "buyer1" as const,
    assignee: "creative2" as const,
    createdAt: daysAgo(2.2),
    takenAt: daysAgo(1.8),
    deadline: daysFromNow(1),
    description: "Два UGC-сценария с демонстрацией текстуры продукта и lifestyle-контекстом. Нужны субтитры на польском языке.",
    revisionCount: 0,
  },
  {
    id: demoTaskId(6),
    offer: "Crypto App Awareness",
    geo: "BR",
    creativeType: CreativeType.PREVIEW,
    quantity: 6,
    priority: Priority.NORMAL,
    status: TaskStatus.IN_PROGRESS,
    buyer: "buyer2" as const,
    assignee: "creative3" as const,
    createdAt: daysAgo(1.6),
    takenAt: daysAgo(1.3),
    deadline: daysFromNow(3),
    description: "Пакет превью для теста гипотез. 3 визуальных направления по 2 варианта. Избегать обещаний доходности и гарантированной прибыли.",
    revisionCount: 0,
  },
  {
    id: demoTaskId(7),
    offer: "Nutra Joint Support",
    geo: "MX",
    creativeType: CreativeType.STATIC,
    quantity: 4,
    priority: Priority.HIGH,
    status: TaskStatus.REVIEW,
    buyer: "buyer1" as const,
    assignee: "creative1" as const,
    createdAt: daysAgo(3.4),
    takenAt: daysAgo(3.0),
    submittedAt: daysAgo(0.45),
    deadline: daysFromNow(0.5),
    description: "Четыре статичных варианта для тестирования разных болей аудитории. Все тексты на испанском, формат 1:1.",
    revisionCount: 0,
  },
  {
    id: demoTaskId(8),
    offer: "E-commerce App Install",
    geo: "PL",
    creativeType: CreativeType.VIDEO,
    quantity: 2,
    priority: Priority.NORMAL,
    status: TaskStatus.REVIEW,
    buyer: "buyer2" as const,
    assignee: "creative2" as const,
    createdAt: daysAgo(1.8),
    takenAt: daysAgo(1.45),
    submittedAt: daysAgo(0.12),
    deadline: daysFromNow(1.2),
    description: "Два коротких вертикальных ролика с демонстрацией приложения. Нужны версии с озвучкой и без неё.",
    revisionCount: 0,
  },
  {
    id: demoTaskId(9),
    offer: "Casino Retargeting",
    geo: "DE",
    creativeType: CreativeType.BANNER,
    quantity: 5,
    priority: Priority.URGENT,
    status: TaskStatus.REVISION,
    buyer: "buyer1" as const,
    assignee: "creative2" as const,
    createdAt: daysAgo(5.2),
    takenAt: daysAgo(4.8),
    submittedAt: daysAgo(2.6),
    deadline: daysAgo(0.4),
    description: "Пять баннеров для ретаргетинга. Нужна более чёткая визуальная иерархия и проверка соответствия локальным требованиям.",
    revisionCount: 1,
  },
  {
    id: demoTaskId(10),
    offer: "Hair Growth UGC",
    geo: "BR",
    creativeType: CreativeType.UGC,
    quantity: 3,
    priority: Priority.HIGH,
    status: TaskStatus.REVISION,
    buyer: "buyer2" as const,
    assignee: "creative3" as const,
    createdAt: daysAgo(4.3),
    takenAt: daysAgo(4.0),
    submittedAt: daysAgo(1.55),
    deadline: daysFromNow(0.8),
    description: "Три UGC-ролика с разными hooks. Убрать неподтверждённые заявления о гарантированном результате, усилить естественность подачи.",
    revisionCount: 1,
  },
  {
    id: demoTaskId(11),
    offer: "Sleep Supplement Scale",
    geo: "PL",
    creativeType: CreativeType.VIDEO,
    quantity: 4,
    priority: Priority.NORMAL,
    status: TaskStatus.DONE,
    buyer: "buyer1" as const,
    assignee: "creative1" as const,
    createdAt: daysAgo(12.2),
    takenAt: daysAgo(11.7),
    submittedAt: daysAgo(9.9),
    completedAt: daysAgo(9.4),
    deadline: daysAgo(10.5),
    description: "Масштабирование видео-победителя на четыре варианта. Один раунд правок по субтитрам и финальному CTA.",
    revisionCount: 1,
  },
  {
    id: demoTaskId(12),
    offer: "Personal Finance App",
    geo: "MX",
    creativeType: CreativeType.STATIC,
    quantity: 6,
    priority: Priority.NORMAL,
    status: TaskStatus.DONE,
    buyer: "buyer2" as const,
    assignee: "creative2" as const,
    createdAt: daysAgo(10.4),
    takenAt: daysAgo(10.0),
    submittedAt: daysAgo(8.3),
    completedAt: daysAgo(8.0),
    deadline: daysAgo(8.8),
    description: "Шесть статичных креативов для приложения управления личными финансами. Финальные файлы проверены и приняты.",
    revisionCount: 0,
  },
  {
    id: demoTaskId(13),
    offer: "Casino Live Stream",
    geo: "IN",
    creativeType: CreativeType.VIDEO,
    quantity: 3,
    priority: Priority.HIGH,
    status: TaskStatus.DONE,
    buyer: "buyer1" as const,
    assignee: "creative3" as const,
    createdAt: daysAgo(8.1),
    takenAt: daysAgo(7.7),
    submittedAt: daysAgo(5.9),
    completedAt: daysAgo(5.4),
    deadline: daysAgo(6.0),
    description: "Три ролика с адаптацией под mobile-first. Два цикла корректировок по монтажу и локализации.",
    revisionCount: 2,
  },
  {
    id: demoTaskId(14),
    offer: "Beauty Routine UGC",
    geo: "BR",
    creativeType: CreativeType.UGC,
    quantity: 2,
    priority: Priority.LOW,
    status: TaskStatus.DONE,
    buyer: "buyer2" as const,
    assignee: "creative1" as const,
    createdAt: daysAgo(7.3),
    takenAt: daysAgo(6.9),
    submittedAt: daysAgo(5.8),
    completedAt: daysAgo(5.2),
    deadline: daysAgo(5.7),
    description: "Два UGC-видео для beauty-оффера. Органическая подача, спокойный монтаж, финальные субтитры PT-BR.",
    revisionCount: 0,
  },
  {
    id: demoTaskId(15),
    offer: "Trading Education Lead",
    geo: "DE",
    creativeType: CreativeType.PREVIEW,
    quantity: 4,
    priority: Priority.NORMAL,
    status: TaskStatus.DONE,
    buyer: "buyer2" as const,
    assignee: "creative3" as const,
    createdAt: daysAgo(5.6),
    takenAt: daysAgo(5.2),
    submittedAt: daysAgo(3.7),
    completedAt: daysAgo(3.2),
    deadline: daysAgo(3.8),
    description: "Четыре превью для образовательного продукта. Акцент на обучении, без обещаний финансового результата.",
    revisionCount: 0,
  },
];

// Seed is deliberately repeatable: only known demo task IDs are replaced.
const legacyDemoTaskIds = Array.from({ length: 15 }, (_, index) =>
  `demo-task-${String(index + 1).padStart(2, "0")}`,
);
await prisma.task.deleteMany({
  where: { id: { in: [...legacyDemoTaskIds, ...taskDefinitions.map((task) => task.id)] } },
});

for (const definition of taskDefinitions) {
  const buyer = users[definition.buyer];
  const assignee = definition.assignee ? users[definition.assignee] : null;

  const task = await prisma.task.create({
    data: {
      id: definition.id,
      offer: definition.offer,
      geo: definition.geo,
      creativeType: definition.creativeType,
      quantity: definition.quantity,
      description: definition.description,
      references: [
        "https://www.tiktok.com/",
        "https://www.meta.com/business/",
      ],
      priority: definition.priority,
      deadline: definition.deadline,
      status: definition.status,
      buyerId: buyer.id,
      assigneeId: assignee?.id ?? null,
      createdAt: definition.createdAt,
      takenAt: definition.takenAt ?? null,
      submittedAt: definition.submittedAt ?? null,
      completedAt: definition.completedAt ?? null,
      revisionCount: definition.revisionCount,
    },
  });

  const activity: Prisma.ActivityLogCreateManyInput[] = [
    {
      taskId: task.id,
      userId: buyer.id,
      action: "TASK_CREATED",
      meta: { offer: task.offer, geo: task.geo },
      createdAt: definition.createdAt,
    },
  ];

  if (assignee && definition.takenAt) {
    activity.push({
      taskId: task.id,
      userId: assignee.id,
      action: "TASK_TAKEN",
      fromStatus: TaskStatus.NEW,
      toStatus: TaskStatus.IN_PROGRESS,
      meta: { assigneeId: assignee.id },
      createdAt: definition.takenAt,
    });
  }

  // Replay the workflow chronologically. revisionRound starts at 0 for the
  // first submission; revisionCount is the number of buyer returns.
  if (assignee && definition.takenAt && definition.submittedAt) {
    const span = Math.max(60 * 60 * 1000, definition.submittedAt.getTime() - definition.takenAt.getTime());
    const isWaitingForRevision = definition.status === TaskStatus.REVISION;
    const returnCount = definition.revisionCount;

    for (let round = 0; round < returnCount; round += 1) {
      const submissionAt = new Date(
        definition.takenAt.getTime() + span * ((round + 1) / (returnCount + (isWaitingForRevision ? 0 : 1))),
      );
      const isLastRevisionReturn = isWaitingForRevision && round === returnCount - 1;
      const returnedAt = isLastRevisionReturn
        ? hoursAfter(definition.submittedAt, 0.5)
        : hoursAfter(submissionAt, 0.5);

      activity.push({
        taskId: task.id,
        userId: assignee.id,
        action: "TASK_SUBMITTED",
        fromStatus: TaskStatus.IN_PROGRESS,
        toStatus: TaskStatus.REVIEW,
        meta: { revisionRound: round },
        createdAt: isLastRevisionReturn ? definition.submittedAt : submissionAt,
      });
      activity.push({
        taskId: task.id,
        userId: buyer.id,
        action: "TASK_RETURNED_FOR_REVISION",
        fromStatus: TaskStatus.REVIEW,
        toStatus: TaskStatus.REVISION,
        meta: { revisionRound: round, comment: "Нужно уточнить монтаж, локализацию и соответствие ТЗ." },
        createdAt: returnedAt,
      });

      if (!isLastRevisionReturn) {
        activity.push({
          taskId: task.id,
          userId: assignee.id,
          action: "TASK_REVISION_STARTED",
          fromStatus: TaskStatus.REVISION,
          toStatus: TaskStatus.IN_PROGRESS,
          meta: { revisionRound: round + 1 },
          createdAt: hoursAfter(returnedAt, 0.5),
        });
      }
    }

    if (!isWaitingForRevision) {
      activity.push({
        taskId: task.id,
        userId: assignee.id,
        action: "TASK_SUBMITTED",
        fromStatus: TaskStatus.IN_PROGRESS,
        toStatus: TaskStatus.REVIEW,
        meta: { revisionRound: definition.revisionCount },
        createdAt: definition.submittedAt,
      });
    }
  }

  if (definition.status === TaskStatus.DONE && assignee && definition.completedAt) {
    activity.push({
      taskId: task.id,
      userId: buyer.id,
      action: "TASK_ACCEPTED",
      fromStatus: TaskStatus.REVIEW,
      toStatus: TaskStatus.DONE,
      meta: { accepted: true },
      createdAt: definition.completedAt,
    });
  }

  const referenceAttachments = [
    {
      taskId: task.id,
      userId: buyer.id,
      url: `https://placehold.co/1200x675/png?text=${encodeURIComponent(`${task.offer} reference`)}`,
      type: AttachmentType.REFERENCE,
      revisionRound: 0,
      fileName: "reference-board.png",
      mimeType: "image/png",
      sizeBytes: 284000,
      createdAt: definition.createdAt,
    },
  ];

  const resultRoundCount = definition.status === TaskStatus.REVISION
    ? definition.revisionCount
    : definition.revisionCount + 1;
  const resultAttachments = definition.submittedAt && definition.takenAt && assignee
    ? Array.from({ length: resultRoundCount }, (_, round) => {
        const completedRound = round === resultRoundCount - 1;
        const createdAt = completedRound
          ? definition.submittedAt!
          : new Date(definition.takenAt!.getTime() + (definition.submittedAt!.getTime() - definition.takenAt!.getTime()) * ((round + 1) / (resultRoundCount + 1)));
        return {
          taskId: task.id,
          userId: assignee.id,
          url: `https://placehold.co/1200x675/png?text=${encodeURIComponent(`${task.offer} result round ${round + 1}`)}`,
          type: AttachmentType.RESULT,
          revisionRound: round,
          fileName: `creative-result-round-${round + 1}.png`,
          mimeType: "image/png",
          sizeBytes: 512000,
          createdAt,
        };
      })
    : [];

  activity.push({
    taskId: task.id,
    userId: buyer.id,
    action: "ATTACHMENT_ADDED",
    meta: { type: "REFERENCE", fileName: "reference-board.png", revisionRound: 0 },
    createdAt: definition.createdAt,
  });
  if (resultAttachments.length > 0 && assignee) {
    for (const attachment of resultAttachments) {
      activity.push({
        taskId: task.id,
        userId: assignee.id,
        action: "ATTACHMENT_ADDED",
        meta: {
          type: "RESULT",
          fileName: attachment.fileName,
          revisionRound: attachment.revisionRound,
        },
        createdAt: attachment.createdAt,
      });
    }
  }

  await prisma.attachment.createMany({ data: [...referenceAttachments, ...resultAttachments] });
  await prisma.activityLog.createMany({ data: activity });

  if (definition.status === TaskStatus.REVISION) {
    const commentCreatedAt = hoursAfter(definition.submittedAt ?? definition.createdAt, 2);
    await prisma.comment.create({
      data: {
        taskId: task.id,
        userId: buyer.id,
        text: "Нужно поправить первый экран: усилить читаемость оффера, проверить локализацию и заменить спорный claim. После правок приложите новую версию отдельным файлом.",
        createdAt: commentCreatedAt,
      },
    });
    await prisma.activityLog.create({
      data: {
        taskId: task.id,
        userId: buyer.id,
        action: "COMMENT_ADDED",
        meta: { kind: "revision_feedback" },
        createdAt: commentCreatedAt,
      },
    });
  }

  if (definition.status === TaskStatus.REVIEW) {
    await prisma.comment.create({
      data: {
        taskId: task.id,
        userId: assignee?.id ?? buyer.id,
        text: "Материалы готовы к проверке. Исходники и экспорт приложены.",
        createdAt: definition.submittedAt ?? definition.createdAt,
      },
    });
    await prisma.activityLog.create({
      data: {
        taskId: task.id,
        userId: assignee?.id ?? buyer.id,
        action: "COMMENT_ADDED",
        meta: { kind: "submission_note" },
        createdAt: definition.submittedAt ?? definition.createdAt,
      },
    });
  }

  const aiEntries: Array<{
    userId: string;
    service: AiService;
    credits: Prisma.Decimal;
    revisionRound: number;
    note: string;
    createdAt: Date;
  }> = [];

  if (definition.status === TaskStatus.DONE && assignee) {
    const completedUsage: Array<[AiService, string, number, string]> = [
      [AiService.CHATGPT, "1.8000", 0, "Сценарии и варианты рекламных hooks"],
      [AiService.MIDJOURNEY, "42.0000", 0, "Генерация визуальных концепций"],
      [AiService.KLING, "18.0000", definition.revisionCount, "Анимация и тестовые видеосцены"],
    ];
    for (const [service, credits, revisionRound, note] of completedUsage) {
      aiEntries.push({
        userId: assignee.id,
        service,
        credits: new Prisma.Decimal(credits),
        revisionRound,
        note,
        createdAt: definition.submittedAt ?? definition.createdAt,
      });
    }
    if (definition.revisionCount > 0) {
      aiEntries.push({
        userId: assignee.id,
        service: AiService.RUNWAY,
        credits: new Prisma.Decimal("12.5000"),
        revisionRound: definition.revisionCount,
        note: "Дополнительная генерация после правок",
        createdAt: definition.completedAt ?? definition.createdAt,
      });
    }
  } else if (definition.status === TaskStatus.IN_PROGRESS && assignee) {
    aiEntries.push({
      userId: assignee.id,
      service: AiService.CHATGPT,
      credits: new Prisma.Decimal("0.9000"),
      revisionRound: 0,
      note: "Черновые идеи и структура сценария",
      createdAt: definition.takenAt ?? definition.createdAt,
    });
  }

  if (aiEntries.length > 0) {
    await prisma.aiUsage.createMany({ data: aiEntries.map((entry) => ({ ...entry, taskId: task.id })) });
    await prisma.activityLog.createMany({
      data: aiEntries.map((entry) => ({
        taskId: task.id,
        userId: entry.userId,
        action: "AI_USAGE_ADDED",
        meta: {
          service: entry.service,
          credits: entry.credits.toString(),
          revisionRound: entry.revisionRound,
        },
        createdAt: entry.createdAt,
      })),
    });
  }
}

console.info("\nCreative Ops demo seed completed.");
console.info(`Users: ${Object.keys(users).length}; tasks: ${taskDefinitions.length}.`);
console.info("Demo users:");
for (const [key, definition] of Object.entries(userDefinitions)) {
  console.info(`- ${key.padEnd(10)} ${definition.email} (${definition.role})`);
}
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

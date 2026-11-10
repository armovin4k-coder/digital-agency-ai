import "dotenv/config";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Priority, Role, TaskStatus } from "@prisma/client";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import {
  addAttachment,
  assignTask,
  createTask,
  getTaskById,
  transitionTask,
} from "@/server/services/task.service";

const databaseUrl = process.env.DATABASE_URL ?? "";
const integrationEnabled = process.env.RUN_INTEGRATION_TESTS === "true";
if (integrationEnabled && !/^postgresql:\/\/[^@/]+@127\.0\.0\.1:\d+\/creativeops_test(?:\?|$)/.test(databaseUrl)) {
  throw new Error("Integration tests require a local creativeops_test database.");
}

const suite = integrationEnabled ? describe : describe.skip;

suite("PostgreSQL task workflow", () => {
  const suffix = randomUUID();
  const users = {
    buyer: { id: randomUUID(), email: `buyer-${suffix}@integration.invalid`, name: "Test buyer", role: Role.BUYER },
    otherBuyer: { id: randomUUID(), email: `other-buyer-${suffix}@integration.invalid`, name: "Other buyer", role: Role.BUYER },
    creative: { id: randomUUID(), email: `creative-${suffix}@integration.invalid`, name: "Test creative", role: Role.CREATIVE },
    otherCreative: { id: randomUUID(), email: `other-creative-${suffix}@integration.invalid`, name: "Other creative", role: Role.CREATIVE },
    manager: { id: randomUUID(), email: `manager-${suffix}@integration.invalid`, name: "Test manager", role: Role.MANAGER },
  };
  const actors = {
    buyer: { id: users.buyer.id, role: Role.BUYER },
    otherBuyer: { id: users.otherBuyer.id, role: Role.BUYER },
    creative: { id: users.creative.id, role: Role.CREATIVE },
    otherCreative: { id: users.otherCreative.id, role: Role.CREATIVE },
    manager: { id: users.manager.id, role: Role.MANAGER },
  };
  const createdTaskIds: string[] = [];

  beforeAll(async () => {
    await prisma.user.createMany({
      data: Object.values(users).map((user) => ({
        ...user,
        passwordHash: "unused-in-integration-tests",
      })),
    });
  });

  afterAll(async () => {
    await prisma.task.deleteMany({ where: { id: { in: createdTaskIds } } });
    await prisma.user.deleteMany({ where: { id: { in: Object.values(users).map((user) => user.id) } } });
    await prisma.$disconnect();
  });

  async function createFixtureTask(offer: string) {
    const task = await createTask(actors.buyer, {
      offer,
      geo: "US",
      creativeType: "STATIC",
      quantity: 1,
      description: "Integration workflow test brief.",
      references: [],
      priority: Priority.NORMAL,
      deadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
    createdTaskIds.push(task.id);
    return task;
  }

  it("enforces roles, runs required transitions and writes activity atomically", async () => {
    const created = await createFixtureTask("Complete workflow");
    expect(created.status).toBe(TaskStatus.NEW);

    await expect(getTaskById(actors.otherBuyer, created.id)).rejects.toMatchObject({ status: 403 });
    await expect(createTask(actors.manager, {
      offer: "Forbidden task",
      geo: "US",
      creativeType: "STATIC",
      quantity: 1,
      description: "This action is not allowed.",
      references: [],
      priority: Priority.NORMAL,
      deadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
    })).rejects.toMatchObject({ status: 403 });

    const taken = await transitionTask(actors.creative, created.id, TaskStatus.IN_PROGRESS);
    expect(taken.assigneeId).toBe(users.creative.id);
    expect(taken.takenAt).toBeInstanceOf(Date);
    await expect(transitionTask(actors.otherCreative, created.id, TaskStatus.IN_PROGRESS))
      .rejects.toMatchObject({ status: 409, code: "TASK_ALREADY_TAKEN" });
    await expect(transitionTask(actors.creative, created.id, TaskStatus.REVIEW))
      .rejects.toMatchObject({ status: 422, code: "RESULT_REQUIRED" });

    await addAttachment(actors.creative, created.id, {
      url: "https://example.com/result.png",
      type: "RESULT",
      fileName: "result.png",
    });
    const submitted = await transitionTask(actors.creative, created.id, TaskStatus.REVIEW);
    expect(submitted.submittedAt).toBeInstanceOf(Date);
    await expect(transitionTask(actors.otherBuyer, created.id, TaskStatus.DONE))
      .rejects.toMatchObject({ status: 403 });
    await expect(transitionTask(actors.buyer, created.id, TaskStatus.REVISION))
      .rejects.toMatchObject({ status: 422, code: "COMMENT_REQUIRED" });

    const returned = await transitionTask(actors.buyer, created.id, TaskStatus.REVISION, "Revise the opening.");
    expect(returned.revisionCount).toBe(1);
    expect(returned.status).toBe(TaskStatus.REVISION);
    await expect(transitionTask(actors.manager, created.id, TaskStatus.DONE))
      .rejects.toBeInstanceOf(AppError);

    await transitionTask(actors.creative, created.id, TaskStatus.IN_PROGRESS);
    await addAttachment(actors.creative, created.id, {
      url: "https://example.com/result-v2.png",
      type: "RESULT",
      fileName: "result-v2.png",
    });
    await transitionTask(actors.creative, created.id, TaskStatus.REVIEW);
    const completed = await transitionTask(actors.buyer, created.id, TaskStatus.DONE);
    expect(completed.completedAt).toBeInstanceOf(Date);

    const detail = await getTaskById(actors.manager, created.id);
    expect(detail.activityLogs.map((entry) => entry.action)).toContain("TASK_RETURNED_FOR_REVISION");
    expect(detail.comments.map((entry) => entry.text)).toContain("Revise the opening.");
    expect(detail.attachments.map((entry) => entry.revisionRound)).toEqual([0, 1]);
  });

  it("allows managers to reassign active work without changing its status", async () => {
    const created = await createFixtureTask("Manager reassignment");
    await transitionTask(actors.creative, created.id, TaskStatus.IN_PROGRESS);

    const reassigned = await assignTask(actors.manager, created.id, users.otherCreative.id);
    expect(reassigned.status).toBe(TaskStatus.IN_PROGRESS);
    expect(reassigned.assigneeId).toBe(users.otherCreative.id);
  });
});

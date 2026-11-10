import { describe, expect, it } from "vitest";
import { Role, TaskStatus } from "@prisma/client";
import { canViewTask } from "../src/lib/permissions";

describe("task visibility policy", () => {
  const task = { buyerId: "buyer-1", assigneeId: "creative-1", status: TaskStatus.IN_PROGRESS };

  it("shows a buyer only tasks they created", () => {
    expect(canViewTask({ id: "buyer-1", role: Role.BUYER }, task)).toBe(true);
    expect(canViewTask({ id: "buyer-2", role: Role.BUYER }, task)).toBe(false);
  });

  it("shows creatives all new tasks and only their own assigned tasks", () => {
    expect(canViewTask({ id: "creative-2", role: Role.CREATIVE }, { ...task, status: TaskStatus.NEW, assigneeId: null })).toBe(true);
    expect(canViewTask({ id: "creative-1", role: Role.CREATIVE }, task)).toBe(true);
    expect(canViewTask({ id: "creative-2", role: Role.CREATIVE }, task)).toBe(false);
  });

  it("shows managers every task", () => {
    expect(canViewTask({ id: "manager-1", role: Role.MANAGER }, task)).toBe(true);
  });
});

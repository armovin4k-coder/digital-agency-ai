import { describe, expect, it } from "vitest";
import { Role, TaskStatus } from "@prisma/client";
import { canViewTask } from "../src/lib/permissions";
import { isDemoLoginEnabled } from "../src/lib/demo-mode";

describe("task visibility policy", () => {
  const task = { buyerId: "buyer-1", assigneeId: "creative-1", status: TaskStatus.IN_PROGRESS };

  it("shows a buyer only tasks they created", () => {
    expect(canViewTask({ id: "buyer-1", role: Role.BUYER }, task)).toBe(true);
    expect(canViewTask({ id: "buyer-2", role: Role.BUYER }, task)).toBe(false);
  });

  describe("production demo login gate", () => {
    it("keeps demo login disabled in production by default", () => {
      expect(isDemoLoginEnabled("production", undefined, undefined)).toBe(false);
      expect(isDemoLoginEnabled("production", "true", undefined)).toBe(false);
      expect(isDemoLoginEnabled("production", undefined, "true")).toBe(false);
    });

    it("allows demo login in production only when explicitly enabled for an isolated database", () => {
      expect(isDemoLoginEnabled("production", "true", "true")).toBe(true);
      expect(isDemoLoginEnabled("production", "false", "true")).toBe(false);
      expect(isDemoLoginEnabled("production", "true", "false")).toBe(false);
    });

    it("preserves local demo login behavior", () => {
      expect(isDemoLoginEnabled("development", undefined, undefined)).toBe(true);
    });
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

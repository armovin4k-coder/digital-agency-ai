import { describe, expect, it } from "vitest";
import { Role, TaskStatus } from "@prisma/client";
import { validateTransition, allowedNextStatuses } from "../src/lib/status-machine";
import { AppError } from "../src/lib/errors";

function expectAppError(run: () => void, code: string, status = 403) {
  try {
    run();
    throw new Error("Expected AppError to be thrown");
  } catch (error) {
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe(code);
    expect((error as AppError).status).toBe(status);
  }
}

describe("Creative Ops status machine", () => {
  it("allows a creative to take a new task", () => {
    expect(() => validateTransition({
      role: Role.CREATIVE,
      from: TaskStatus.NEW,
      to: TaskStatus.IN_PROGRESS,
      isBuyer: false,
      isAssignee: false,
      hasResult: false,
    })).not.toThrow();
  });

  it("allows only the assigned creative to resume a revision", () => {
    expect(() => validateTransition({
      role: Role.CREATIVE,
      from: TaskStatus.REVISION,
      to: TaskStatus.IN_PROGRESS,
      isBuyer: false,
      isAssignee: true,
      hasResult: false,
    })).not.toThrow();

    expectAppError(() => validateTransition({
      role: Role.CREATIVE,
      from: TaskStatus.REVISION,
      to: TaskStatus.IN_PROGRESS,
      isBuyer: false,
      isAssignee: false,
      hasResult: false,
    }), "INVALID_TRANSITION");
  });

  it("rejects submission without a result attachment", () => {
    expectAppError(() => validateTransition({
      role: Role.CREATIVE,
      from: TaskStatus.IN_PROGRESS,
      to: TaskStatus.REVIEW,
      isBuyer: false,
      isAssignee: true,
      hasResult: false,
    }), "RESULT_REQUIRED", 422);
  });

  it("allows submission when a result exists", () => {
    expect(() => validateTransition({
      role: Role.CREATIVE,
      from: TaskStatus.IN_PROGRESS,
      to: TaskStatus.REVIEW,
      isBuyer: false,
      isAssignee: true,
      hasResult: true,
    })).not.toThrow();
  });

  it("requires a comment when a buyer returns a task", () => {
    expectAppError(() => validateTransition({
      role: Role.BUYER,
      from: TaskStatus.REVIEW,
      to: TaskStatus.REVISION,
      isBuyer: true,
      isAssignee: false,
      hasResult: true,
      comment: "   ",
    }), "COMMENT_REQUIRED", 422);
  });

  it("reports stale transitions as conflicts", () => {
    expectAppError(() => validateTransition({
      role: Role.BUYER,
      from: TaskStatus.DONE,
      to: TaskStatus.REVISION,
      isBuyer: true,
      isAssignee: false,
      hasResult: true,
      comment: "Нужно исправить",
    }), "INVALID_STATUS", 409);
  });

  it("does not allow a manager to move statuses", () => {
    expectAppError(() => validateTransition({
      role: Role.MANAGER,
      from: TaskStatus.REVIEW,
      to: TaskStatus.DONE,
      isBuyer: false,
      isAssignee: false,
      hasResult: true,
    }), "INVALID_TRANSITION");
  });

  it("exposes only role-appropriate drag-and-drop targets", () => {
    expect(allowedNextStatuses(Role.CREATIVE, TaskStatus.NEW, false, false)).toEqual([TaskStatus.IN_PROGRESS]);
    expect(allowedNextStatuses(Role.BUYER, TaskStatus.REVIEW, true, false)).toEqual([TaskStatus.DONE, TaskStatus.REVISION]);
    expect(allowedNextStatuses(Role.MANAGER, TaskStatus.REVIEW, false, false)).toEqual([]);
  });
});

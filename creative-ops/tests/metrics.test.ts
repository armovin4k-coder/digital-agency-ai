import { describe, expect, it } from "vitest";
import { average, calculateTaskDurations, getCurrentRevisionRound, sumCredits } from "../src/lib/metrics";

const hour = 60 * 60 * 1000;

describe("task metrics", () => {
  it("calculates production, full-cycle and waiting durations", () => {
    const createdAt = new Date("2026-01-01T08:00:00.000Z");
    const takenAt = new Date("2026-01-01T10:00:00.000Z");
    const submittedAt = new Date("2026-01-01T14:00:00.000Z");
    const completedAt = new Date("2026-01-01T16:00:00.000Z");
    const result = calculateTaskDurations({ createdAt, takenAt, submittedAt, completedAt, revisionCount: 1 });

    expect(result.productionMs).toBe(6 * hour);
    expect(result.fullCycleMs).toBe(8 * hour);
    expect(result.waitingMs).toBe(2 * hour);
  });

  it("does not include unfinished tasks in completed-time averages", () => {
    const unfinished = calculateTaskDurations({
      createdAt: new Date("2026-01-01T08:00:00.000Z"),
      takenAt: new Date("2026-01-01T10:00:00.000Z"),
      submittedAt: null,
      completedAt: null,
      revisionCount: 0,
    });
    expect(unfinished.productionMs).toBeNull();
    expect(unfinished.fullCycleMs).toBeNull();
  });

  it("handles averages and decimal AI credits", () => {
    expect(average([1, 3, null])).toBe(2);
    expect(average([null, undefined])).toBeNull();
    expect(sumCredits(["1.2500", 2.5, "0.25"])).toBe(4);
  });

  it("uses the number of buyer returns as the current revision round", () => {
    expect(getCurrentRevisionRound(0)).toBe(0);
    expect(getCurrentRevisionRound(2)).toBe(2);
  });
});

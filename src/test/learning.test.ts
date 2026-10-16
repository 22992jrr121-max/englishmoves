import { describe, expect, it } from "vitest";
import { DIAGNOSTIC, levelFromScore, nextMastery } from "@/lib/learning";

describe("diagnostic", () => {
  it("has exactly 10 questions", () => {
    expect(DIAGNOSTIC).toHaveLength(10);
  });
  it("maps scores to CEFR levels", () => {
    expect(levelFromScore(0)).toBe("A1");
    expect(levelFromScore(4)).toBe("A2");
    expect(levelFromScore(6)).toBe("B1");
    expect(levelFromScore(8)).toBe("B2");
    expect(levelFromScore(9)).toBe("C1");
    expect(levelFromScore(10)).toBe("C2");
  });
});

describe("mastery", () => {
  it("rises on correct and drops on wrong, clamped", () => {
    expect(nextMastery(50, true)).toBe(70);
    expect(nextMastery(10, false)).toBe(0);
    expect(nextMastery(95, true)).toBe(100);
  });
});

import { examPassed, examScore, examUnlocked, nextLevel, qualifyingUnits } from "@/lib/learning";
describe("level progression", () => {
  const u = (level: string, score: number, status = "done", block = "general") => ({ block, level, status, score });
  it("next level after A2 is B1 and C2 has none", () => {
    expect(nextLevel("A2")).toBe("B1");
    expect(nextLevel("C2")).toBeNull();
  });
  it("only counts done general units of the level with score >= 60", () => {
    expect(qualifyingUnits([u("A2", 60), u("A2", 59), u("A2", 90, "in_progress"), u("A2", 90, "done", "daily"), u("B1", 90)], "A2")).toBe(1);
  });
  it("unlocks the exam with 4 qualifying units", () => {
    expect(examUnlocked([u("A2", 80), u("A2", 70), u("A2", 65)], "A2")).toBe(false);
    expect(examUnlocked([u("A2", 80), u("A2", 70), u("A2", 65), u("A2", 60)], "A2")).toBe(true);
  });
  it("passes the exam at 70%", () => {
    expect(examScore(10, 15)).toBe(67);
    expect(examPassed(examScore(10, 15))).toBe(false);
    expect(examPassed(examScore(11, 15))).toBe(true);
  });
});

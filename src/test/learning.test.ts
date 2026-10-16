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

import { checkCourseAnswer, courseLevel, examPassed, examScore, examUnlocked, nextLevel, qualifyingUnits, unitUnlocked } from "@/lib/learning";
describe("level progression", () => {
  const u = (level: string, n: number, status = "done", block = "general") => ({ block, level, status, topic: `${level}-${String(n).padStart(2, "0")}` });
  const twelve = (level: string) => Array.from({ length: 12 }, (_, i) => u(level, i + 1));
  it("next level after A2 is B1 and C1 is the top", () => {
    expect(nextLevel("A2")).toBe("B1");
    expect(nextLevel("C1")).toBeNull();
    expect(courseLevel("C2")).toBe("C1");
  });
  it("only counts finished course units of the level", () => {
    expect(qualifyingUnits([u("A2", 1), u("A2", 2, "in_progress"), u("A2", 3, "done", "daily"), u("B1", 1), { block: "general", level: "A2", status: "done", topic: "Travel" }], "A2")).toBe(1);
  });
  it("unlocks the exam only with all 12 units of the level", () => {
    expect(examUnlocked(twelve("A2").slice(0, 11), "A2")).toBe(false);
    expect(examUnlocked(twelve("A2"), "A2")).toBe(true);
    expect(examUnlocked(twelve("C1"), "C1")).toBe(false);
  });
  it("opens units one after another within the student's level", () => {
    expect(unitUnlocked("B1-01", "B1", [])).toBe(true);
    expect(unitUnlocked("B1-03", "B1", ["B1-01"])).toBe(false);
    expect(unitUnlocked("B1-03", "B1", ["B1-01", "B1-02"])).toBe(true);
    expect(unitUnlocked("A2-12", "B1", [])).toBe(true);
    expect(unitUnlocked("B2-01", "B1", [])).toBe(false);
  });
  it("checks answers ignoring case/spaces and accepting variants", () => {
    expect(checkCourseAnswer("  Hello ", "hello")).toBe(true);
    expect(checkCourseAnswer("6", "six", ["6"])).toBe(true);
    expect(checkCourseAnswer("seven", "six", ["6"])).toBe(false);
  });
  it("passes the exam at 70%", () => {
    expect(examScore(10, 15)).toBe(67);
    expect(examPassed(examScore(10, 15))).toBe(false);
    expect(examPassed(examScore(11, 15))).toBe(true);
  });
});

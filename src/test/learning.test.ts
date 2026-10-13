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

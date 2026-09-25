import { describe, expect, it } from "vitest";
import { fmtTime, sprTex } from "@/lib/format";
import { grade, parseSpr, sprMatches } from "@/lib/grading";

describe("formatting helpers", () => {
  it("renders grid-in previews as LaTeX", () => {
    expect(sprTex("3/4")).toBe(String.raw`\frac{3}{4}`);
    expect(sprTex("-7/2")).toBe(String.raw`-\frac{7}{2}`);
    expect(sprTex("2.5")).toBe("2.5");
  });
  it("formats durations", () => {
    expect(fmtTime(0)).toBe("0:00");
    expect(fmtTime(65_000)).toBe("1:05");
  });
});

describe("multiple choice", () => {
  const q = { type: "mcq" as const, answer: "C" };
  it("accepts the keyed letter (any case)", () => {
    expect(grade(q, "C")).toBe(true);
    expect(grade(q, "c")).toBe(true);
  });
  it("rejects other letters", () => {
    for (const r of ["A", "B", "D", ""]) expect(grade(q, r)).toBe(false);
  });
});

describe("student-produced response", () => {
  it("accepts equivalent fractions and decimals", () => {
    expect(sprMatches("3/4", "3/4")).toBe(true);
    expect(sprMatches(".75", "3/4")).toBe(true);
    expect(sprMatches("0.75", "3/4")).toBe(true);
    expect(sprMatches("6/8", "3/4")).toBe(true);
    expect(sprMatches("12", "12")).toBe(true);
    expect(sprMatches("12.0", "12")).toBe(true);
    expect(sprMatches("24/2", "12")).toBe(true);
  });

  it("handles negatives", () => {
    expect(sprMatches("-5", "-5")).toBe(true);
    expect(sprMatches("-7/2", "-3.5")).toBe(true);
    expect(sprMatches("-3.5", "-7/2")).toBe(true);
    expect(sprMatches("5", "-5")).toBe(false);
  });

  it("accepts truncated or rounded decimals that fill the answer space", () => {
    expect(sprMatches(".6666", "2/3")).toBe(true);
    expect(sprMatches(".6667", "2/3")).toBe(true);
    expect(sprMatches("0.666", "2/3")).toBe(true);
    expect(sprMatches("0.667", "2/3")).toBe(true);
    expect(sprMatches("-.6666", "-2/3")).toBe(true);
    expect(sprMatches("-0.667", "-2/3")).toBe(true);
  });

  it("rejects decimals that are too short or wrong", () => {
    expect(sprMatches(".66", "2/3")).toBe(false);
    expect(sprMatches(".67", "2/3")).toBe(false);
    expect(sprMatches("0.66", "2/3")).toBe(false);
    expect(sprMatches(".6668", "2/3")).toBe(false);
  });

  it("accepts any of several keyed answers", () => {
    const q = { type: "spr" as const, answer: "2|-3" };
    expect(grade(q, "2")).toBe(true);
    expect(grade(q, "-3")).toBe(true);
    expect(grade(q, "3")).toBe(false);
  });

  it("rejects invalid input", () => {
    for (const bad of ["", "abc", "1/0", "3 1/2", "1..2", "--2", "123456", "1/2/3", "2x"]) {
      const p = parseSpr(bad);
      expect(p.ok, bad).toBe(false);
      expect(sprMatches(bad, "2")).toBe(false);
    }
  });

  it("enforces the character limits", () => {
    expect(parseSpr("12345").ok).toBe(true);
    expect(parseSpr("123456").ok).toBe(false);
    expect(parseSpr("-12345").ok).toBe(true);
    expect(parseSpr("-123456").ok).toBe(false);
  });

  it("explains mixed numbers", () => {
    const p = parseSpr("3 1/2");
    expect(p.ok).toBe(false);
    if (!p.ok) expect(p.error).toMatch(/Mixed numbers/);
  });
});

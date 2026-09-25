import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadContentFiles, QUESTIONS_DIR } from "@/lib/seed";
import { grade } from "@/lib/grading";
import { SKILLS } from "@/lib/taxonomy";

const { questions, errors } = loadContentFiles();
const BACKSLASH = String.fromCharCode(92);
// Tab, form feed, backspace, etc. (newlines are fine)
const CONTROL_CHARS = new RegExp("[\\u0000-\\u0009\\u000B-\\u001F]");

describe("hand-written question bank", () => {
  it("validates with no errors", () => {
    expect(errors).toEqual([]);
  });

  it("meets the size targets (≥120 R&W, ≥60 Math)", () => {
    expect(questions.filter((q) => q.section === "RW").length).toBeGreaterThanOrEqual(120);
    expect(questions.filter((q) => q.section === "MATH").length).toBeGreaterThanOrEqual(60);
  });

  it("covers every skill, and every R&W skill at all three difficulties", () => {
    for (const s of SKILLS) {
      const qs = questions.filter((q) => q.skill === s.id);
      expect(qs.length, s.id).toBeGreaterThan(0);
      if (s.section === "RW") {
        expect(new Set(qs.map((q) => q.difficulty)).size, s.id).toBe(3);
      }
    }
  });

  it("has an explanation for every question and a note for every wrong choice", () => {
    for (const q of questions) {
      expect(q.explanation_md.length, q.id).toBeGreaterThan(20);
      if (q.type === "mcq") {
        for (const L of ["A", "B", "C", "D"]) {
          if (L !== q.answer) expect(q.distractor_notes?.[L], `${q.id} note ${L}`).toBeTruthy();
        }
      }
    }
  });

  it("stores source and license on every question", () => {
    for (const q of questions) {
      expect(q.source, q.id).toBeTruthy();
      expect(q.license, q.id).toBeTruthy();
    }
  });

  it("has SPR keys that the grader accepts", () => {
    for (const q of questions.filter((x) => x.type === "spr")) {
      const first = q.answer.split("|")[0];
      expect(grade({ type: "spr", answer: q.answer }, first), q.id).toBe(true);
    }
  });

  it("uses no unescaped dollar signs in R&W text (they would start math mode)", () => {
    for (const q of questions.filter((x) => x.section === "RW")) {
      const text = [q.passage_md, q.stem_md, ...(q.choices ?? []), q.explanation_md, ...Object.values(q.distractor_notes ?? {})].join("\n");
      for (let i = 0; i < text.length; i++) {
        if (text[i] === "$") expect(text[i - 1], `${q.id}: unescaped $ near "${text.slice(i - 20, i + 10)}"`).toBe(BACKSLASH);
      }
    }
  });

  it("contains no stray control characters from bad escaping (e.g. a form feed from an unescaped \\frac)", () => {
    for (const file of fs.readdirSync(QUESTIONS_DIR)) {
      const raw = fs.readFileSync(path.join(QUESTIONS_DIR, file), "utf8");
      const strings: string[] = [];
      JSON.parse(raw, (_k, v) => {
        if (typeof v === "string") strings.push(v);
        return v;
      });
      for (const s of strings) expect(CONTROL_CHARS.test(s), `${file}: ${JSON.stringify(s.slice(0, 60))}`).toBe(false);
    }
  });

  it("uses math delimiters in balanced pairs", () => {
    for (const q of questions.filter((x) => x.section === "MATH")) {
      for (const text of [q.stem_md, q.explanation_md, ...(q.choices ?? [])]) {
        const unescaped = text.split(BACKSLASH + "$").join("").split("$$").join("");
        expect(((unescaped.match(/\$/g) ?? []).length) % 2, `${q.id}: ${text.slice(0, 60)}`).toBe(0);
      }
    }
  });
});

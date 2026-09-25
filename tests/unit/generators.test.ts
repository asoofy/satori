import { describe, expect, it } from "vitest";
import { GENERATORS, generateQuestion, runGenerator, seedFor } from "@/content/generators";
import { QuestionInput } from "@/lib/question-schema";
import { SKILL_BY_ID } from "@/lib/taxonomy";
import { grade } from "@/lib/grading";

const SEEDS = 200;
const LETTERS = ["A", "B", "C", "D"];

/** What a student could type in the answer box: the key if it fits, otherwise a truncated decimal. */
function studentEntry(key: string, value: number): string {
  const max = value < 0 ? 6 : 5;
  if (key.length <= max) return key;
  let s = value.toFixed(8);
  if (s.startsWith("0.")) s = s.slice(1);
  if (s.startsWith("-0.")) s = "-" + s.slice(2);
  return s.slice(0, max);
}

describe("generator registry", () => {
  it("has at least 20 generators with unique ids and known skills", () => {
    expect(GENERATORS.length).toBeGreaterThanOrEqual(20);
    expect(new Set(GENERATORS.map((g) => g.id)).size).toBe(GENERATORS.length);
    for (const g of GENERATORS) {
      expect(SKILL_BY_ID.get(g.skill)?.section, g.id).toBe("MATH");
    }
  });

  it("covers every Math domain", () => {
    const domains = new Set(GENERATORS.map((g) => SKILL_BY_ID.get(g.skill)!.domain));
    expect([...domains].sort()).toEqual(["advanced-math", "algebra", "geometry-trig", "psda"]);
  });
});

for (const gen of GENERATORS) {
  describe(`generator ${gen.id}`, () => {
    for (const d of gen.difficulties) {
      it(`difficulty ${d}: answer is correct, distractors are distinct and wrong`, () => {
        for (let i = 0; i < SEEDS; i++) {
          const seed = seedFor(gen.id, d, i);
          const out = runGenerator(gen, d, seed);
          const ctx = `${gen.id} d${d} seed ${seed}`;
          if (out.type === "mcq") {
            expect(out.choices, ctx).toHaveLength(4);
            expect(new Set(out.choices!.map((c) => c.trim())).size, `${ctx}: duplicate choices ${JSON.stringify(out.choices)}`).toBe(4);
            expect(out.values, ctx).toHaveLength(4);
            const passing = out.values.map((v) => gen.check(out.params, v));
            // exactly one choice satisfies the problem, and it is the keyed answer
            expect(passing.filter(Boolean).length, `${ctx}: ${JSON.stringify(out.choices)}`).toBe(1);
            expect(LETTERS[passing.indexOf(true)], ctx).toBe(out.answer);
            // every wrong choice has a note explaining the error
            for (const L of LETTERS) {
              if (L !== out.answer) expect(out.distractor_notes?.[L], `${ctx}: note for ${L}`).toBeTruthy();
            }
          } else {
            expect(gen.check(out.params, out.values[0]), `${ctx}: key ${out.answer}`).toBe(true);
            // the answer key must be accepted by the SPR grader and fit the answer box
            const entry = studentEntry(out.answer, out.values[0] as number);
            expect(grade({ type: "spr", answer: out.answer }, entry), `${ctx}: key ${out.answer}, entry ${entry}`).toBe(true);
          }
          expect(out.explanation_md.length, ctx).toBeGreaterThan(20);
          expect(out.stem_md, ctx).not.toMatch(/NaN|undefined|Infinity/);
          expect(out.explanation_md, ctx).not.toMatch(/NaN|undefined|Infinity/);
        }
      });

      it(`difficulty ${d}: deterministic for a given seed and valid against the schema`, () => {
        for (let i = 0; i < 20; i++) {
          const seed = seedFor(gen.id, d, i);
          const a = generateQuestion(gen, d, seed);
          const b = generateQuestion(gen, d, seed);
          expect(a).toEqual(b);
          const parsed = QuestionInput.safeParse(a);
          expect(parsed.success, `${a.id}: ${parsed.success ? "" : JSON.stringify(parsed.error.issues)}`).toBe(true);
        }
      });
    }
  });
}

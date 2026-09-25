import { z } from "zod";
import { SKILL_BY_ID } from "@/lib/taxonomy";

export const LETTERS = ["A", "B", "C", "D"] as const;
export type Letter = (typeof LETTERS)[number];

/** A question as written in content files / import files / generator output. */
export const QuestionInput = z
  .object({
    id: z.string().regex(/^[a-z0-9][a-z0-9:_-]*$/i, "id may only contain letters, digits, '-', '_' and ':'"),
    section: z.enum(["RW", "MATH"]),
    domain: z.string().optional(),
    skill: z.string(),
    difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    type: z.enum(["mcq", "spr"]),
    stem_md: z.string().min(1),
    passage_md: z.string().min(1).optional().nullable(),
    choices: z.array(z.string().min(1)).length(4).optional().nullable(),
    answer: z.string().min(1),
    explanation_md: z.string().min(1),
    distractor_notes: z.record(z.string(), z.string()).optional().nullable(),
    tags: z.array(z.string()).default([]),
    source: z.string().min(1).optional(),
    license: z.string().min(1).optional(),
  })
  .superRefine((q, ctx) => {
    const skill = SKILL_BY_ID.get(q.skill);
    if (!skill) {
      ctx.addIssue({ code: "custom", path: ["skill"], message: `unknown skill '${q.skill}'` });
      return;
    }
    if (skill.section !== q.section) {
      ctx.addIssue({ code: "custom", path: ["section"], message: `skill '${q.skill}' belongs to ${skill.section}` });
    }
    if (q.domain && q.domain !== skill.domain) {
      ctx.addIssue({ code: "custom", path: ["domain"], message: `skill '${q.skill}' belongs to domain '${skill.domain}'` });
    }
    if (q.type === "mcq") {
      if (!q.choices) ctx.addIssue({ code: "custom", path: ["choices"], message: "mcq needs 4 choices" });
      if (!LETTERS.includes(q.answer as Letter))
        ctx.addIssue({ code: "custom", path: ["answer"], message: "mcq answer must be A, B, C or D" });
      if (q.choices && new Set(q.choices.map((c) => c.trim())).size !== 4)
        ctx.addIssue({ code: "custom", path: ["choices"], message: "choices must all be different" });
      if (q.distractor_notes) {
        for (const k of Object.keys(q.distractor_notes)) {
          if (!LETTERS.includes(k as Letter) || k === q.answer)
            ctx.addIssue({ code: "custom", path: ["distractor_notes", k], message: "distractor note keys must be the wrong letters" });
        }
      }
    } else {
      if (q.choices) ctx.addIssue({ code: "custom", path: ["choices"], message: "spr questions have no choices" });
    }
  });

export type QuestionInput = z.infer<typeof QuestionInput>;

export const ContentFile = z.object({
  source: z.string().default("satori-original"),
  license: z.string().default("CC-BY-4.0"),
  questions: z.array(z.unknown()),
});

/** A question row as the app uses it. */
export interface Question {
  id: string;
  section: "RW" | "MATH";
  domain: string;
  skill_id: string;
  difficulty: 1 | 2 | 3;
  type: "mcq" | "spr";
  stem_md: string;
  passage_md: string | null;
  choices: string[] | null;
  answer: string;
  explanation_md: string;
  distractor_notes: Record<string, string> | null;
  tags: string[];
  source: string;
  license: string;
  generator_id: string | null;
}

export function formatIssues(err: z.ZodError): string {
  return err.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ");
}

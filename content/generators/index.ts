import { SKILL_BY_ID } from "../../lib/taxonomy";
import type { QuestionInput } from "../../lib/question-schema";
import { advancedGenerators } from "./advanced";
import { algebraGenerators } from "./algebra";
import { geometryGenerators } from "./geometry";
import { psdaGenerators } from "./psda";
import { type Difficulty, type Generator, type GeneratorOutput, mulberry32 } from "./_lib";

export type { Generator, GeneratorOutput, Difficulty };

export const GENERATORS: Generator[] = [
  ...algebraGenerators,
  ...advancedGenerators,
  ...psdaGenerators,
  ...geometryGenerators,
];

export const GENERATOR_BY_ID = new Map(GENERATORS.map((g) => [g.id, g]));

/** Stable id for a generated instance. */
export function instanceId(genId: string, difficulty: Difficulty, seed: number): string {
  return `gen:${genId}:d${difficulty}:${seed}`;
}

/** Deterministic seed per (generator, difficulty, index), so ids never change between seeds. */
export function seedFor(genId: string, difficulty: Difficulty, index: number): number {
  let h = 2166136261;
  for (const ch of `${genId}|${difficulty}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return ((h >>> 0) + index * 7919) >>> 0;
}

export function runGenerator(gen: Generator, difficulty: Difficulty, seed: number): GeneratorOutput {
  return gen.generate(mulberry32(seed), difficulty);
}

/** Turn a generator instance into a question ready for the bank. */
export function generateQuestion(gen: Generator, difficulty: Difficulty, seed: number): QuestionInput & { generator_id: string; seed: number } {
  const out = runGenerator(gen, difficulty, seed);
  const skill = SKILL_BY_ID.get(gen.skill);
  if (!skill) throw new Error(`generator ${gen.id} has unknown skill ${gen.skill}`);
  return {
    id: instanceId(gen.id, difficulty, seed),
    section: "MATH",
    domain: skill.domain,
    skill: gen.skill,
    difficulty,
    type: out.type,
    stem_md: out.stem_md,
    passage_md: null,
    choices: out.choices ?? null,
    answer: out.answer,
    explanation_md: out.explanation_md,
    distractor_notes: out.distractor_notes ?? null,
    tags: ["generated", gen.id, ...(gen.tags ?? [])],
    source: `satori-generator:${gen.id}`,
    license: "CC-BY-4.0",
    generator_id: gen.id,
    seed,
  };
}

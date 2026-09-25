import fs from "node:fs";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { GENERATORS, generateQuestion, seedFor } from "../content/generators";
import { tx } from "./db/tx";
import { ContentFile, formatIssues, QuestionInput } from "./question-schema";
import { SKILL_BY_ID, SKILLS } from "./taxonomy";
import { seedVocab } from "./vocab";

export const QUESTIONS_DIR = path.join(process.cwd(), "content", "questions");
export const INSTANCES_PER_GENERATOR_DIFFICULTY = 10;

export interface SeedReport {
  skills: number;
  handwritten: number;
  generated: number;
  vocab: number;
  files: number;
  errors: string[];
}

type Row = QuestionInput & { generator_id?: string | null; seed?: number | null };

const UPSERT_SQL = `
INSERT INTO questions (id, section, domain, skill_id, difficulty, type, stem_md, passage_md, choices_json,
  answer, explanation_md, distractor_notes_json, tags_json, source, license, generator_id, seed)
VALUES ($id, $section, $domain, $skill_id, $difficulty, $type, $stem_md, $passage_md, $choices_json,
  $answer, $explanation_md, $distractor_notes_json, $tags_json, $source, $license, $generator_id, $seed)
ON CONFLICT(id) DO UPDATE SET
  section = excluded.section, domain = excluded.domain, skill_id = excluded.skill_id,
  difficulty = excluded.difficulty, type = excluded.type, stem_md = excluded.stem_md,
  passage_md = excluded.passage_md, choices_json = excluded.choices_json, answer = excluded.answer,
  explanation_md = excluded.explanation_md, distractor_notes_json = excluded.distractor_notes_json,
  tags_json = excluded.tags_json, source = excluded.source, license = excluded.license,
  generator_id = excluded.generator_id, seed = excluded.seed`;

export function upsertQuestion(db: DatabaseSync, q: Row): void {
  const skill = SKILL_BY_ID.get(q.skill)!;
  db.prepare(UPSERT_SQL).run({
    $id: q.id,
    $section: q.section,
    $domain: skill.domain,
    $skill_id: q.skill,
    $difficulty: q.difficulty,
    $type: q.type,
    $stem_md: q.stem_md,
    $passage_md: q.passage_md ?? null,
    $choices_json: q.choices ? JSON.stringify(q.choices) : null,
    $answer: q.answer,
    $explanation_md: q.explanation_md,
    $distractor_notes_json: q.distractor_notes ? JSON.stringify(q.distractor_notes) : null,
    $tags_json: JSON.stringify(q.tags ?? []),
    $source: q.source ?? "satori-original",
    $license: q.license ?? "CC-BY-4.0",
    $generator_id: q.generator_id ?? null,
    $seed: q.seed ?? null,
  });
}

export function seedSkills(db: DatabaseSync): number {
  const stmt = db.prepare(
    `INSERT INTO skills (id, section, domain, domain_name, name, sort) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET section = excluded.section, domain = excluded.domain,
       domain_name = excluded.domain_name, name = excluded.name, sort = excluded.sort`,
  );
  for (const s of SKILLS) stmt.run(s.id, s.section, s.domain, s.domainName, s.name, s.sort);
  return SKILLS.length;
}

/** Read and validate every content/questions/*.json file. */
export function loadContentFiles(dir = QUESTIONS_DIR): { questions: Row[]; errors: string[]; files: number } {
  const errors: string[] = [];
  const questions: Row[] = [];
  const seen = new Map<string, string>();
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort() : [];
  for (const file of files) {
    let json: unknown;
    try {
      json = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
    } catch (e) {
      errors.push(`${file}: invalid JSON (${(e as Error).message})`);
      continue;
    }
    const parsedFile = ContentFile.safeParse(json);
    if (!parsedFile.success) {
      errors.push(`${file}: ${formatIssues(parsedFile.error)}`);
      continue;
    }
    parsedFile.data.questions.forEach((raw, i) => {
      const r = QuestionInput.safeParse(raw);
      const label = `${file}#${i}${(raw as { id?: string })?.id ? ` (${(raw as { id: string }).id})` : ""}`;
      if (!r.success) {
        errors.push(`${label}: ${formatIssues(r.error)}`);
        return;
      }
      const q = r.data;
      if (seen.has(q.id)) {
        errors.push(`${label}: duplicate id, also in ${seen.get(q.id)}`);
        return;
      }
      seen.set(q.id, file);
      questions.push({
        ...q,
        source: q.source ?? parsedFile.data.source,
        license: q.license ?? parsedFile.data.license,
      });
    });
  }
  return { questions, errors, files: files.length };
}

export function generatedQuestions(perDifficulty = INSTANCES_PER_GENERATOR_DIFFICULTY): Row[] {
  const out: Row[] = [];
  for (const gen of GENERATORS) {
    for (const d of gen.difficulties) {
      for (let i = 0; i < perDifficulty; i++) out.push(generateQuestion(gen, d, seedFor(gen.id, d, i)));
    }
  }
  return out;
}

/** Load taxonomy, hand-written questions and generator instances. Safe to run repeatedly. */
export function seedDatabase(db: DatabaseSync): SeedReport {
  const { questions, errors, files } = loadContentFiles();
  const generated = generatedQuestions();
  const report: SeedReport = { skills: 0, handwritten: 0, generated: 0, vocab: 0, files, errors };
  tx(db, () => {
    report.skills = seedSkills(db);
    const v = seedVocab(db);
    report.vocab = v.count;
    errors.push(...v.errors);
    for (const q of questions) upsertQuestion(db, q);
    for (const q of generated) upsertQuestion(db, q);
  });
  report.handwritten = questions.length;
  report.generated = generated.length;
  return report;
}

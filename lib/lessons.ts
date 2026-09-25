/**
 * Lessons live in content/lessons/*.md. A file holds one or more lessons, each starting
 * with a frontmatter block:
 *
 *   ---
 *   slug: transitions
 *   skill: transitions        (optional: links the lesson to a skill's practice set)
 *   title: Transitions
 *   summary: One line shown in the lesson list.
 *   ---
 *   Markdown body…
 *
 * A line that is exactly `---` starts a new frontmatter block, so don't use `---` as a
 * horizontal rule inside a lesson body.
 */
import fs from "node:fs";
import path from "node:path";
import { SKILL_BY_ID } from "@/lib/taxonomy";

export interface Lesson {
  slug: string;
  skill: string | null;
  title: string;
  summary: string;
  body: string;
  file: string;
}

export const LESSONS_DIR = path.join(process.cwd(), "content", "lessons");

export function parseLessonFile(text: string, file = ""): Lesson[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const lessons: Lesson[] = [];
  let i = 0;
  while (i < lines.length) {
    if (lines[i].trim() !== "---") {
      i++;
      continue;
    }
    // Frontmatter
    const meta: Record<string, string> = {};
    let j = i + 1;
    while (j < lines.length && lines[j].trim() !== "---") {
      const m = /^([a-z_]+):\s*(.*)$/i.exec(lines[j]);
      if (m) meta[m[1].toLowerCase()] = m[2].trim().replace(/^"(.*)"$/, "$1");
      j++;
    }
    let k = j + 1;
    while (k < lines.length && lines[k].trim() !== "---") k++;
    const body = lines.slice(j + 1, k).join("\n").trim();
    if (meta.slug && meta.title) {
      lessons.push({ slug: meta.slug, skill: meta.skill || null, title: meta.title, summary: meta.summary ?? "", body, file });
    }
    i = k;
  }
  return lessons;
}

let cache: Lesson[] | null = null;

export function allLessons(): Lesson[] {
  if (cache && process.env.NODE_ENV === "production") return cache;
  const files = fs.existsSync(LESSONS_DIR) ? fs.readdirSync(LESSONS_DIR).filter((f) => f.endsWith(".md")).sort() : [];
  const out = files.flatMap((f) => parseLessonFile(fs.readFileSync(path.join(LESSONS_DIR, f), "utf8"), f));
  // Order: skill lessons in taxonomy order, then general lessons.
  out.sort((a, b) => (a.skill ? SKILL_BY_ID.get(a.skill)!.sort : 1000) - (b.skill ? SKILL_BY_ID.get(b.skill)!.sort : 1000));
  cache = out;
  return out;
}

export function lessonBySlug(slug: string): Lesson | null {
  return allLessons().find((l) => l.slug === slug) ?? null;
}

export function lessonForSkill(skill: string): Lesson | null {
  return allLessons().find((l) => l.skill === skill) ?? null;
}

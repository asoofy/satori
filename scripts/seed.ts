/**
 * npm run seed — load the skill taxonomy, the hand-written question bank
 * (content/questions/*.json) and the math generator instances into data/satori.db.
 * Safe to run again: questions are upserted by id and progress is kept.
 */
import { dbPath, openDb } from "../lib/db";
import { seedDatabase } from "../lib/seed";

const db = openDb();
const r = seedDatabase(db);
const counts = db
  .prepare("SELECT section, COUNT(*) AS n FROM questions GROUP BY section ORDER BY section")
  .all() as { section: string; n: number }[];

console.log(`Database: ${dbPath()}`);
console.log(`Skills: ${r.skills}`);
console.log(`Hand-written questions: ${r.handwritten} (from ${r.files} files)`);
console.log(`Generated questions: ${r.generated}`);
console.log(`Vocabulary words: ${r.vocab}`);
console.log(`Bank totals: ${counts.map((c) => `${c.section} ${c.n}`).join(", ")}`);
if (r.errors.length) {
  console.error(`\n${r.errors.length} validation error(s):`);
  for (const e of r.errors) console.error(`  - ${e}`);
  process.exitCode = 1;
} else {
  console.log("No validation errors.");
}
db.close();

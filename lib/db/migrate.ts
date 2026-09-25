import fs from "node:fs";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";

export const MIGRATIONS_DIR = path.join(process.cwd(), "db", "migrations");

/**
 * Applies every `db/migrations/*.sql` file that hasn't been applied yet,
 * in filename order, each inside its own transaction.
 * Returns the names of the migrations applied by this call.
 */
export function migrate(db: DatabaseSync, dir = MIGRATIONS_DIR): string[] {
  db.exec(`CREATE TABLE IF NOT EXISTS _migrations (
    name TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);
  const applied = new Set(
    (db.prepare("SELECT name FROM _migrations").all() as { name: string }[]).map((r) => r.name),
  );
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const ran: string[] = [];
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(dir, file), "utf8");
    db.exec("BEGIN");
    try {
      db.exec(sql);
      db.prepare("INSERT INTO _migrations (name) VALUES (?)").run(file);
      db.exec("COMMIT");
      ran.push(file);
    } catch (err) {
      db.exec("ROLLBACK");
      throw new Error(`Migration ${file} failed: ${(err as Error).message}`);
    }
  }
  return ran;
}

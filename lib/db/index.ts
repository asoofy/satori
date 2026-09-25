import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { migrate, MIGRATIONS_DIR } from "./migrate";
import { seedDatabase } from "../seed";

export { tx } from "./tx";

export type DB = DatabaseSync;

export function dbPath(): string {
  return process.env.SATORI_DB_PATH || path.join(process.cwd(), "data", "satori.db");
}

/** Open a database file (or ":memory:"), apply pragmas and migrations. */
export function openDb(file: string = dbPath()): DB {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
  migrate(db);
  ensureDefaultProfile(db);
  return db;
}

export function ensureDefaultProfile(db: DB): void {
  const row = db.prepare("SELECT COUNT(*) AS n FROM profiles").get() as { n: number };
  if (row.n === 0) {
    db.prepare("INSERT INTO profiles (name) VALUES (?)").run("Student");
  }
  db.exec("INSERT OR IGNORE INTO settings (profile_id) SELECT id FROM profiles");
}

const g = globalThis as unknown as { __satoriDb?: DB; __satoriSeedChecked?: boolean; __satoriMigrations?: number };

/**
 * The app's shared connection. Created lazily, survives hot reloads, and on
 * first use loads the bundled question bank if the database is empty.
 */
export function getDb(): DB {
  if (!g.__satoriDb) {
    g.__satoriDb = openDb();
    g.__satoriMigrations = migrationCount();
  } else if (process.env.NODE_ENV !== "production") {
    // In development the connection outlives code changes; pick up new migration files.
    const n = migrationCount();
    if (n !== g.__satoriMigrations) {
      migrate(g.__satoriDb);
      g.__satoriMigrations = n;
    }
  }
  if (!g.__satoriSeedChecked) {
    g.__satoriSeedChecked = true;
    const count = (table: string) => (g.__satoriDb!.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;
    // Load the bundled content on first run (or when a newer version added content, e.g. vocabulary).
    if (count("questions") === 0 || count("vocab_words") === 0) {
      seedDatabase(g.__satoriDb);
    }
  }
  return g.__satoriDb;
}

function migrationCount(): number {
  return fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).length;
}

/** Close the shared connection (e.g. before replacing the database file). It reopens on next use. */
export function closeDb(): void {
  if (g.__satoriDb) {
    try {
      g.__satoriDb.close();
    } catch {
      // already closed
    }
  }
  g.__satoriDb = undefined;
  g.__satoriSeedChecked = false;
}

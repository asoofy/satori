/**
 * Backup and restore of the whole database file.
 * Backups use SQLite's VACUUM INTO, which writes a consistent copy even while the app runs.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { closeDb, dbPath, getDb } from "@/lib/db";

const SQLITE_HEADER = "SQLite format 3\u0000";
const REQUIRED_TABLES = ["profiles", "settings", "questions", "attempts", "_migrations"];

export function backupBytes(): Buffer {
  const tmp = path.join(os.tmpdir(), `satori-backup-${process.pid}-${Date.now()}.db`);
  try {
    getDb().exec(`VACUUM INTO '${tmp.replace(/'/g, "''")}'`);
    return fs.readFileSync(tmp);
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}

/** Check that bytes are a Satori database. Returns an error message, or null if it looks right. */
export function validateBackup(bytes: Buffer): string | null {
  if (bytes.length < 100 || bytes.subarray(0, 16).toString("latin1") !== SQLITE_HEADER) return "That file isn’t a SQLite database.";
  const tmp = path.join(os.tmpdir(), `satori-restore-check-${process.pid}-${Date.now()}.db`);
  fs.writeFileSync(tmp, bytes);
  try {
    const db = new DatabaseSync(tmp, { readOnly: true });
    try {
      const tables = new Set((db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[]).map((r) => r.name));
      const missing = REQUIRED_TABLES.filter((t) => !tables.has(t));
      if (missing.length) return `That database isn’t a Satori backup (missing: ${missing.join(", ")}).`;
      const check = db.prepare("PRAGMA integrity_check").get() as { integrity_check: string };
      if (check.integrity_check !== "ok") return "That database file is damaged.";
      return null;
    } finally {
      db.close();
    }
  } catch {
    return "Couldn’t open that database file.";
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}

/**
 * Replace the current database with a backup. The current file is kept next to it as
 * satori.db.before-restore-<timestamp> in case you need to undo.
 */
export function restoreBackup(bytes: Buffer): { savedPrevious: string } {
  const err = validateBackup(bytes);
  if (err) throw new Error(err);
  const file = dbPath();
  // Flush the WAL into the main file, then close so we can swap files.
  try {
    getDb().exec("PRAGMA wal_checkpoint(TRUNCATE)");
  } catch {
    // ignore
  }
  closeDb();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const previous = `${file}.before-restore-${stamp}`;
  if (fs.existsSync(file)) fs.copyFileSync(file, previous);
  for (const suffix of ["-wal", "-shm"]) fs.rmSync(file + suffix, { force: true });
  fs.writeFileSync(file, bytes);
  // Reopen now: applies any newer migrations to the restored file.
  getDb();
  return { savedPrevious: path.basename(previous) };
}

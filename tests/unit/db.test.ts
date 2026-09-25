import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { openDb } from "@/lib/db";
import { migrate } from "@/lib/db/migrate";
import { seedDatabase } from "@/lib/seed";

describe("database", () => {
  it("applies migrations once and creates a default profile", () => {
    const db = openDb(":memory:");
    const tables = (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[]).map((r) => r.name);
    for (const t of ["profiles", "settings", "skills", "questions", "attempts", "saved", "_migrations"]) expect(tables).toContain(t);
    expect(migrate(db)).toEqual([]); // second run applies nothing
    const p = db.prepare("SELECT COUNT(*) AS n FROM profiles").get() as { n: number };
    expect(p.n).toBe(1);
    const s = db.prepare("SELECT goal_score, onboarded FROM settings").get() as { goal_score: number; onboarded: number };
    expect(s.onboarded).toBe(0);
  });

  it("rolls back a failing migration", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "satori-mig-"));
    fs.writeFileSync(path.join(dir, "0001_ok.sql"), "CREATE TABLE a (x INTEGER);");
    fs.writeFileSync(path.join(dir, "0002_bad.sql"), "CREATE TABLE b (x INTEGER); THIS IS NOT SQL;");
    const db = openDb(":memory:");
    expect(() => migrate(db, dir)).toThrow(/0002_bad/);
    const names = (db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[]).map((r) => r.name);
    expect(names).toContain("a");
    expect(names).not.toContain("b");
  });

  it("seeds idempotently and keeps attempts on re-seed", () => {
    const db = openDb(":memory:");
    const r1 = seedDatabase(db);
    expect(r1.errors).toEqual([]);
    const count = () => (db.prepare("SELECT COUNT(*) AS n FROM questions").get() as { n: number }).n;
    const n1 = count();
    expect(n1).toBe(r1.handwritten + r1.generated);
    db.prepare("INSERT INTO attempts (profile_id, question_id, response, correct) VALUES (1, 'rw-ci-01', 'B', 1)").run();
    seedDatabase(db);
    expect(count()).toBe(n1);
    const a = db.prepare("SELECT COUNT(*) AS n FROM attempts").get() as { n: number };
    expect(a.n).toBe(1);
  });
});

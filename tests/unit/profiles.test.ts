import { describe, expect, it } from "vitest";
import { validateBackup } from "@/lib/backup";
import { openDb } from "@/lib/db";
import { createProfile, deleteProfile, leaderboard, leagueFor, resetProgress } from "@/lib/profiles";
import { recordAttempt } from "@/lib/repo/progress";
import { seedDatabase } from "@/lib/seed";
import { tutorSystem } from "@/lib/tutor";

function freshDb() {
  const db = openDb(":memory:");
  seedDatabase(db);
  return db;
}

const answer = (db: ReturnType<typeof freshDb>, profileId: number, n: number, correct: boolean) => {
  const ids = (db.prepare("SELECT id FROM questions LIMIT ?").all(n) as { id: string }[]).map((r) => r.id);
  for (const id of ids) recordAttempt(db, { profileId, questionId: id, response: "A", correct, timeMs: 1000, eliminated: [], context: "practice" });
};

describe("profiles", () => {
  it("creates, ranks and deletes profiles", () => {
    const db = freshDb();
    const b = createProfile(db, "Sam", "🦊");
    answer(db, 1, 5, true); // 50 XP
    answer(db, b, 30, true); // 300 XP
    const today = new Date().toISOString().slice(0, 10);
    const board = leaderboard(db, today);
    expect(board.map((r) => r.name)).toEqual(["Sam", "Student"]);
    expect(board[0].weeklyXp).toBe(300);
    expect(board[0].league.name).toBe("Silver");
    expect(board[1].league.name).toBe("Bronze");
    deleteProfile(db, b);
    expect(() => deleteProfile(db, 1)).toThrow(/only profile/);
  });

  it("assigns leagues by weekly XP", () => {
    expect(leagueFor(0).id).toBe("bronze");
    expect(leagueFor(200).id).toBe("silver");
    expect(leagueFor(999).id).toBe("gold");
    expect(leagueFor(1000).id).toBe("diamond");
  });

  it("resets one profile's progress without touching others", () => {
    const db = freshDb();
    const b = createProfile(db, "Sam", "🦊");
    answer(db, 1, 3, false);
    answer(db, b, 4, true);
    db.prepare("INSERT INTO saved (profile_id, question_id) VALUES (1, 'rw-ci-01')").run();
    resetProgress(db, 1);
    const count = (pid: number) => (db.prepare("SELECT COUNT(*) AS n FROM attempts WHERE profile_id = ?").get(pid) as { n: number }).n;
    expect(count(1)).toBe(0);
    expect(count(b)).toBe(4);
    expect((db.prepare("SELECT COUNT(*) AS n FROM saved").get() as { n: number }).n).toBe(0);
    expect(db.prepare("SELECT 1 FROM profiles WHERE id = 1").get()).toBeTruthy();
  });
});

describe("tutor context", () => {
  it("hides the answer before the student answers and explains after", () => {
    const db = freshDb();
    const before = tutorSystem(db, 1, "Ana", { questionId: "rw-tr-01", answered: false });
    expect(before).toContain("has NOT answered yet");
    expect(before).toContain("Do not reveal the answer");
    const after = tutorSystem(db, 1, "Ana", { questionId: "rw-tr-01", answered: true, response: "A" });
    expect(after).toContain("The student answered A. The correct answer is B.");
    expect(after).toContain("Official explanation");
  });

  it("mentions weak skills when there is enough data", () => {
    const db = freshDb();
    const ids = (db.prepare("SELECT id FROM questions WHERE skill_id = 'boundaries' LIMIT 4").all() as { id: string }[]).map((r) => r.id);
    for (const id of ids) recordAttempt(db, { profileId: 1, questionId: id, response: "A", correct: false, timeMs: 1, eliminated: [], context: "practice" });
    expect(tutorSystem(db, 1, "Ana", {})).toContain("Boundaries");
  });
});

describe("backup validation", () => {
  it("rejects files that aren't Satori databases", () => {
    expect(validateBackup(Buffer.from("hello world, definitely not sqlite".repeat(10)))).toMatch(/isn’t a SQLite/);
  });
});

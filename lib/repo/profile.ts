import type { DB } from "@/lib/db";

export type Theme = "system" | "light" | "dark";

export interface Profile {
  id: number;
  name: string;
  avatar: string;
  created_at: string;
}

export interface Settings {
  profile_id: number;
  test_date: string | null;
  goal_score: number;
  current_score: number | null;
  daily_goal: number;
  theme: Theme;
  onboarded: number;
  study_days_json: string;
}

export function listProfiles(db: DB): Profile[] {
  return db.prepare("SELECT * FROM profiles ORDER BY id").all() as unknown as Profile[];
}

export function getProfile(db: DB, id: number): Profile | null {
  return (db.prepare("SELECT * FROM profiles WHERE id = ?").get(id) as unknown as Profile) ?? null;
}

export function getSettings(db: DB, profileId: number): Settings {
  db.prepare("INSERT OR IGNORE INTO settings (profile_id) VALUES (?)").run(profileId);
  return db.prepare("SELECT * FROM settings WHERE profile_id = ?").get(profileId) as unknown as Settings;
}

export function updateSettings(db: DB, profileId: number, patch: Partial<Omit<Settings, "profile_id">>): void {
  const keys = Object.keys(patch).filter((k) =>
    ["test_date", "goal_score", "current_score", "daily_goal", "theme", "onboarded", "study_days_json"].includes(k),
  ) as (keyof typeof patch)[];
  if (!keys.length) return;
  getSettings(db, profileId);
  const sql = `UPDATE settings SET ${keys.map((k) => `${k} = $${k}`).join(", ")} WHERE profile_id = $pid`;
  const params: Record<string, string | number | null> = { $pid: profileId };
  for (const k of keys) params[`$${k}`] = patch[k] as string | number | null;
  db.prepare(sql).run(params);
}

export function renameProfile(db: DB, profileId: number, name: string, avatar?: string): void {
  if (avatar) db.prepare("UPDATE profiles SET name = ?, avatar = ? WHERE id = ?").run(name, avatar, profileId);
  else db.prepare("UPDATE profiles SET name = ? WHERE id = ?").run(name, profileId);
}

export interface PracticeSet {
  id: number;
  profile_id: number;
  title: string;
  kind: string;
  question_ids: string[];
  created_at: string;
}

export function createPracticeSet(db: DB, profileId: number, title: string, kind: string, ids: string[]): number {
  const r = db
    .prepare("INSERT INTO practice_sets (profile_id, title, kind, question_ids_json) VALUES (?, ?, ?, ?)")
    .run(profileId, title, kind, JSON.stringify(ids));
  return Number(r.lastInsertRowid);
}

export function getPracticeSet(db: DB, id: number): PracticeSet | null {
  const r = db.prepare("SELECT * FROM practice_sets WHERE id = ?").get(id) as
    | { id: number; profile_id: number; title: string; kind: string; question_ids_json: string; created_at: string }
    | undefined;
  if (!r) return null;
  return { ...r, question_ids: JSON.parse(r.question_ids_json) as string[] };
}

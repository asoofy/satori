import type { PlayerQuestion } from "@/components/PracticePlayer";
import type { DB } from "@/lib/db";
import type { Question } from "@/lib/question-schema";
import { toPublic } from "@/lib/repo/questions";
import { savedIds } from "@/lib/repo/progress";
import { DOMAIN_BY_ID, SKILL_BY_ID } from "@/lib/taxonomy";

/** Strip answer keys and attach display names, for sending questions to the player. */
export function toPlayerQuestions(db: DB, profileId: number, qs: Question[]): PlayerQuestion[] {
  const saved = savedIds(db, profileId, qs.map((q) => q.id));
  return qs.map((q) => ({
    ...toPublic(q),
    skillName: SKILL_BY_ID.get(q.skill_id)?.name ?? q.skill_id,
    domainName: DOMAIN_BY_ID.get(q.domain)?.name ?? q.domain,
    saved: saved.has(q.id),
  }));
}

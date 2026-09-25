import Link from "next/link";
import { aiConfigured } from "@/lib/ai";
import { currentProfile } from "@/lib/current";
import { listCustomLessons } from "@/lib/custom-lessons";
import { getDb } from "@/lib/db";
import { skillPriority, skillStats } from "@/lib/session";
import { DOMAINS } from "@/lib/taxonomy";
import { CustomLessonForm } from "./CustomLessonForm";

export const metadata = { title: "Custom Lessons" };

export default async function CustomLessonsPage() {
  const { profile } = await currentProfile();
  const db = getDb();
  const lessons = listCustomLessons(db, profile.id);
  const stats = skillStats(db, profile.id);
  const suggested = [...stats.values()]
    .filter((s) => s.attempts >= 3)
    .sort((a, b) => skillPriority(b) - skillPriority(a))
    .slice(0, 3)
    .map((s) => s.skill_id);
  const groups = DOMAINS.map((d) => ({
    id: d.id,
    label: `${d.section === "RW" ? "R&W" : "Math"} · ${d.name}`,
    skills: d.skills.map((s) => {
      const st = stats.get(s.id)!;
      return { id: s.id, name: s.name, detail: st.attempts ? `${Math.round((st.accuracy ?? 0) * 100)}% of ${st.attempts}` : "new" };
    }),
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Custom Lessons</h1>
        <p className="text-muted">Pick up to three skills. Satori builds a lesson around your results, plus a matching practice set.</p>
      </div>
      <CustomLessonForm groups={groups} suggested={suggested} aiAvailable={aiConfigured()} />
      {lessons.length > 0 && (
        <section>
          <h2 className="mb-2 text-lg font-semibold">Your custom lessons</h2>
          <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
            {lessons.map((l) => (
              <li key={l.id}>
                <Link href={`/custom/${l.id}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-surface-2">
                  <span className="font-medium">{l.title}</span>
                  <span className="text-sm text-muted">
                    {l.source.startsWith("ai:") ? "AI-written" : "Built-in"} · {new Date(l.created_at + "Z").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

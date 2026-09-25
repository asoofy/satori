import Link from "next/link";
import { allLessons } from "@/lib/lessons";
import { DOMAINS } from "@/lib/taxonomy";

export const metadata = { title: "Lessons" };

export default function LessonsPage() {
  const lessons = allLessons();
  const general = lessons.filter((l) => !l.skill);
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Lessons</h1>
        <p className="text-muted">Short lessons for every SAT skill, each with a strategy, a worked example, common traps and a practice set.</p>
      </div>

      {general.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold tracking-widest text-muted uppercase">Start here</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {general.map((l) => (
              <LessonCard key={l.slug} slug={l.slug} title={l.title} summary={l.summary} />
            ))}
          </div>
        </section>
      )}

      {DOMAINS.map((d) => {
        const list = lessons.filter((l) => l.skill && d.skills.some((s) => s.id === l.skill));
        if (!list.length) return null;
        return (
          <section key={d.id}>
            <h2 className="mb-2 text-sm font-semibold tracking-widest text-muted uppercase">
              {d.section === "RW" ? "Reading & Writing" : "Math"} · {d.name}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {list.map((l) => (
                <LessonCard key={l.slug} slug={l.slug} title={l.title} summary={l.summary} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function LessonCard({ slug, title, summary }: { slug: string; title: string; summary: string }) {
  return (
    <Link href={`/lessons/${slug}`} className="rounded-2xl border border-line bg-surface p-4 shadow-sm transition-colors hover:border-accent">
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-sm text-muted">{summary}</p>
    </Link>
  );
}

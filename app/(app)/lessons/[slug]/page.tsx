import Link from "next/link";
import { notFound } from "next/navigation";
import { practiceSkill } from "@/app/content-actions";
import { Md } from "@/components/Md";
import { currentProfile } from "@/lib/current";
import { getDb } from "@/lib/db";
import { lessonBySlug } from "@/lib/lessons";
import { skillStats } from "@/lib/session";
import { SKILL_BY_ID } from "@/lib/taxonomy";

export default async function LessonPage({ params }: PageProps<"/lessons/[slug]">) {
  const { slug } = await params;
  const lesson = lessonBySlug(slug);
  if (!lesson) notFound();
  const skill = lesson.skill ? SKILL_BY_ID.get(lesson.skill) : null;
  const { profile } = await currentProfile();
  const stat = lesson.skill ? skillStats(getDb(), profile.id).get(lesson.skill) : null;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <Link href="/lessons" className="text-sm text-muted hover:underline">
        ← All lessons
      </Link>
      <header>
        {skill && (
          <p className="text-sm font-semibold tracking-widest text-muted uppercase">
            {skill.section === "RW" ? "Reading & Writing" : "Math"} · {skill.domainName}
          </p>
        )}
        <h1 className="text-3xl font-bold">{lesson.title}</h1>
        <p className="mt-1 text-muted">{lesson.summary}</p>
      </header>
      <article className="rounded-2xl border border-line bg-surface p-6 leading-relaxed shadow-sm">
        <Md>{lesson.body}</Md>
      </article>
      {skill && (
        <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold">Practice {skill.name}</p>
            <p className="text-sm text-muted">
              10 questions matched to your level.{" "}
              {stat && stat.attempts > 0 ? `You’re at ${Math.round((stat.accuracy ?? 0) * 100)}% over ${stat.attempts} answers.` : "You haven’t practiced this skill yet."}
            </p>
          </div>
          <form action={practiceSkill.bind(null, skill.id)}>
            <button className="w-full rounded-xl bg-accent px-5 py-2.5 font-semibold text-accent-ink hover:opacity-90 sm:w-auto">Start practice set</button>
          </form>
        </div>
      )}
    </div>
  );
}

export async function generateMetadata({ params }: PageProps<"/lessons/[slug]">) {
  const { slug } = await params;
  return { title: lessonBySlug(slug)?.title ?? "Lesson" };
}

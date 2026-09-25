import Link from "next/link";
import { notFound } from "next/navigation";
import { Md } from "@/components/Md";
import { currentProfile } from "@/lib/current";
import { getCustomLesson } from "@/lib/custom-lessons";
import { getDb } from "@/lib/db";

export const metadata = { title: "Custom lesson" };

export default async function CustomLessonPage({ params }: PageProps<"/custom/[id]">) {
  const { id } = await params;
  const { profile } = await currentProfile();
  const lesson = getCustomLesson(getDb(), profile.id, Number(id));
  if (!lesson) notFound();
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <Link href="/custom" className="text-sm text-muted hover:underline">
        ← Custom lessons
      </Link>
      <h1 className="text-3xl font-bold">{lesson.title}</h1>
      <p className="text-sm text-muted">{lesson.source.startsWith("ai:") ? `Written by AI (${lesson.source.slice(3)}) for you.` : "Built from Satori’s lessons and your results."}</p>
      <article className="rounded-2xl border border-line bg-surface p-6 leading-relaxed shadow-sm">
        <Md>{lesson.body_md}</Md>
      </article>
      {lesson.set_id && (
        <Link href={`/practice/${lesson.set_id}`} className="self-start rounded-xl bg-accent px-5 py-2.5 font-semibold text-accent-ink">
          Start the practice set
        </Link>
      )}
    </div>
  );
}

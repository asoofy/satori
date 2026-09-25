import { notFound, redirect } from "next/navigation";
import { BreakScreen } from "@/components/BreakScreen";
import { TestRunner } from "@/components/TestRunner";
import { currentProfile } from "@/lib/current";
import { getDb } from "@/lib/db";
import { toPlayerQuestions } from "@/lib/player";
import { getQuestionsByIds } from "@/lib/repo/questions";
import { autoSubmitExpired, getAnswers, getModule, getModules, getTest, TEST_LABEL } from "@/lib/tests";

export const metadata = { title: "Practice test" };

export default async function TakeTestPage({ params }: PageProps<"/take/[id]">) {
  const { id } = await params;
  const { profile } = await currentProfile();
  const db = getDb();
  const testId = Number(id);
  if (!getTest(db, profile.id, testId)) notFound();
  autoSubmitExpired(db, profile.id, testId);
  const test = getTest(db, profile.id, testId)!;

  if (test.phase === "done") redirect(`/tests/${testId}`);
  if (test.phase === "abandoned") redirect("/tests");
  if (test.phase === "break") return <BreakScreen testId={testId} endsAt={test.break_ends_at!} />;

  const m = getModule(db, test.current_module_id!)!;
  const modules = getModules(db, testId);
  const sectionIndex = test.sections.indexOf(m.section) + 1;
  const questions = toPlayerQuestions(db, profile.id, getQuestionsByIds(db, m.question_ids));
  const answers = Object.fromEntries(
    [...getAnswers(db, m.id).values()].map((a) => [
      a.question_id,
      { response: a.response ?? "", flagged: !!a.flagged, eliminated: a.eliminated, highlights: a.highlights, note: a.note },
    ]),
  );
  const title = `${test.kind === "module" ? "Module" : `Section ${sectionIndex}, Module ${m.stage}`}: ${m.section === "RW" ? "Reading and Writing" : "Math"}`;

  return (
    <TestRunner
      key={m.id}
      testId={testId}
      moduleId={m.id}
      title={title}
      testLabel={TEST_LABEL[test.kind]}
      section={m.section}
      startedAt={m.started_at}
      endsAt={m.ends_at}
      timeLimitS={m.time_limit_s}
      isLastModule={test.kind === "module" || (m.stage === 2 && m.section === test.sections[test.sections.length - 1])}
      moduleNumber={modules.length}
      questions={questions}
      initialAnswers={answers}
    />
  );
}

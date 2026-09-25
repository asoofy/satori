import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Md, MdInline } from "@/components/Md";
import { DifficultyBadge } from "@/components/PracticePlayer";
import { currentProfile } from "@/lib/current";
import { getDb } from "@/lib/db";
import { fmtTime } from "@/lib/format";
import { getQuestionsByIds } from "@/lib/repo/questions";
import { DOMAIN_BY_ID, SKILL_BY_ID } from "@/lib/taxonomy";
import { BLUEPRINT, EASY_ROUTE_CAP, getAnswers, getModules, getTest, TEST_LABEL } from "@/lib/tests";

export const metadata = { title: "Score report" };

export default async function ReportPage({ params }: PageProps<"/tests/[id]">) {
  const { id } = await params;
  const { profile } = await currentProfile();
  const db = getDb();
  const test = getTest(db, profile.id, Number(id));
  if (!test) notFound();
  if (test.phase !== "done") redirect(`/take/${test.id}`);

  const modules = getModules(db, test.id).map((m) => {
    const answers = getAnswers(db, m.id);
    const qs = getQuestionsByIds(db, m.question_ids);
    return { ...m, qs, answers, time: [...answers.values()].reduce((t, a) => t + a.time_ms, 0) };
  });
  const sections = test.sections.map((s) => {
    const mods = modules.filter((m) => m.section === s);
    const score = s === "RW" ? test.rw_score : test.math_score;
    const margin = s === "RW" ? test.rw_margin : test.math_margin;
    const route = mods.find((m) => m.stage === 2)?.level ?? null;
    // Domain breakdown
    const domains = new Map<string, { correct: number; total: number }>();
    for (const m of mods)
      for (const q of m.qs) {
        const d = domains.get(q.domain) ?? { correct: 0, total: 0 };
        d.total++;
        if (m.answers.get(q.id)?.correct === 1) d.correct++;
        domains.set(q.domain, d);
      }
    return { s, mods, score, margin, route, domains };
  });
  const total = test.kind === "full" && test.rw_score !== null && test.math_score !== null ? test.rw_score + test.math_score : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/tests" className="text-sm text-muted hover:underline">
          ← Practice tests
        </Link>
        <h1 className="text-2xl font-bold">Score report</h1>
        <p className="text-muted">
          {TEST_LABEL[test.kind]} · {test.completed_at && new Date(test.completed_at + "Z").toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
        </p>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        {total !== null && (
          <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
            <p className="text-sm text-muted">Estimated total score</p>
            <p className="text-5xl font-semibold">{total}</p>
            <p className="text-sm text-muted">400–1600 scale</p>
          </div>
        )}
        {sections.map((sec) => (
          <div key={sec.s} className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
            <p className="text-sm text-muted">{sec.s === "RW" ? "Reading and Writing" : "Math"} (estimate)</p>
            <p className="text-4xl font-semibold">
              {sec.score ?? "—"}
              {sec.margin !== null && <span className="ml-1 text-lg font-normal text-muted">± {sec.margin}</span>}
            </p>
            <p className="text-sm text-muted">
              {sec.route === "hard" ? "Routed to the harder module 2" : sec.route === "easy" ? `Routed to the easier module 2 (scores capped at ${EASY_ROUTE_CAP})` : "Single module"}
            </p>
          </div>
        ))}
      </section>
      <p className="text-xs text-muted">
        Scores are estimates from this test’s answers using Satori’s documented model, not official SAT scores.{" "}
        <Link href="/scoring" className="underline">
          How the estimate works
        </Link>
      </p>

      {sections.map((sec) => (
        <section key={sec.s} className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
          <h2 className="mb-3 font-semibold">{sec.s === "RW" ? "Reading and Writing" : "Math"}: by domain</h2>
          <ul className="flex flex-col gap-2">
            {[...sec.domains.entries()]
              .sort(([a], [b]) => BLUEPRINT[sec.s].findIndex((x) => x.domain === a) - BLUEPRINT[sec.s].findIndex((x) => x.domain === b))
              .map(([d, v]) => (
              <li key={d} className="flex items-center justify-between gap-3">
                <span>{DOMAIN_BY_ID.get(d)?.name}</span>
                <span className="flex items-center gap-3">
                  <span className="h-2.5 w-28 rounded-full bg-surface-2 sm:w-44" aria-hidden="true">
                    <span className="block h-full rounded-full bg-series-rw" style={{ width: `${Math.round((v.correct / v.total) * 100)}%` }} />
                  </span>
                  <span className="w-16 text-right text-sm tabular-nums">
                    {v.correct}/{v.total}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {sec.mods.map((m) => (
              <p key={m.id} className="text-sm text-muted">
                Module {m.stage}
                {m.stage === 2 ? ` (${m.level === "hard" ? "harder" : "easier"})` : ""}: {m.correct_count}/{m.qs.length} correct · {fmtTime(m.time)} used
              </p>
            ))}
          </div>
        </section>
      ))}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Review every question</h2>
        {modules.map((m) => (
          <div key={m.id} className="rounded-2xl border border-line bg-surface">
            <h3 className="border-b border-line px-4 py-2 font-medium">
              {m.section === "RW" ? "Reading and Writing" : "Math"} · Module {m.stage}
            </h3>
            <ol className="divide-y divide-line">
              {m.qs.map((q, i) => {
                const a = m.answers.get(q.id);
                const status = !a?.response ? "Omitted" : a.correct ? "Correct" : "Incorrect";
                const color = !a?.response ? "text-muted" : a.correct ? "text-jade" : "text-rose";
                const key = q.type === "spr" ? q.answer.split("|").join(" or ") : q.answer;
                return (
                  <li key={q.id}>
                    <details className="group">
                      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 px-4 py-2.5 hover:bg-surface-2">
                        <span className="flex items-center gap-2 text-sm">
                          <span className="w-6 text-muted tabular-nums">{i + 1}.</span>
                          <span className={`font-medium ${color}`}>{status}</span>
                          <span className="text-muted">{SKILL_BY_ID.get(q.skill_id)?.name}</span>
                          <DifficultyBadge d={q.difficulty} />
                          {a?.flagged ? <span className="text-xs text-rose">Marked</span> : null}
                        </span>
                        <span className="text-sm text-muted tabular-nums">
                          You: {a?.response || "—"} · Answer: {key} · {fmtTime(a?.time_ms ?? 0)}
                        </span>
                      </summary>
                      <div className="flex flex-col gap-3 border-t border-line bg-bg px-4 py-4">
                        {q.passage_md && (
                          <div className="reading">
                            <Md>{q.passage_md}</Md>
                          </div>
                        )}
                        <Md className={q.section === "RW" ? "reading" : ""}>{q.stem_md}</Md>
                        {q.choices && (
                          <ul className="flex flex-col gap-1">
                            {q.choices.map((c, ci) => {
                              const L = "ABCD"[ci];
                              return (
                                <li key={L} className={`flex gap-2 rounded-lg px-2 py-1 ${L === q.answer ? "bg-jade-soft" : L === a?.response ? "bg-rose-soft" : ""}`}>
                                  <span className="font-bold">{L}.</span>
                                  <MdInline>{c}</MdInline>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                        <div>
                          <h4 className="font-semibold">Explanation</h4>
                          <Md>{q.explanation_md}</Md>
                        </div>
                        {q.distractor_notes && (
                          <ul className="flex flex-col gap-1 text-sm">
                            {Object.entries(q.distractor_notes)
                              .sort(([x], [y]) => x.localeCompare(y))
                              .map(([L, note]) => (
                                <li key={L} className="flex gap-2">
                                  <span className="font-bold text-muted">{L}.</span>
                                  <Md className="flex-1">{note}</Md>
                                </li>
                              ))}
                          </ul>
                        )}
                        {a?.note && (
                          <p className="text-sm text-muted">
                            <span className="font-medium">Your note:</span> {a.note}
                          </p>
                        )}
                      </div>
                    </details>
                  </li>
                );
              })}
            </ol>
          </div>
        ))}
      </section>
    </div>
  );
}

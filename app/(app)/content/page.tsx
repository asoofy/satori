import Link from "next/link";
import { aiLabel } from "@/lib/ai";
import { reviewQueue } from "@/lib/ai-generator";
import { getDb } from "@/lib/db";
import { CSV_COLUMNS } from "@/lib/import";
import { DOMAINS } from "@/lib/taxonomy";
import { GenerateForm, ImportForm, OpenSatForm } from "./ContentForms";

export const metadata = { title: "Content tools" };

export default function ContentPage() {
  const db = getDb();
  const provider = aiLabel();
  const pending = reviewQueue(db).length;
  const bySource = db
    .prepare(
      `SELECT CASE WHEN generator_id IS NOT NULL THEN 'Math generators'
                   WHEN source LIKE 'satori-%' THEN 'Hand-written'
                   WHEN source LIKE 'ai:%' THEN 'AI-generated (approved)'
                   WHEN source = 'opensat' THEN 'OpenSAT (local only)'
                   ELSE 'Imported' END AS origin, COUNT(*) AS n
       FROM questions WHERE status = 'active' GROUP BY origin ORDER BY n DESC`,
    )
    .all() as { origin: string; n: number }[];
  const skills = DOMAINS.map((d) => ({ label: `${d.section === "RW" ? "R&W" : "Math"} · ${d.name}`, skills: d.skills.map((s) => ({ id: s.id, name: s.name })) }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Content tools</h1>
        <p className="text-muted">Grow the question bank: generate with AI, import sets you have rights to, or export what you have.</p>
      </div>

      <section className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
        <h2 className="mb-2 font-semibold">Question bank</h2>
        <ul className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
          {bySource.map((s) => (
            <li key={s.origin}>
              {s.origin}: <span className="font-semibold tabular-nums">{s.n}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">AI question generator</h2>
          <Link href="/content/review" className="rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-surface-2">
            Review queue ({pending})
          </Link>
        </div>
        {provider ? (
          <>
            <p className="mb-3 text-sm text-muted">
              Using <code>{provider}</code>. Each question is solved again by a second request that never sees the answer key. Only questions it agrees on, and that
              aren’t near-duplicates of existing ones, reach the review queue. Nothing enters the bank until you approve it.
            </p>
            <GenerateForm skills={skills} />
          </>
        ) : (
          <div className="text-sm text-muted">
            <p>No AI provider is configured, so the generator is off. Everything else in Satori works without it. To turn it on, add one of these to <code>.env.local</code> and restart:</p>
            <pre className="mt-2 overflow-x-auto rounded-lg bg-surface-2 p-3 text-xs">{`# Anthropic (Claude)
ANTHROPIC_API_KEY=sk-ant-...

# or a free local model with Ollama
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5:14b`}</pre>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
        <h2 className="mb-1 font-semibold">Import questions</h2>
        <p className="mb-3 text-sm text-muted">
          Upload JSON (the same format as <code>content/questions/*.json</code>, or a plain array) or CSV. Validate first to get an error report, then import.
          Only import questions you have the rights to use.
        </p>
        <details className="mb-3 text-sm">
          <summary className="cursor-pointer text-muted">CSV columns</summary>
          <p className="mt-2">
            <code className="break-words">{CSV_COLUMNS.join(", ")}</code>
          </p>
          <p className="mt-1 text-muted">
            Required: id, section (RW or MATH), skill (a skill id, e.g. <code>transitions</code>), difficulty (1–3), stem_md, answer, explanation_md. Choices are
            needed for multiple-choice; type is <code>mcq</code> or <code>spr</code>; tags are separated by semicolons.
          </p>
        </details>
        <ImportForm />
      </section>

      <section className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
        <h2 className="mb-1 font-semibold">Export</h2>
        <p className="mb-3 text-sm text-muted">Download the bank as JSON in the content-file format. By default only Satori’s own questions are included (not imported sets).</p>
        <div className="flex flex-wrap gap-2">
          <a href="/api/export" className="rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-surface-2">
            Satori questions (all)
          </a>
          <a href="/api/export?origin=original" className="rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-surface-2">
            Hand-written and AI only
          </a>
          <a href="/api/export?imported=1" className="rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-surface-2">
            Everything, including imports
          </a>
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
        <h2 className="mb-1 font-semibold">OpenSAT (optional)</h2>
        <p className="mb-3 text-sm text-muted">
          Pull questions from the public{" "}
          <a href="https://github.com/Anas099X/OpenSAT" className="underline" target="_blank" rel="noreferrer">
            OpenSAT
          </a>{" "}
          API into your local database. The project doesn’t state a license or where its questions come from, so they’re stored with source “opensat” and an
          unknown license, kept only on this computer, and left out of exports by default. Skills are guessed from the question wording and difficulty is set to
          medium.
        </p>
        <OpenSatForm />
      </section>
    </div>
  );
}

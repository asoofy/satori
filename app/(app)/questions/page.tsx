import Link from "next/link";
import { practiceFiltered, practiceOne } from "@/app/actions";
import { DifficultyBadge } from "@/components/PracticePlayer";
import { currentProfile } from "@/lib/current";
import { getDb } from "@/lib/db";
import { type BankFilter, listBank } from "@/lib/repo/questions";
import { DOMAIN_BY_ID, SKILL_BY_ID } from "@/lib/taxonomy";
import { FilterBar } from "./FilterBar";

export const metadata = { title: "Question Bank" };

const PAGE_SIZE = 25;

function one(v: string | string[] | undefined): string | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  return s && s.length ? s : undefined;
}

function parseBankFilter(sp: Record<string, string | string[] | undefined>): BankFilter {
  const diff = Number(one(sp.difficulty));
  const section = one(sp.section);
  const filter: BankFilter = {
    section: section === "RW" || section === "MATH" ? section : undefined,
    domain: one(sp.domain),
    skill: one(sp.skill),
    difficulty: diff === 1 || diff === 2 || diff === 3 ? diff : undefined,
    status: (["unanswered", "incorrect", "correct", "saved"] as const).find((s) => s === one(sp.status)),
    origin: (["original", "generated"] as const).find((s) => s === one(sp.origin)),
    q: one(sp.q),
  };
  // A skill implies its domain and section; a domain implies its section.
  if (filter.skill) {
    const s = SKILL_BY_ID.get(filter.skill);
    if (s) {
      filter.domain = s.domain;
      filter.section = s.section;
    }
  } else if (filter.domain) {
    const d = DOMAIN_BY_ID.get(filter.domain);
    if (d) filter.section = d.section;
  }
  return filter;
}

export default async function QuestionBankPage({ searchParams }: PageProps<"/questions">) {
  const sp = await searchParams;
  const filter = parseBankFilter(sp);
  const page = Math.max(1, Number(one(sp.page)) || 1);
  const { profile } = await currentProfile();
  const { items, total } = listBank(getDb(), profile.id, filter, page, PAGE_SIZE);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const href = (p: number) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(filter)) if (v !== undefined && v !== "") params.set(k, String(v));
    if (p > 1) params.set("page", String(p));
    const s = params.toString();
    return s ? `/questions?${s}` : "/questions";
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Question Bank</h1>
          <p className="text-muted">
            {total.toLocaleString()} question{total === 1 ? "" : "s"} match your filters.
          </p>
        </div>
        <form action={practiceFiltered} className="flex items-center gap-2">
          {Object.entries(filter).map(([k, v]) => (v !== undefined ? <input key={k} type="hidden" name={k} value={String(v)} /> : null))}
          <input type="hidden" name="title" value="Practice from the bank" />
          <label className="text-sm text-muted" htmlFor="count">
            Practice
          </label>
          <select id="count" name="count" defaultValue="10" className="rounded-lg border border-line bg-surface px-2 py-2 text-sm">
            {[5, 10, 20, 30].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <button disabled={total === 0} className="rounded-xl bg-accent px-4 py-2 font-semibold text-accent-ink hover:opacity-90 disabled:opacity-50">
            Start
          </button>
        </form>
      </div>

      <FilterBar filter={filter} />

      {sp.empty && (
        <p role="status" className="rounded-lg bg-gold-soft px-3 py-2 text-sm text-gold">
          No questions matched those filters.
        </p>
      )}

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line p-10 text-center text-muted">Nothing here yet. Try loosening the filters.</div>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((it) => (
            <li key={it.id} className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-2 text-xs">
                  <StatusDot status={it.status} />
                  <span className="rounded-full bg-surface-2 px-2 py-0.5 font-medium">{it.section === "RW" ? "R&W" : "Math"}</span>
                  <span className="text-muted">{SKILL_BY_ID.get(it.skill_id)?.name}</span>
                  <DifficultyBadge d={it.difficulty} />
                  {it.type === "spr" && <span className="rounded-full bg-surface-2 px-2 py-0.5">Grid-in</span>}
                  {it.generated && <span className="rounded-full bg-indigo-soft px-2 py-0.5 text-indigo">Generated</span>}
                  {it.saved && <span className="text-gold">★ Saved</span>}
                </div>
                <p className="line-clamp-2 text-sm">{it.preview}</p>
              </div>
              <form action={practiceOne.bind(null, it.id)}>
                <button className="w-full rounded-lg border border-line px-3 py-1.5 text-sm font-medium hover:bg-surface-2 sm:w-auto">
                  {it.status === "unanswered" ? "Try it" : "Try again"}
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      {pages > 1 && (
        <nav aria-label="Pages" className="flex items-center justify-center gap-2">
          {page > 1 ? (
            <Link href={href(page - 1)} className="rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-surface-2">
              ← Previous
            </Link>
          ) : (
            <span className="px-3 py-1.5 text-sm text-muted opacity-50">← Previous</span>
          )}
          <span className="text-sm text-muted tabular-nums">
            Page {page} of {pages}
          </span>
          {page < pages ? (
            <Link href={href(page + 1)} className="rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-surface-2">
              Next →
            </Link>
          ) : (
            <span className="px-3 py-1.5 text-sm text-muted opacity-50">Next →</span>
          )}
        </nav>
      )}
    </div>
  );
}

function StatusDot({ status }: { status: "unanswered" | "correct" | "incorrect" }) {
  const map = {
    unanswered: ["bg-line", "Not answered"],
    correct: ["bg-jade", "Answered correctly"],
    incorrect: ["bg-rose", "Answered incorrectly"],
  } as const;
  return (
    <span className="flex items-center gap-1 text-muted" title={map[status][1]}>
      <span className={`inline-block h-2.5 w-2.5 rounded-full ${map[status][0]}`} aria-hidden="true" />
      <span className="sr-only">{map[status][1]}</span>
    </span>
  );
}

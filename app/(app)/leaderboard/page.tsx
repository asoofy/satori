import Link from "next/link";
import { currentProfile } from "@/lib/current";
import { today, weekStart } from "@/lib/dates";
import { getDb } from "@/lib/db";
import { leaderboard, LEAGUES } from "@/lib/profiles";

export const metadata = { title: "Leaderboard" };

export default async function LeaderboardPage() {
  const { profile } = await currentProfile();
  const t = today();
  const rows = leaderboard(getDb(), t);
  const monday = new Date(weekStart(t) + "T00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Leaderboard</h1>
        <p className="text-muted">Profiles on this computer, ranked by XP earned this week (since Monday, {monday}). Leagues reset every Monday.</p>
      </div>

      <ul className="flex flex-wrap gap-2 text-sm" aria-label="Leagues">
        {LEAGUES.map((l) => (
          <li key={l.id} className="rounded-full border border-line bg-surface px-3 py-1">
            <span aria-hidden="true">{l.emoji}</span> {l.name} · {l.min}+ XP
          </li>
        ))}
      </ul>

      <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead>
            <tr className="border-b border-line text-muted">
              <th className="px-4 py-2 font-medium">#</th>
              <th className="px-4 py-2 font-medium">Profile</th>
              <th className="px-4 py-2 font-medium">League</th>
              <th className="px-4 py-2 text-right font-medium">XP this week</th>
              <th className="px-4 py-2 text-right font-medium">Answered this week</th>
              <th className="px-4 py-2 text-right font-medium">Streak</th>
              <th className="px-4 py-2 text-right font-medium">Best rush</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id} className={`border-t border-line ${r.id === profile.id ? "bg-accent-soft" : ""}`}>
                <td className="px-4 py-2.5 font-semibold tabular-nums">{i + 1}</td>
                <td className="px-4 py-2.5">
                  <span aria-hidden="true">{r.avatar}</span> {r.name}
                  {r.id === profile.id && <span className="ml-1 text-xs text-muted">(you)</span>}
                </td>
                <td className="px-4 py-2.5">
                  <span aria-hidden="true">{r.league.emoji}</span> {r.league.name}
                </td>
                <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{r.weeklyXp.toLocaleString()}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{r.weeklyAnswers}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{r.streak} 🔥</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{r.bestRush}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 1 && (
        <p className="text-sm text-muted">
          It’s just you so far. Add profiles for friends or siblings in{" "}
          <Link href="/settings" className="text-accent underline">
            Settings
          </Link>
          .
        </p>
      )}
      <p className="text-xs text-muted">XP: 10 per correct answer, 2 per attempt that missed.</p>
    </div>
  );
}

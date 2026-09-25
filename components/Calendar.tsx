"use client";

import { useState } from "react";

export interface CalendarDay {
  date: string;
  status: "planned" | "done" | "missed";
  title: string;
}

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

function iso(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/**
 * Month calendar. Filled green = studied that day; ring = planned study day;
 * orange dot = the test. Arrows move between months.
 */
export function Calendar({
  today,
  activeDays,
  plan,
  testDate,
}: {
  today: string;
  activeDays: string[];
  plan: CalendarDay[];
  testDate: string | null;
}) {
  const [ty, tm] = today.split("-").map(Number);
  const [cursor, setCursor] = useState({ y: ty, m: tm - 1 });
  const active = new Set(activeDays);
  const planByDate = new Map(plan.map((p) => [p.date, p]));
  const first = new Date(cursor.y, cursor.m, 1);
  const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(first.getDay()).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const label = first.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const move = (delta: number) =>
    setCursor(({ y, m }) => {
      const d = new Date(y, m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });

  return (
    <div className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <button onClick={() => move(-1)} className="rounded-md px-2 py-1 hover:bg-surface-2" aria-label="Previous month">
          ←
        </button>
        <h2 className="font-semibold" aria-live="polite">
          {label}
        </h2>
        <button onClick={() => move(1)} className="rounded-md px-2 py-1 hover:bg-surface-2" aria-label="Next month">
          →
        </button>
      </div>
      <table className="w-full table-fixed text-center text-sm" role="grid" aria-label={label}>
        <thead>
          <tr>
            {WEEKDAYS.map((d, i) => (
              <th key={i} className="pb-1 text-xs font-medium text-muted" scope="col">
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: cells.length / 7 }, (_, row) => (
            <tr key={row}>
              {cells.slice(row * 7, row * 7 + 7).map((day, i) => {
                if (!day) return <td key={i} />;
                const date = iso(cursor.y, cursor.m, day);
                const p = planByDate.get(date);
                const studied = active.has(date);
                const isToday = date === today;
                const isTest = date === testDate;
                const desc = [
                  studied ? "studied" : null,
                  p ? `plan: ${p.title} (${p.status})` : null,
                  isTest ? "test day" : null,
                  isToday ? "today" : null,
                ]
                  .filter(Boolean)
                  .join(", ");
                return (
                  <td key={i} className="p-0.5">
                    <div
                      title={desc || undefined}
                      aria-label={`${date}${desc ? `: ${desc}` : ""}`}
                      className={`relative mx-auto flex h-8 w-8 items-center justify-center rounded-full tabular-nums ${
                        studied
                          ? "bg-jade font-semibold text-white dark:text-bg"
                          : p && p.status === "planned"
                            ? "border-2 border-accent/60"
                            : p && p.status === "missed"
                              ? "text-muted line-through"
                              : ""
                      } ${isToday ? "outline-2 outline-offset-2 outline-ink" : ""}`}
                    >
                      {day}
                      {isTest && <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-accent ring-2 ring-surface" aria-hidden="true" />}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        <li className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full bg-jade" aria-hidden="true" /> Studied
        </li>
        <li className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full border-2 border-accent/60" aria-hidden="true" /> Planned
        </li>
        <li className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-accent" aria-hidden="true" /> Test day
        </li>
      </ul>
    </div>
  );
}

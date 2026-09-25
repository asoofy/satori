"use client";

import { useEffect, useRef, useState } from "react";

/** Width of a container, tracked with ResizeObserver (charts draw at real pixel size). */
function useWidth<T extends HTMLElement>(fallback = 600) {
  const ref = useRef<T>(null);
  const [w, setW] = useState(fallback);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver((entries) => setW(Math.max(260, Math.floor(entries[0].contentRect.width))));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

function niceMax(v: number): number {
  if (v <= 5) return 5;
  const pow = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * pow >= v) return m * pow;
  return 10 * pow;
}

export interface TrendSeries {
  key: string;
  label: string;
  color: string; // CSS color, e.g. var(--series-rw)
  values: (number | null)[]; // 0..1 accuracy per x, null = no answers that week
  counts: number[];
}

/** Weekly accuracy lines (0–100%) with a legend, end labels, crosshair and tooltip. */
export function TrendChart({ xLabels, series, title }: { xLabels: string[]; series: TrendSeries[]; title: string }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const H = 240;
  const m = { top: 12, right: 64, bottom: 28, left: 40 };
  const iw = width - m.left - m.right;
  const ih = H - m.top - m.bottom;
  const x = (i: number) => m.left + (xLabels.length <= 1 ? iw / 2 : (i / (xLabels.length - 1)) * iw);
  const y = (v: number) => m.top + (1 - v) * ih;

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left;
    const i = xLabels.length <= 1 ? 0 : Math.round((px / r.width) * (xLabels.length - 1));
    setHover(Math.max(0, Math.min(xLabels.length - 1, i)));
  };

  // Path segments skip weeks without data.
  const path = (vals: (number | null)[]) => {
    let d = "";
    let pen = false;
    vals.forEach((v, i) => {
      if (v === null) {
        pen = false;
        return;
      }
      d += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
      pen = true;
    });
    return d;
  };

  const lastIdx = (vals: (number | null)[]) => {
    for (let i = vals.length - 1; i >= 0; i--) if (vals[i] !== null) return i;
    return -1;
  };
  const ends = series.map((s) => ({ s, i: lastIdx(s.values) })).filter((e) => e.i >= 0);
  // Only direct-label line ends when they don't collide.
  const labelEnds = ends.length < 2 || Math.abs(y(ends[0].s.values[ends[0].i]!) - y(ends[1].s.values[ends[1].i]!)) > 16;

  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="sr-only">{title}</figcaption>
      <ul className="flex flex-wrap gap-4 text-sm text-muted" aria-label="Legend">
        {series.map((s) => (
          <li key={s.key} className="flex items-center gap-2">
            <span className="inline-block h-0.5 w-5 rounded" style={{ background: s.color }} aria-hidden="true" />
            {s.label}
          </li>
        ))}
      </ul>
      <div ref={ref} className="relative w-full">
        <svg width={width} height={H} role="img" aria-label={title} className="block overflow-visible">
          {[0, 0.25, 0.5, 0.75, 1].map((t) => (
            <g key={t}>
              <line x1={m.left} x2={m.left + iw} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth={1} />
              <text x={m.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-muted text-[11px] tabular-nums">
                {Math.round(t * 100)}%
              </text>
            </g>
          ))}
          {xLabels.map((l, i) =>
            // Count back from the latest week so the most recent label is always shown and never crowded.
            (xLabels.length - 1 - i) % Math.max(1, Math.ceil(xLabels.length / (width < 480 ? 4 : 6))) === 0 ? (
              <text key={l} x={x(i)} y={H - 8} textAnchor="middle" className="fill-muted text-[11px]">
                {l}
              </text>
            ) : null,
          )}
          {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={m.top} y2={m.top + ih} stroke="var(--muted)" strokeWidth={1} />}
          {series.map((s) => (
            <g key={s.key}>
              <path d={path(s.values)} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              {s.values.map((v, i) =>
                v === null ? null : (
                  <circle
                    key={i}
                    cx={x(i)}
                    cy={y(v)}
                    r={hover === i ? 5 : 4}
                    fill={s.color}
                    stroke="var(--surface)"
                    strokeWidth={2}
                  />
                ),
              )}
            </g>
          ))}
          {labelEnds &&
            ends.map(({ s, i }) => (
              <text key={s.key} x={x(i) + 10} y={y(s.values[i]!)} dy="0.32em" className="fill-ink text-[12px] font-medium">
                {s.label} {Math.round(s.values[i]! * 100)}%
              </text>
            ))}
          <rect
            x={m.left}
            y={m.top}
            width={iw}
            height={ih}
            fill="transparent"
            onPointerMove={onMove}
            onPointerLeave={() => setHover(null)}
          />
        </svg>
        {hover !== null && (
          <div
            className="pointer-events-none absolute top-2 z-10 min-w-40 rounded-lg border border-line bg-surface px-3 py-2 text-sm shadow-md"
            style={{ left: Math.min(x(hover) + 12, width - 170) }}
            role="status"
          >
            <div className="mb-1 font-semibold">Week of {xLabels[hover]}</div>
            {series.map((s) => (
              <div key={s.key} className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 rounded-full" style={{ background: s.color }} aria-hidden="true" />
                  {s.label}
                </span>
                <span className="tabular-nums">
                  {s.values[hover] === null ? "—" : `${Math.round(s.values[hover]! * 100)}%`}{" "}
                  <span className="text-muted">({s.counts[hover]})</span>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer text-muted">Show as table</summary>
        <div className="overflow-x-auto">
          <table className="mt-2 w-full text-left tabular-nums">
            <thead>
              <tr className="text-muted">
                <th className="py-1 pr-4 font-medium">Week of</th>
                {series.map((s) => (
                  <th key={s.key} className="py-1 pr-4 font-medium">
                    {s.label} (answers)
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {xLabels.map((l, i) => (
                <tr key={l} className="border-t border-line">
                  <td className="py-1 pr-4">{l}</td>
                  {series.map((s) => (
                    <td key={s.key} className="py-1 pr-4">
                      {s.values[i] === null ? "—" : `${Math.round(s.values[i]! * 100)}%`} ({s.counts[i]})
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}

/** Daily question counts as columns, with per-bar hover tooltips. */
export function ActivityChart({ days, title }: { days: { date: string; label: string; attempts: number; correct: number }[]; title: string }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const H = 180;
  const m = { top: 10, right: 8, bottom: 26, left: 32 };
  const iw = width - m.left - m.right;
  const ih = H - m.top - m.bottom;
  const max = niceMax(Math.max(1, ...days.map((d) => d.attempts)));
  const band = iw / days.length;
  const bw = Math.min(24, Math.max(2, band - 2));
  const y = (v: number) => m.top + (1 - v / max) * ih;

  const bar = (i: number, v: number) => {
    const x0 = m.left + i * band + (band - bw) / 2;
    const top = y(v);
    const base = m.top + ih;
    const r = Math.min(4, bw / 2, base - top);
    if (v === 0) return "";
    return `M${x0},${base}V${top + r}Q${x0},${top} ${x0 + r},${top}H${x0 + bw - r}Q${x0 + bw},${top} ${x0 + bw},${top + r}V${base}Z`;
  };

  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="sr-only">{title}</figcaption>
      <div ref={ref} className="relative w-full">
        <svg width={width} height={H} role="img" aria-label={title} className="block">
          {[0, max / 2, max].map((t) => (
            <g key={t}>
              <line x1={m.left} x2={m.left + iw} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth={1} />
              <text x={m.left - 6} y={y(t)} dy="0.32em" textAnchor="end" className="fill-muted text-[11px] tabular-nums">
                {t}
              </text>
            </g>
          ))}
          {days.map((d, i) => (
            <g key={d.date}>
              <path d={bar(i, d.attempts)} fill="var(--series-rw)" opacity={hover === null || hover === i ? 1 : 0.55} />
              <rect
                x={m.left + i * band}
                y={m.top}
                width={band}
                height={ih}
                fill="transparent"
                onPointerEnter={() => setHover(i)}
                onPointerLeave={() => setHover(null)}
              />
            </g>
          ))}
          {days.map((d, i) =>
            (days.length - 1 - i) % 7 === 0 ? (
              <text key={d.date} x={m.left + i * band + band / 2} y={H - 8} textAnchor="middle" className="fill-muted text-[11px]">
                {d.label}
              </text>
            ) : null,
          )}
        </svg>
        {hover !== null && (
          <div
            className="pointer-events-none absolute top-0 z-10 rounded-lg border border-line bg-surface px-3 py-2 text-sm shadow-md"
            style={{ left: Math.min(m.left + hover * band + band + 6, width - 150) }}
            role="status"
          >
            <div className="font-semibold">{days[hover].label}</div>
            <div className="tabular-nums">
              {days[hover].attempts} answered · {days[hover].attempts ? Math.round((days[hover].correct / days[hover].attempts) * 100) : 0}% correct
            </div>
          </div>
        )}
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer text-muted">Show as table</summary>
        <div className="max-h-60 overflow-auto">
          <table className="mt-2 w-full text-left tabular-nums">
            <thead>
              <tr className="text-muted">
                <th className="py-1 pr-4 font-medium">Day</th>
                <th className="py-1 pr-4 font-medium">Answered</th>
                <th className="py-1 pr-4 font-medium">Correct</th>
              </tr>
            </thead>
            <tbody>
              {days
                .filter((d) => d.attempts > 0)
                .map((d) => (
                  <tr key={d.date} className="border-t border-line">
                    <td className="py-1 pr-4">{d.label}</td>
                    <td className="py-1 pr-4">{d.attempts}</td>
                    <td className="py-1 pr-4">{d.correct}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}

/** Horizontal accuracy bar used inside tables (single series, value labeled at the tip). */
export function AccuracyBar({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex items-center gap-2" title={label}>
      <div className="h-2.5 w-24 shrink-0 rounded-full bg-surface-2 sm:w-40" aria-hidden="true">
        <div className="h-full rounded-full bg-series-rw" style={{ width: `${Math.round(value * 100)}%` }} />
      </div>
      <span className="w-10 shrink-0 text-right text-sm tabular-nums">{Math.round(value * 100)}%</span>
    </div>
  );
}

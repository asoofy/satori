"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { setTheme } from "@/app/actions";
import { Logo } from "./Logo";

export interface NavItem {
  href: string;
  label: string;
  icon: keyof typeof ICONS;
  group?: string;
  /** Only shown when an AI provider is configured. */
  requiresAi?: boolean;
}

const ICONS = {
  home: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
  bank: "M4 5h16M4 12h16M4 19h10",
  bookmark: "M6 3h12v18l-6-4-6 4z",
  plan: "M7 3v3M17 3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z",
  path: "M4 20h5a3.5 3.5 0 0 0 0-7H9a3.5 3.5 0 0 1 0-7h11M20 6l-3-3M20 6l-3 3",
  chart: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  test: "M9 3h6l1 3h3v15H5V6h3zM9 12l2 2 4-4",
  bolt: "M13 2 4 14h7l-1 8 9-12h-7z",
  mountain: "M3 20 9.5 8l4 7 2.5-4L21 20z",
  book: "M4 4h6a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4zM20 4h-6a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h7z",
  sparkle: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z",
  cards: "M4 7h12v13H4zM8 4h12v13",
  chat: "M4 5h16v11H8l-4 4z",
  trophy: "M8 4h8v5a4 4 0 0 1-8 0zM5 5h3v3a3 3 0 0 1-3-3zM19 5h-3v3a3 3 0 0 0 3-3zM12 13v4M8 21h8",
  gear: "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM19.4 13a7.9 7.9 0 0 0 0-2l2-1.6-2-3.4-2.4 1a8 8 0 0 0-1.7-1L15 3.5h-4l-.3 2.5a8 8 0 0 0-1.7 1l-2.4-1-2 3.4 2 1.6a7.9 7.9 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a8 8 0 0 0 1.7 1l.3 2.5h4l.3-2.5a8 8 0 0 0 1.7-1l2.4 1 2-3.4z",
  pencil: "M4 20h4L19 9l-4-4L4 16zM14 6l4 4",
} as const;

export function Icon({ name, className = "h-5 w-5" }: { name: keyof typeof ICONS; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  );
}

export function Shell({
  nav,
  profileName,
  theme,
  checklist,
  children,
}: {
  nav: NavItem[];
  profileName: string;
  theme: "system" | "light" | "dark";
  checklist?: { done: number; total: number };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const drawer = useRef<HTMLElement>(null);

  // Mobile drawer: move focus into it when it opens, and close on Escape.
  useEffect(() => {
    if (!open) return;
    drawer.current?.querySelector<HTMLElement>("a,button")?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/"));

  const groups: { name: string | undefined; items: NavItem[] }[] = [];
  for (const item of nav) {
    const g = groups.find((x) => x.name === item.group);
    if (g) g.items.push(item);
    else groups.push({ name: item.group, items: [item] });
  }

  const sidebar = (
    <nav aria-label="Main" className="flex h-full flex-col gap-1 p-3">
      <Link href="/" onClick={() => setOpen(false)} className="mb-3 flex items-center gap-2 rounded-lg px-2 py-1.5 text-accent">
        <Logo size={30} />
        <span className="text-xl font-bold tracking-tight text-ink">Satori</span>
      </Link>
      {groups.map((g) => (
        <div key={g.name ?? "main"} className="mb-1">
          {g.name && <div className="mt-3 mb-1 px-3 text-[11px] font-semibold tracking-widest text-muted uppercase">{g.name}</div>}
          <ul className="flex flex-col gap-0.5">
            {g.items.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isActive(item.href) ? "page" : undefined}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-[15px] transition-colors ${
                    isActive(item.href) ? "bg-accent-soft font-semibold text-accent" : "text-ink/80 hover:bg-surface-2"
                  }`}
                >
                  <Icon name={item.icon} />
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
      {checklist && checklist.done < checklist.total && (
        <Link
          href="/#getting-started"
          onClick={() => setOpen(false)}
          className="mt-auto flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2 text-sm font-medium hover:bg-accent-soft"
        >
          <span>Getting started</span>
          <span className="tabular-nums text-muted">
            {checklist.done}/{checklist.total}
          </span>
        </Link>
      )}
      <div className={`${checklist && checklist.done < checklist.total ? "mt-2" : "mt-auto"} flex items-center justify-between gap-2 border-t border-line px-2 pt-3`}>
        <span className="truncate text-sm font-medium" title="Active profile">
          {profileName}
        </span>
        <ThemeToggle theme={theme} />
      </div>
    </nav>
  );

  return (
    <div className="flex min-h-dvh">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-surface focus:px-3 focus:py-2">
        Skip to content
      </a>
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 overflow-y-auto border-r border-line bg-surface md:block">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <button className="absolute inset-0 bg-black/40" aria-label="Close menu" onClick={() => setOpen(false)} />
          <aside ref={drawer} className="absolute inset-y-0 left-0 w-72 max-w-[85%] overflow-y-auto border-r border-line bg-surface">{sidebar}</aside>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-surface/90 px-4 py-2.5 backdrop-blur md:hidden">
          <button onClick={() => setOpen(true)} aria-label="Open menu" className="rounded-md p-1.5 hover:bg-surface-2">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <Link href="/" className="flex items-center gap-2 text-accent">
            <Logo size={24} />
            <span className="font-bold text-ink">Satori</span>
          </Link>
        </header>
        <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-8 md:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}

export function ThemeToggle({ theme }: { theme: "system" | "light" | "dark" }) {
  const [pending, start] = useTransition();
  const order = ["system", "light", "dark"] as const;
  const next = order[(order.indexOf(theme) + 1) % order.length];
  const label = { system: "Theme: system", light: "Theme: light", dark: "Theme: dark" }[theme];
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          applyTheme(next);
          await setTheme(next);
        })
      }
      className="flex items-center gap-1.5 rounded-md border border-line px-2 py-1 text-xs text-muted hover:bg-surface-2"
      title={`${label} — click for ${next}`}
      aria-label={`${label}. Switch to ${next}.`}
    >
      {theme === "dark" ? "🌙" : theme === "light" ? "☀️" : "🖥️"}
      <span className="capitalize">{theme}</span>
    </button>
  );
}

function applyTheme(theme: "system" | "light" | "dark") {
  const dark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document.documentElement.dataset.themePref = theme;
}

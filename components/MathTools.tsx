"use client";

import { useEffect, useRef, useState } from "react";
import { Md } from "./Md";

/**
 * Desmos's documented demo API key, used in their public API examples. Set
 * NEXT_PUBLIC_DESMOS_API_KEY to your own key for anything beyond local use.
 */
const DESMOS_DEMO_KEY = "dcb31709b452b1cf9dc26972add0fda6"; // gitleaks:allow (public demo key, not a secret)
const DESMOS_KEY = process.env.NEXT_PUBLIC_DESMOS_API_KEY || DESMOS_DEMO_KEY;
const DESMOS_SRC = `https://www.desmos.com/api/v1.11/calculator.js?apiKey=${DESMOS_KEY}`;

type DesmosGlobal = {
  GraphingCalculator: (el: HTMLElement, opts: Record<string, unknown>) => { destroy: () => void; resize: () => void };
};

let desmosPromise: Promise<DesmosGlobal> | null = null;
function loadDesmos(): Promise<DesmosGlobal> {
  const w = window as unknown as { Desmos?: DesmosGlobal };
  if (w.Desmos) return Promise.resolve(w.Desmos);
  if (!desmosPromise) {
    desmosPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = DESMOS_SRC;
      s.async = true;
      s.onload = () => (w.Desmos ? resolve(w.Desmos) : reject(new Error("Desmos did not load")));
      s.onerror = () => {
        desmosPromise = null;
        reject(new Error("network"));
      };
      document.head.appendChild(s);
    });
  }
  return desmosPromise;
}

function Calculator({ visible }: { visible: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const calc = useRef<ReturnType<DesmosGlobal["GraphingCalculator"]> | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    loadDesmos()
      .then((D) => {
        if (cancelled || !ref.current) return;
        calc.current = D.GraphingCalculator(ref.current, { keypad: true, expressions: true, settingsMenu: false, border: false });
        setStatus("ready");
      })
      .catch(() => !cancelled && setStatus("error"));
    return () => {
      cancelled = true;
      calc.current?.destroy();
      calc.current = null;
    };
  }, [attempt]);

  useEffect(() => {
    if (visible) calc.current?.resize();
  }, [visible]);

  return (
    <div className="relative h-full min-h-[320px]">
      <div ref={ref} className="absolute inset-0" />
      {status === "loading" && <p className="p-4 text-sm text-muted">Loading the Desmos calculator…</p>}
      {status === "error" && (
        <div className="p-4 text-sm">
          <p className="font-medium">The Desmos calculator couldn’t load.</p>
          <p className="mt-1 text-muted">It is loaded from desmos.com, so it needs an internet connection. Everything else in Satori works offline.</p>
          <button
            onClick={() => {
              setStatus("loading");
              setAttempt((n) => n + 1);
            }}
            className="mt-3 rounded-lg border border-line px-3 py-1.5 hover:bg-surface-2"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  );
}

const REFERENCE = String.raw`
**Area and circumference**

- Circle: $A = \pi r^2$, $\; C = 2\pi r$
- Rectangle: $A = \ell w$
- Triangle: $A = \tfrac{1}{2}bh$

**Right triangles**

- Pythagorean theorem: $a^2 + b^2 = c^2$
- $30^\circ$-$60^\circ$-$90^\circ$: sides $x,\ x\sqrt{3},\ 2x$
- $45^\circ$-$45^\circ$-$90^\circ$: sides $s,\ s,\ s\sqrt{2}$

**Volume**

- Rectangular prism: $V = \ell w h$
- Cylinder: $V = \pi r^2 h$
- Sphere: $V = \tfrac{4}{3}\pi r^3$
- Cone: $V = \tfrac{1}{3}\pi r^2 h$
- Pyramid: $V = \tfrac{1}{3}\ell w h$

**Facts**

- A circle has $360^\circ$, or $2\pi$ radians.
- The angles of a triangle add up to $180^\circ$.
`;

export function MathTools({ open, onClose }: { open: "calculator" | "reference" | null; onClose: () => void }) {
  // Mount the calculator the first time it's opened, then keep it (and its work) around.
  const [calcMounted, setCalcMounted] = useState(false);
  if (open === "calculator" && !calcMounted) setCalcMounted(true);

  if (!open && !calcMounted) return null;
  return (
    <aside
      aria-label={open === "reference" ? "Reference sheet" : "Graphing calculator"}
      hidden={!open}
      data-no-shortcuts
      className="fixed inset-x-0 bottom-0 z-40 flex h-[60dvh] flex-col border-t border-line bg-surface shadow-2xl lg:inset-y-0 lg:right-0 lg:left-auto lg:h-auto lg:w-[440px] lg:border-t-0 lg:border-l"
    >
      <div className="flex items-center justify-between border-b border-line px-4 py-2">
        <h2 className="font-semibold">{open === "reference" ? "Reference sheet" : "Graphing calculator"}</h2>
        <button onClick={onClose} className="rounded-md px-2 py-1 text-sm text-muted hover:bg-surface-2" aria-label="Close panel">
          ✕ Close
        </button>
      </div>
      <div className={`min-h-0 flex-1 ${open === "calculator" ? "" : "hidden"}`}>{calcMounted && <Calculator visible={open === "calculator"} />}</div>
      {open === "reference" && (
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <Md>{REFERENCE}</Md>
          <p className="mt-4 text-xs text-muted">Calculator by Desmos. Formulas summarized for Satori.</p>
        </div>
      )}
    </aside>
  );
}

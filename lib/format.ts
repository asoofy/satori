/** m:ss for a duration in milliseconds. */
export function fmtTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** LaTeX for a typed grid-in answer ("-7/2" → "-\frac{7}{2}"), for the answer preview. */
export function sprTex(text: string): string {
  if (!text.includes("/")) return text;
  const neg = text.startsWith("-");
  const [p, q] = text.replace("-", "").split("/");
  return `${neg ? "-" : ""}\\frac{${p}}{${q}}`;
}

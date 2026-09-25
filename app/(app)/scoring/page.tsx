import fs from "node:fs";
import path from "node:path";
import { Md } from "@/components/Md";

export const metadata = { title: "How scores are estimated" };

export default function ScoringPage() {
  const md = fs.readFileSync(path.join(process.cwd(), "docs", "SCORING.md"), "utf8").replace(/\]\(\.\.\/[^)]*\)/g, "]");
  return (
    <article className="mx-auto max-w-3xl rounded-2xl border border-line bg-surface p-6">
      <Md>{md}</Md>
    </article>
  );
}

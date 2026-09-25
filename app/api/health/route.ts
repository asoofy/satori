import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

/** GET /api/health → 200 when the server can read the database. */
export async function GET() {
  const n = (getDb().prepare("SELECT COUNT(*) AS n FROM questions").get() as { n: number }).n;
  return Response.json({ ok: true, questions: n });
}

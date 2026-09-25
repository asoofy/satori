import { getDb } from "@/lib/db";
import { exportBank } from "@/lib/import";

export const dynamic = "force-dynamic";

/** GET /api/export[?origin=original|generated][&imported=1] → JSON download of the bank. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const originParam = url.searchParams.get("origin");
  const origin = originParam === "original" || originParam === "generated" ? originParam : "all";
  const data = exportBank(getDb(), { origin, includeImported: url.searchParams.get("imported") === "1" });
  const name = `satori-questions-${new Date().toISOString().slice(0, 10)}.json`;
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="${name}"`,
    },
  });
}

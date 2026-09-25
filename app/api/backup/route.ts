import { backupBytes } from "@/lib/backup";

export const dynamic = "force-dynamic";

/** GET /api/backup → a consistent copy of the whole database file. */
export async function GET() {
  const bytes = backupBytes();
  const name = `satori-backup-${new Date().toISOString().slice(0, 10)}.db`;
  return new Response(new Uint8Array(bytes), {
    headers: {
      "content-type": "application/vnd.sqlite3",
      "content-disposition": `attachment; filename="${name}"`,
      "cache-control": "no-store",
    },
  });
}

import { z } from "zod";
import { AiError, getProvider } from "@/lib/ai";
import { currentProfile } from "@/lib/current";
import { getDb } from "@/lib/db";
import { tutorSystem } from "@/lib/tutor";

export const dynamic = "force-dynamic";

const Body = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(8000) }))
    .min(1)
    .max(40),
  questionId: z.string().optional(),
  answered: z.boolean().optional(),
  response: z.string().max(20).optional(),
});

/** POST /api/tutor → streams the tutor's reply as plain text. 404 when AI isn't configured. */
export async function POST(req: Request) {
  // Only Satori's own pages may call this: it spends the owner's AI credits. Requiring JSON forces a
  // CORS preflight for cross-site fetches, and Sec-Fetch-Site rejects cross-site browser requests outright.
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return new Response("Forbidden.", { status: 403 });
  if (!req.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return new Response("Expected application/json.", { status: 415 });
  }
  const provider = getProvider();
  if (!provider) return new Response("The tutor isn't configured.", { status: 404 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return new Response("Bad request.", { status: 400 });
  const { profile } = await currentProfile();
  const { messages, ...ctx } = parsed.data;
  // Conversations must start with the user; keep the most recent turns.
  const recent = messages.slice(-20);
  while (recent.length && recent[0].role !== "user") recent.shift();
  const system = tutorSystem(getDb(), profile.id, profile.name, ctx);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of provider.chat({ system, messages: recent })) controller.enqueue(encoder.encode(chunk));
      } catch (e) {
        controller.enqueue(encoder.encode(`\n\n_${e instanceof AiError ? e.message : "The tutor ran into a problem. Try again."}_`));
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
}

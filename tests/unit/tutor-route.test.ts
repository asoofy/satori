import { beforeAll, describe, expect, it } from "vitest";
import { POST } from "@/app/api/tutor/route";

const body = JSON.stringify({ messages: [{ role: "user", content: "hi" }] });

function post(headers: Record<string, string>) {
  return POST(new Request("http://127.0.0.1:3000/api/tutor", { method: "POST", headers, body }));
}

describe("POST /api/tutor request guard", () => {
  beforeAll(() => {
    // No AI configured, so an allowed request stops at the "not configured" 404.
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OLLAMA_URL;
    delete process.env.OLLAMA_MODEL;
  });

  it("rejects cross-site browser requests", async () => {
    const res = await post({ "content-type": "application/json", "sec-fetch-site": "cross-site" });
    expect(res.status).toBe(403);
    const sameSite = await post({ "content-type": "application/json", "sec-fetch-site": "same-site" });
    expect(sameSite.status).toBe(403);
  });

  it("rejects non-JSON bodies (simple cross-origin POSTs)", async () => {
    expect((await post({ "content-type": "text/plain" })).status).toBe(415);
    expect((await post({})).status).toBe(415);
  });

  it("lets same-origin JSON requests through", async () => {
    const res = await post({ "content-type": "application/json", "sec-fetch-site": "same-origin" });
    expect(res.status).toBe(404);
  });
});

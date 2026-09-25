/**
 * Optional AI provider. Satori works fully without it; AI features are hidden when
 * nothing is configured.
 *
 * - Anthropic: set ANTHROPIC_API_KEY (or ANTHROPIC_AUTH_TOKEN). Model defaults to
 *   claude-opus-5; override with SATORI_AI_MODEL.
 * - Ollama (free, local): set OLLAMA_URL (e.g. http://localhost:11434) and OLLAMA_MODEL.
 */
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AiProvider {
  /** Short label for provenance, e.g. "anthropic:claude-opus-5". */
  readonly id: string;
  /** Ask for a JSON object that matches `schema`. Throws AiError on failure. */
  json<T extends z.ZodType>(opts: { system: string; prompt: string; schema: T; maxTokens?: number }): Promise<z.infer<T>>;
  /** Stream a chat reply as text chunks. */
  chat(opts: { system: string; messages: ChatMessage[]; maxTokens?: number }): AsyncIterable<string>;
}

export class AiError extends Error {}

export function aiConfigured(): boolean {
  return getProvider() !== null;
}

export function aiLabel(): string | null {
  return getProvider()?.id ?? null;
}

let cached: AiProvider | null | undefined;

/** The configured provider, or null when AI is off. */
export function getProvider(): AiProvider | null {
  if (cached !== undefined) return cached;
  if (process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN) cached = new AnthropicProvider(process.env.SATORI_AI_MODEL || "claude-opus-5");
  else if (process.env.OLLAMA_URL && process.env.OLLAMA_MODEL) cached = new OllamaProvider(process.env.OLLAMA_URL, process.env.OLLAMA_MODEL);
  else cached = null;
  return cached;
}

/** For tests: replace the provider. */
export function setProviderForTests(p: AiProvider | null | undefined): void {
  cached = p;
}

class AnthropicProvider implements AiProvider {
  readonly id: string;
  private client = new Anthropic();
  constructor(private model: string) {
    this.id = `anthropic:${model}`;
  }

  async json<T extends z.ZodType>({ system, prompt, schema, maxTokens = 16000 }: { system: string; prompt: string; schema: T; maxTokens?: number }): Promise<z.infer<T>> {
    try {
      const res = await this.client.beta.messages.parse({
        model: this.model,
        max_tokens: maxTokens,
        system,
        messages: [{ role: "user", content: prompt }],
        output_config: { format: betaZodOutputFormat(schema) },
        // If a safety classifier declines, retry server-side on Anthropic's recommended fallback model.
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
      });
      if (res.stop_reason === "refusal") throw new AiError("The model declined this request.");
      if (res.stop_reason === "max_tokens") throw new AiError("The response was cut off (too long). Try a smaller batch.");
      if (!res.parsed_output) throw new AiError("The model returned output that didn't match the expected format.");
      return res.parsed_output as z.infer<T>;
    } catch (e) {
      throw toAiError(e);
    }
  }

  async *chat({ system, messages, maxTokens = 4000 }: { system: string; messages: ChatMessage[]; maxTokens?: number }): AsyncIterable<string> {
    try {
      const stream = this.client.beta.messages.stream({
        model: this.model,
        max_tokens: maxTokens,
        system,
        messages,
        output_config: { effort: "medium" },
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
      });
      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") yield event.delta.text;
      }
      const final = await stream.finalMessage();
      if (final.stop_reason === "refusal") yield "\n\n_(The tutor couldn’t answer that one.)_";
    } catch (e) {
      throw toAiError(e);
    }
  }
}

function toAiError(e: unknown): AiError {
  if (e instanceof AiError) return e;
  if (e instanceof Anthropic.AuthenticationError) return new AiError("The Anthropic API key was rejected. Check ANTHROPIC_API_KEY in .env.local.");
  if (e instanceof Anthropic.RateLimitError) return new AiError("Rate limited by the Anthropic API. Wait a minute and try again.");
  if (e instanceof Anthropic.BadRequestError) return new AiError(`The API rejected the request: ${e.message}`);
  if (e instanceof Anthropic.APIConnectionError) return new AiError("Couldn’t reach the Anthropic API. Check your internet connection.");
  if (e instanceof Anthropic.APIError) return new AiError(`Anthropic API error ${e.status ?? ""}: ${e.message}`);
  return new AiError((e as Error)?.message ?? String(e));
}

class OllamaProvider implements AiProvider {
  readonly id: string;
  constructor(
    private url: string,
    private model: string,
  ) {
    this.id = `ollama:${model}`;
  }

  private async post(body: Record<string, unknown>): Promise<Response> {
    let res: Response;
    try {
      res = await fetch(`${this.url.replace(/\/$/, "")}/api/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model: this.model, ...body }),
      });
    } catch {
      throw new AiError(`Couldn’t reach Ollama at ${this.url}. Is it running?`);
    }
    if (!res.ok) throw new AiError(`Ollama returned ${res.status}: ${await res.text().catch(() => "")}`);
    return res;
  }

  async json<T extends z.ZodType>({ system, prompt, schema }: { system: string; prompt: string; schema: T }): Promise<z.infer<T>> {
    const res = await this.post({
      stream: false,
      format: z.toJSONSchema(schema),
      options: { temperature: 0.4 },
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
    });
    const data = (await res.json()) as { message?: { content?: string } };
    let parsed: unknown;
    try {
      parsed = JSON.parse(data.message?.content ?? "");
    } catch {
      throw new AiError("Ollama returned text that isn't valid JSON.");
    }
    const r = schema.safeParse(parsed);
    if (!r.success) throw new AiError("Ollama’s output didn’t match the expected format.");
    return r.data as z.infer<T>;
  }

  async *chat({ system, messages }: { system: string; messages: ChatMessage[] }): AsyncIterable<string> {
    const res = await this.post({ stream: true, messages: [{ role: "system", content: system }, ...messages] });
    const reader = res.body!.getReader();
    const dec = new TextDecoder();
    let buf = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let nl: number;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line) continue;
        const msg = JSON.parse(line) as { message?: { content?: string } };
        if (msg.message?.content) yield msg.message.content;
      }
    }
  }
}

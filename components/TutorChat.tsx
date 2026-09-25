"use client";

import { useEffect, useRef, useState } from "react";
import { Md } from "./Md";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

export function TutorChat({
  questionId,
  answered,
  response,
  suggestions = [],
  compact = false,
}: {
  questionId?: string;
  answered?: boolean;
  response?: string;
  suggestions?: string[];
  compact?: boolean;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || busy) return;
    const next: Msg[] = [...messages, { role: "user", content }];
    setMessages([...next, { role: "assistant", content: "" }]);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/tutor", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: next, questionId, answered, response }),
      });
      if (!res.ok || !res.body) throw new Error(await res.text());
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        setMessages([...next, { role: "assistant", content: acc }]);
      }
    } catch (e) {
      setMessages([...next, { role: "assistant", content: `_Couldn’t reach the tutor: ${(e as Error).message || "unknown error"}_` }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`flex flex-col ${compact ? "h-full" : "h-[70dvh]"} min-h-0`}>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
        {messages.length === 0 && (
          <div className="text-sm text-muted">
            <p>Ask anything about SAT prep{questionId ? " or this question" : ""}. The tutor knows your weakest skills.</p>
            {suggestions.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {suggestions.map((s) => (
                  <button key={s} onClick={() => send(s)} className="rounded-full border border-line px-3 py-1 text-left text-ink hover:bg-surface-2">
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${m.role === "user" ? "bg-indigo text-white dark:text-bg" : "bg-surface-2"}`}>
              {m.role === "assistant" ? m.content ? <Md>{m.content}</Md> : <span className="text-muted">Thinking…</span> : m.content}
            </div>
          </div>
        ))}
        <div ref={bottom} />
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex gap-2 border-t border-line p-3"
      >
        <label htmlFor="tutor-input" className="sr-only">
          Message the tutor
        </label>
        <input
          id="tutor-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask the tutor…"
          autoComplete="off"
          className="min-w-0 flex-1 rounded-lg border border-line bg-bg px-3 py-2 text-sm"
        />
        <button disabled={busy || !input.trim()} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink disabled:opacity-50">
          Send
        </button>
      </form>
    </div>
  );
}

import { notFound } from "next/navigation";
import { TutorChat } from "@/components/TutorChat";
import { aiConfigured, aiLabel } from "@/lib/ai";

export const metadata = { title: "Ask Tutor" };

export default function TutorPage() {
  if (!aiConfigured()) notFound();
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">Ask Tutor</h1>
        <p className="text-muted">
          An AI tutor that knows your weakest skills. It can make mistakes, so check anything important against the lessons and explanations.{" "}
          <span className="text-xs">({aiLabel()})</span>
        </p>
      </div>
      <div className="rounded-2xl border border-line bg-surface shadow-sm">
        <TutorChat
          suggestions={["What should I focus on this week?", "Explain comma splices with an example.", "How do I use Desmos to solve a system?", "Give me a tip for inference questions."]}
        />
      </div>
    </div>
  );
}

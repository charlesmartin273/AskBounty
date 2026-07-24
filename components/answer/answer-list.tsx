"use client";

import type { PublicAnswer } from "@/lib/answers/answer-types";
import { EvalResultsList } from "./eval-results-list";
import { MarkdownPreview } from "./markdown-preview";

// Answers under a question, submission order (= evaluation order:
// first-pass-wins). Pending bodies are publicly readable by design — README
// documents the trade-off; acceptance order cannot be jumped by copying.
export function AnswerList({ answers }: { answers: PublicAnswer[] }) {
  if (answers.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No answers yet — be the first. The first answer passing all criteria
        wins the bounty instantly.
      </p>
    );
  }
  return (
    <div className="space-y-4">
      {answers.map((a) => (
        <div key={a.id} className="space-y-3 rounded-lg border p-4">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="font-mono">
              {a.answererAddress.slice(0, 6)}…{a.answererAddress.slice(-4)}
            </span>
            <span className="text-xs text-muted-foreground">
              {/* deterministic UTC format: SSR and client must render the
                  same text (locale/timezone formats hydration-mismatch) */}
              {new Date(a.createdAt).toISOString().slice(0, 16).replace("T", " ")} UTC
            </span>
            <StatusBadge answer={a} />
          </div>
          <MarkdownPreview body={a.body} />
          <EvalResultsList answerId={a.id} evalResults={a.evalResults} />
        </div>
      ))}
    </div>
  );
}

function StatusBadge({ answer }: { answer: PublicAnswer }) {
  const style =
    answer.status === "accepted"
      ? "bg-green-100 text-green-800"
      : answer.status === "failed"
        ? "bg-red-100 text-red-800"
        : answer.evalResults?.error
          ? "bg-amber-100 text-amber-800"
          : "bg-secondary text-muted-foreground";
  const label =
    answer.status === "pending" && answer.evalResults?.error
      ? "evaluation pending, retrying"
      : answer.status;
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs uppercase ${style}`}>
      {label}
    </span>
  );
}

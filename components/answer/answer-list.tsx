"use client";

import { Badge } from "@/components/ui/badge";
import type { PublicAnswer } from "@/lib/answers/answer-types";
import { EvalResultsList } from "./eval-results-list";
import { MarkdownPreview } from "./markdown-preview";

// Answers under a question, submission order (= evaluation order:
// first-pass-wins). Pending bodies are publicly readable by design - README
// documents the trade-off; acceptance order cannot be jumped by copying.
export function AnswerList({ answers }: { answers: PublicAnswer[] }) {
  if (answers.length === 0) {
    return (
      <p className="t-body-14 text-muted-ink">
        No answers yet - be the first. The first answer passing all criteria
        wins the bounty instantly.
      </p>
    );
  }
  return (
    <div className="space-y-4">
      {answers.map((a) => (
        <div key={a.id} className="space-y-3 rounded-xl bg-paper p-6">
          <div className="flex flex-wrap items-center gap-3">
            <span className="t-hash text-ink">
              {a.answererAddress.slice(0, 6)}…{a.answererAddress.slice(-4)}
            </span>
            <span className="t-hash text-faint">
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

// Answer lifecycle -> money-state palette (never brand red):
// accepted -> success, failed -> fail, eval-error -> pending, else neutral.
function StatusBadge({ answer }: { answer: PublicAnswer }) {
  const variant =
    answer.status === "accepted"
      ? ("success" as const)
      : answer.status === "failed"
        ? ("fail" as const)
        : answer.evalResults?.error
          ? ("pending" as const)
          : ("neutral" as const);
  const label =
    answer.status === "pending" && answer.evalResults?.error
      ? "evaluation pending, retrying"
      : answer.status;
  return <Badge variant={variant}>{label}</Badge>;
}

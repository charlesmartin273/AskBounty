"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { EvalResultsJson } from "@/lib/answers/answer-types";

// Per-check evaluation results + the R3 error state: an LLM failure shows
// "evaluation pending, retrying" with a manual Retry button - never a silent
// hang. Retry hits POST /api/answers/[id]/retry (idempotent) and refreshes.
export function EvalResultsList({
  answerId,
  evalResults,
}: {
  answerId: string;
  evalResults: EvalResultsJson | null;
}) {
  const router = useRouter();
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  if (!evalResults) return null;
  const { results, error, failReason } = evalResults;

  const retry = async () => {
    setRetrying(true);
    setRetryError(null);
    try {
      const res = await fetch(`/api/answers/${answerId}/retry`, { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      router.refresh();
    } catch (err) {
      setRetryError(err instanceof Error ? err.message : String(err));
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div className="t-body-14 space-y-2">
      {results?.map((r) => (
        <div key={r.check} className="flex gap-2">
          {/* Per-check verdicts use the state palette, never brand red. */}
          <span className={r.pass ? "text-success" : "text-fail"}>
            {r.pass ? "✓" : "✗"}
          </span>
          <span>
            <span className="t-hash text-ink">{r.check}</span>{" "}
            <span className="text-muted-ink">- {r.detail}</span>
          </span>
        </div>
      ))}
      {failReason && <p className="text-fail">{failReason}</p>}
      {error && (
        <div className="rounded-lg border border-pending-line bg-pending-bg p-4">
          <p className="t-body-14-medium text-pending">Evaluation pending, retrying</p>
          <p className="t-hash mt-1 break-all text-muted-ink">
            LLM error ({error.code}): {error.message}
            {error.retryable ? " - retry should succeed." : " - needs a config fix or manual retry."}
          </p>
          <Button size="sm" variant="outline" className="mt-2" disabled={retrying} onClick={retry}>
            {retrying ? "Retrying…" : "Retry evaluation"}
          </Button>
          {retryError && (
            <p className="t-body-12-medium mt-1 break-all text-fail">{retryError}</p>
          )}
        </div>
      )}
    </div>
  );
}

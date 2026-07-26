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
    <div className="space-y-2 text-sm">
      {results?.map((r) => (
        <div key={r.check} className="flex gap-2">
          <span className={r.pass ? "text-green-600" : "text-red-600"}>
            {r.pass ? "✓" : "✗"}
          </span>
          <span>
            <span className="font-mono text-xs">{r.check}</span>{" "}
            <span className="text-muted-foreground">- {r.detail}</span>
          </span>
        </div>
      ))}
      {failReason && <p className="text-red-600">{failReason}</p>}
      {error && (
        <div className="rounded-md border border-amber-400 bg-amber-50 p-3">
          <p className="font-medium text-amber-800">Evaluation pending, retrying</p>
          <p className="mt-1 break-all text-xs text-amber-800">
            LLM error ({error.code}): {error.message}
            {error.retryable ? " - retry should succeed." : " - needs a config fix or manual retry."}
          </p>
          <Button size="sm" variant="outline" className="mt-2" disabled={retrying} onClick={retry}>
            {retrying ? "Retrying…" : "Retry evaluation"}
          </Button>
          {retryError && <p className="mt-1 break-all text-xs text-red-600">{retryError}</p>}
        </div>
      )}
    </div>
  );
}

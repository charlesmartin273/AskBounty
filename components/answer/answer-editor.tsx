"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { Button } from "@/components/ui/button";
import { ErrorNote } from "@/components/ui/error-note";
import { Textarea } from "@/components/ui/textarea";
import type { PublicAnswer } from "@/lib/answers/answer-types";
import {
  toFriendlyError,
  UserFacingError,
  type FriendlyError,
} from "@/lib/ui/friendly-error";
import {
  buildAnswerMessage,
  contentHashOf,
} from "@/lib/auth/verify-submission-signature";
import { EvalResultsList } from "./eval-results-list";
import { MarkdownPreview } from "./markdown-preview";

// Answer editor: textarea + preview, wallet-signed submission. The signature
// covers (questionId, keccak256(body)) - the exact message the server
// verifies (same module, no drift possible).
export function AnswerEditor({ questionId }: { questionId: string }) {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const router = useRouter();
  const [body, setBody] = useState("");
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState("");
  const [error, setError] = useState<FriendlyError | null>(null);
  const [result, setResult] = useState<PublicAnswer | null>(null);

  if (!isConnected || !address) {
    return (
      <p className="text-sm text-muted-foreground">
        Connect your wallet (top of this box) to submit an answer.
      </p>
    );
  }

  const submit = async () => {
    if (busy || body.trim() === "") return; // double-click guard
    setBusy(true);
    setError(null);
    try {
      setBusyLabel("Sign the submission in your wallet…");
      const signature = await signMessageAsync({
        message: buildAnswerMessage(questionId, contentHashOf(body)),
      });
      setBusyLabel("Evaluating (objective checks, then LLM)…");
      const res = await fetch("/api/answers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId, body, address, signature }),
      });
      const data = await res.json().catch(() => null);
      // API error strings are already user-facing copy (cooldown, closed…)
      if (!res.ok) throw new UserFacingError(data?.error ?? `HTTP ${res.status}`);
      setResult(data.answer as PublicAnswer);
      router.refresh(); // re-render server components (answer list, receipt)
    } catch (err) {
      setError(toFriendlyError(err));
    } finally {
      setBusy(false);
      setBusyLabel("");
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2 text-sm">
        <button
          type="button"
          className={tab === "write" ? "font-semibold underline" : "text-muted-foreground"}
          onClick={() => setTab("write")}
        >
          Write
        </button>
        <button
          type="button"
          className={tab === "preview" ? "font-semibold underline" : "text-muted-foreground"}
          onClick={() => setTab("preview")}
        >
          Preview
        </button>
      </div>
      {tab === "write" ? (
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={10}
          placeholder="Write your answer in markdown. Use ``` fenced blocks for code."
          disabled={busy}
        />
      ) : (
        <div className="rounded-md border p-3">
          {body.trim() === "" ? (
            <p className="text-sm text-muted-foreground">Nothing to preview yet.</p>
          ) : (
            <MarkdownPreview body={body} />
          )}
        </div>
      )}
      <div className="flex items-center gap-3">
        <Button onClick={submit} disabled={busy || body.trim() === ""}>
          {busy ? busyLabel || "Submitting…" : "Sign & submit answer"}
        </Button>
        <span className="text-xs text-muted-foreground">
          Free to submit - you only sign a message, no gas.
        </span>
      </div>
      <ErrorNote error={error} />
      {result && (
        <div className="space-y-2 rounded-md border p-3">
          <p className="text-sm font-medium">
            {result.status === "accepted"
              ? "🎉 Accepted - your answer won the bounty. Payout details below."
              : result.status === "failed"
                ? "Not accepted - see the checks below, fix and resubmit (60s cooldown)."
                : "Evaluation pending - see below."}
          </p>
          <EvalResultsList answerId={result.id} evalResults={result.evalResults} />
        </div>
      )}
    </div>
  );
}

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
      <p className="t-body-14 text-muted-ink">
        Connect your wallet (top right of the page) to submit an answer.
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
      {/* Write/Preview toggle in the mono label voice; active tab = ink pill */}
      <div className="flex gap-1">
        <button
          type="button"
          className={`t-label cursor-pointer rounded-full px-3 py-1.5 transition-colors duration-300 ${
            tab === "write" ? "bg-ink text-cream" : "text-muted-ink hover:bg-muted"
          }`}
          onClick={() => setTab("write")}
        >
          Write
        </button>
        <button
          type="button"
          className={`t-label cursor-pointer rounded-full px-3 py-1.5 transition-colors duration-300 ${
            tab === "preview" ? "bg-ink text-cream" : "text-muted-ink hover:bg-muted"
          }`}
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
        <div className="rounded-xl border border-line-2 p-5">
          {body.trim() === "" ? (
            <p className="t-body-14 text-faint">Nothing to preview yet.</p>
          ) : (
            <MarkdownPreview body={body} />
          )}
        </div>
      )}
      <div className="flex items-center gap-3">
        <Button onClick={submit} disabled={busy || body.trim() === ""}>
          {busy ? busyLabel || "Submitting…" : "Sign & submit answer"}
        </Button>
        <span className="t-body-14 text-muted-ink">
          Free to submit - you only sign a message, no gas.
        </span>
      </div>
      <ErrorNote error={error} />
      {result && (
        <div className="space-y-2 rounded-xl border border-line-2 p-5">
          <p className="t-body-14-medium text-ink">
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

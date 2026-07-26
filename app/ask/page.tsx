"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CriteriaBuilder } from "@/components/ask/criteria-builder";
import { FundingWizard } from "@/components/ask/funding-wizard";
import { SiteNav } from "@/components/site-nav";
import { ErrorNote } from "@/components/ui/error-note";
import { WalletConnect } from "@/components/wallet/wallet-connect";
import type { Criteria } from "@/lib/questions/criteria-schema";
import {
  toFriendlyError,
  UserFacingError,
  type FriendlyError,
} from "@/lib/ui/friendly-error";

const DRAFT_KEY = "askbounty:draft-id";

function defaultDeadline(): string {
  const d = new Date(Date.now() + 48 * 3600_000);
  d.setSeconds(0, 0);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export default function AskPage() {
  const { address } = useAccount();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [resumeId, setResumeId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [budget, setBudget] = useState("20");
  const [deadline, setDeadline] = useState(defaultDeadline);
  const [criteria, setCriteria] = useState<Criteria>({
    minWords: 150, mustIncludeCode: false, topics: [],
  });
  const [fees, setFees] = useState<{ platformFeeBP: number; evaluatorFeeBP: number } | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<FriendlyError | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // localStorage is client-only; reading it in the state initializer would SSR-mismatch
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setResumeId(localStorage.getItem(DRAFT_KEY));
    fetch("/api/fees").then((r) => r.json()).then(setFees).catch(() => setFees(null));
  }, []);

  const budgetNum = Number(budget) || 0;
  const netPreview = fees
    ? budgetNum - (budgetNum * (fees.platformFeeBP + fees.evaluatorFeeBP)) / 10_000
    : null;

  const submit = async () => {
    if (!address) return setError({ message: "Connect your wallet first." });
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          askerAddress: address, title, body, budget,
          deadline: new Date(deadline).toISOString(), criteria,
        }),
      });
      const data = await res.json();
      // API validation strings ("deadline must be…") are user-facing copy
      if (!res.ok) throw new UserFacingError(data.error ?? `HTTP ${res.status}`);
      localStorage.setItem(DRAFT_KEY, data.questionId);
      setWarnings(data.warnings ?? []);
      setActiveId(data.questionId);
    } catch (err) {
      setError(toFriendlyError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-2xl space-y-6 p-6">
      <SiteNav />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Ask a question</h1>
        <WalletConnect />
      </div>

      {!activeId && resumeId && (
        <div className="flex items-center justify-between rounded-lg border border-amber-400 bg-amber-50 p-3 text-sm">
          <span>You have an unfinished question ({resumeId}).</span>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => setActiveId(resumeId)}>Resume funding</Button>
            <Button size="sm" variant="outline"
              onClick={() => { localStorage.removeItem(DRAFT_KEY); setResumeId(null); }}>
              Discard
            </Button>
          </div>
        </div>
      )}

      {activeId ? (
        <>
          {warnings.map((w) => (
            <p key={w} className="rounded-md bg-amber-50 p-2 text-sm text-amber-800">⚠ {w}</p>
          ))}
          <FundingWizard questionId={activeId} />
        </>
      ) : (
        <div className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="title">Title</Label>
            <Input id="title" value={title} maxLength={200}
              placeholder="How do I paginate getLogs on Arc…" onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="body">Details</Label>
            <Textarea id="body" rows={8} value={body}
              placeholder="Describe the problem, constraints, what a good answer covers…"
              onChange={(e) => setBody(e.target.value)} />
          </div>
          <div className="flex flex-wrap gap-4">
            <div className="space-y-1">
              <Label htmlFor="budget">Budget (USDC)</Label>
              <Input id="budget" type="number" min="0.1" step="0.1" className="w-32"
                value={budget} onChange={(e) => setBudget(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="deadline">Deadline</Label>
              <Input id="deadline" type="datetime-local" value={deadline}
                onChange={(e) => setDeadline(e.target.value)} />
            </div>
          </div>
          {netPreview !== null && budgetNum > 0 && (
            <p className="text-sm text-muted-foreground">
              Winner receives <strong>{netPreview.toFixed(2)} USDC</strong> after protocol fees
              (live onchain read - locked in when you post).
            </p>
          )}
          <CriteriaBuilder value={criteria} onChange={setCriteria} />
          <ErrorNote error={error} />
          <Button onClick={() => void submit()}
            disabled={submitting || !title.trim() || !body.trim() || budgetNum <= 0}>
            {submitting ? "Creating draft…" : "Create question & start funding"}
          </Button>
        </div>
      )}
    </main>
  );
}

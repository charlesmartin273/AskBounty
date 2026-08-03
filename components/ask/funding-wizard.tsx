"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorNote } from "@/components/ui/error-note";
import { useFundingWizard } from "./use-funding-wizard";

const STEPS = [
  { n: 1, title: "Create job onchain", desc: "Your wallet creates the ERC-8183 job (client = you)." },
  { n: 2, title: "Set budget", desc: "AskBounty backend sets the budget (provider-only call)." },
  { n: 3, title: "Approve + fund", desc: "Your wallet approves USDC and funds the escrow." },
] as const;

// 3-step resumable funding wizard. Step truth comes from DB + chain via the
// API; refresh/close mid-flow and it resumes exactly where it left off.
export function FundingWizard({ questionId }: { questionId: string }) {
  const router = useRouter();
  const w = useFundingWizard(questionId);

  useEffect(() => {
    if (w.finalized) {
      localStorage.removeItem("askbounty:draft-id");
      router.push(`/q/${questionId}`);
    }
  }, [w.finalized, router, questionId]);

  if (w.loading) return <p className="t-body-14 text-muted-ink">Loading wizard state…</p>;
  if (!w.question) {
    // Review M3: transient RPC/DB failure must not dead-end the wizard.
    return (
      <div className="space-y-2">
        <p className="t-body-14 text-fail">{w.error?.message ?? "Question not found"}</p>
        <Button variant="outline" onClick={() => void w.refresh()}>Retry loading</Button>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Fund the bounty - <span className="t-num-lg">{w.question.budget} USDC</span>
        </CardTitle>
        {w.step === 4 ? (
          <p className="t-body-14 text-success">
            Escrow funded onchain - one last verification step below.
          </p>
        ) : (
          <p className="t-body-14 text-muted-ink">
            Resumable: if you close this tab, come back and it continues from the same step.
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <ol className="space-y-3">
          {STEPS.map((st) => {
            const state =
              w.step > st.n ? "done" : w.step === st.n ? "current" : "todo";
            return (
              <li key={st.n} className="flex items-start gap-3">
                {/* done -> success green, current -> ink (the system has no
                    blue), todo -> quiet gray */}
                <span
                  className={`t-label mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                    state === "done"
                      ? "bg-success text-white"
                      : state === "current"
                        ? "bg-ink text-cream"
                        : "bg-muted text-faint"
                  }`}
                >
                  {state === "done" ? "✓" : st.n}
                </span>
                <div>
                  <p className={`t-body-14-medium ${state === "todo" ? "text-faint" : "text-ink"}`}>
                    {st.title}
                  </p>
                  <p className="t-body-14 text-muted-ink">{st.desc}</p>
                </div>
              </li>
            );
          })}
        </ol>

        {!w.connected && (
          <p className="t-body-14 text-pending">Connect your wallet above to continue.</p>
        )}
        {w.wrongWallet && (
          <p className="t-body-14 text-fail">
            Connected wallet ≠ asker wallet (<span className="t-hash">{w.question.askerAddress.slice(0, 8)}…</span>). Switch
            accounts to continue.
          </p>
        )}
        <ErrorNote error={w.error} />

        {!w.finalized && (
          <Button
            onClick={() => void w.runStep()}
            disabled={w.busy || (w.step < 4 && (!w.connected || w.wrongWallet))}
          >
            {w.busy
              ? w.busyLabel
              : w.step === 4
                ? "Finalize - verify escrow"
                : w.error
                  ? `Retry step ${w.step}`
                  : `Run step ${w.step}: ${STEPS[w.step - 1].title}`}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

  if (w.loading) return <p className="text-sm text-muted-foreground">Loading wizard state…</p>;
  if (!w.question) {
    // Review M3: transient RPC/DB failure must not dead-end the wizard.
    return (
      <div className="space-y-2">
        <p className="text-sm text-red-600">{w.error ?? "Question not found"}</p>
        <Button variant="outline" onClick={() => void w.refresh()}>Retry loading</Button>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">
          Fund the bounty — {w.question.budget} USDC
        </CardTitle>
        {w.step === 4 ? (
          <p className="text-sm text-green-700">
            Escrow funded onchain — one last verification step below.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
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
                <span
                  className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    state === "done"
                      ? "bg-green-600 text-white"
                      : state === "current"
                        ? "bg-blue-600 text-white"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {state === "done" ? "✓" : st.n}
                </span>
                <div>
                  <p className={`text-sm font-medium ${state === "todo" ? "text-muted-foreground" : ""}`}>
                    {st.title}
                  </p>
                  <p className="text-xs text-muted-foreground">{st.desc}</p>
                </div>
              </li>
            );
          })}
        </ol>

        {!w.connected && (
          <p className="text-sm text-amber-700">Connect your wallet above to continue.</p>
        )}
        {w.wrongWallet && (
          <p className="text-sm text-red-600">
            Connected wallet ≠ asker wallet ({w.question.askerAddress.slice(0, 8)}…). Switch
            accounts to continue.
          </p>
        )}
        {w.error && <p className="text-sm text-red-600 break-all">Error: {w.error}</p>}

        {!w.finalized && (
          <Button
            onClick={() => void w.runStep()}
            disabled={w.busy || (w.step < 4 && (!w.connected || w.wrongWallet))}
          >
            {w.busy
              ? w.busyLabel
              : w.step === 4
                ? "Finalize — verify escrow"
                : w.error
                  ? `Retry step ${w.step}`
                  : `Run step ${w.step}: ${STEPS[w.step - 1].title}`}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

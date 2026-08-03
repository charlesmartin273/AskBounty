"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { PublicAnswer } from "@/lib/answers/answer-types";
import { arcscanTxUrl } from "@/lib/chain/config";

// Payout receipt (R4): BOTH transactions of the Option B two-hop payout with
// Arcscan links, so anyone can verify the agent kept nothing. If the escrow
// released a different amount than the snapshot promised (fee drift), both
// numbers are shown - the FULL released amount was still forwarded.
export function PayoutReceipt({
  answer,
  netPayout,
}: {
  answer: PublicAnswer;
  netPayout: string;
}) {
  const paid = answer.evalResults?.paid;
  const amount = paid?.amount ?? netPayout;
  const winner = answer.answererAddress;

  if (answer.payoutStatus !== "paid") {
    return (
      <div className="rounded-xl border border-pending-line bg-pending-bg p-6">
        <p className="t-body-16-medium text-pending">
          Answer accepted - payout pending, retrying
        </p>
        <p className="t-body-14 mt-1 text-ink">
          The escrow payout to <span className="t-hash">{short(winner)}</span> has
          not completed yet.
          {answer.evalResults?.payoutError && (
            <span className="t-hash mt-1 block break-all text-muted-ink">
              Last error: {answer.evalResults.payoutError}
            </span>
          )}
        </p>
        {answer.completeTx && (
          <TxLink label="escrow → agent wallet (complete)" hash={answer.completeTx} />
        )}
        <RetryPayoutButton answerId={answer.id} />
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-success-line bg-success-bg p-6">
      {/* Exact decimal strings on purpose (review L6): a receipt inviting
          verification must never round the number it asks you to verify. */}
      <p className="t-body-16-medium text-success">
        Bounty paid: <span className="t-num-lg align-baseline">{amount} USDC</span>{" "}
        → <span className="t-hash">{short(winner)}</span>
      </p>
      {paid?.discrepancy && (
        <p className="t-body-14 text-pending">
          ⚠ Fee change detected: the snapshot at question creation promised{" "}
          <span className="t-num">{paid.discrepancy.expectedNet} USDC</span>, the
          escrow released <span className="t-num">{paid.discrepancy.released} USDC</span>.
          The FULL released amount was forwarded to the winner - the agent
          retained nothing.
        </p>
      )}
      {answer.completeTx && (
        <TxLink label="1. escrow → agent wallet (complete)" hash={answer.completeTx} />
      )}
      {answer.forwardTx && (
        <TxLink label="2. agent wallet → winner (forward)" hash={answer.forwardTx} />
      )}
      <p className="t-body-14 text-success">
        Both transactions are public - verify on Arcscan that the agent kept
        nothing.
      </p>
    </div>
  );
}

function TxLink({ label, hash }: { label: string; hash: string }) {
  return (
    <p className="t-body-14 text-ink">
      {label}:{" "}
      <a
        href={arcscanTxUrl(hash)}
        target="_blank"
        rel="noopener noreferrer"
        className="t-hash break-all text-brand no-underline hover:underline"
      >
        {hash} ↗
      </a>
    </p>
  );
}

function RetryPayoutButton({ answerId }: { answerId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const retry = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/answers/${answerId}/retry`, { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mt-2">
      <Button size="sm" variant="outline" disabled={busy} onClick={retry}>
        {busy ? "Retrying payout…" : "Retry payout"}
      </Button>
      {error && <p className="t-body-12-medium mt-1 break-all text-fail">{error}</p>}
    </div>
  );
}

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

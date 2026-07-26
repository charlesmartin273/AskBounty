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
      <div className="rounded-lg border border-amber-400 bg-amber-50 p-4">
        <p className="font-medium text-amber-800">
          Answer accepted - payout pending, retrying
        </p>
        <p className="mt-1 text-sm text-amber-800">
          The escrow payout to {short(winner)} has not completed yet.
          {answer.evalResults?.payoutError && (
            <span className="mt-1 block break-all text-xs">
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
    <div className="space-y-2 rounded-lg border border-green-500 bg-green-50 p-4">
      {/* Exact decimal strings on purpose (review L6): a receipt inviting
          verification must never round the number it asks you to verify. */}
      <p className="font-medium text-green-800">
        Bounty paid: {amount} USDC → {short(winner)}
      </p>
      {paid?.discrepancy && (
        <p className="text-sm text-amber-800">
          ⚠ Fee change detected: the snapshot at question creation promised{" "}
          {paid.discrepancy.expectedNet} USDC, the escrow released{" "}
          {paid.discrepancy.released} USDC. The FULL released
          amount was forwarded to the winner - the agent retained nothing.
        </p>
      )}
      {answer.completeTx && (
        <TxLink label="1. escrow → agent wallet (complete)" hash={answer.completeTx} />
      )}
      {answer.forwardTx && (
        <TxLink label="2. agent wallet → winner (forward)" hash={answer.forwardTx} />
      )}
      <p className="text-xs text-green-800">
        Both transactions are public - verify on Arcscan that the agent kept
        nothing.
      </p>
    </div>
  );
}

function TxLink({ label, hash }: { label: string; hash: string }) {
  return (
    <p className="text-sm">
      {label}:{" "}
      <a
        href={arcscanTxUrl(hash)}
        target="_blank"
        rel="noopener noreferrer"
        className="break-all font-mono text-xs underline"
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
      {error && <p className="mt-1 break-all text-xs text-red-600">{error}</p>}
    </div>
  );
}

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { Button } from "@/components/ui/button";
import { ErrorNote } from "@/components/ui/error-note";
import { agenticCommerceAbi } from "@/lib/chain/abi-agentic-commerce";
import { AGENTIC_COMMERCE } from "@/lib/chain/config";
import {
  toFriendlyError,
  UserFacingError,
  type FriendlyError,
} from "@/lib/ui/friendly-error";

// Claim-refund flow. PRD-ERRATA E6: claimRefund is PERMISSIONLESS as to
// caller, but the contract ALWAYS pays the job's client (asker) — funds can
// never be misdirected. Product decision (2026-07-23): the button stays
// asker-gated for UX clarity; the contract itself needs no such gate. After
// the tx confirms, /api/questions/[id]/refund verifies the calldata is
// claimRefund(jobId) for this question and flips the public status.
export function ClaimRefundButton({
  questionId,
  jobId,
  askerAddress,
}: {
  questionId: string;
  jobId: number;
  askerAddress: string;
}) {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState("");
  const [error, setError] = useState<FriendlyError | null>(null);

  if (!isConnected || !address) {
    return (
      <p className="text-sm text-muted-foreground">
        Connect the asker wallet to claim the refund.
      </p>
    );
  }
  const wrongWallet = address.toLowerCase() !== askerAddress.toLowerCase();

  const claim = async () => {
    if (busy || !publicClient) return;
    setBusy(true);
    setError(null);
    try {
      setBusyLabel("Confirm claimRefund in your wallet…");
      const hash = await writeContractAsync({
        address: AGENTIC_COMMERCE,
        abi: agenticCommerceAbi,
        functionName: "claimRefund",
        args: [BigInt(jobId)],
      });
      setBusyLabel("Waiting for confirmation…");
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") {
        throw new UserFacingError(
          `The refund transaction reverted onchain (${hash.slice(0, 10)}…) — the escrow was not touched. Retry in a moment.`,
        );
      }
      setBusyLabel("Recording refund…");
      const res = await fetch(`/api/questions/${questionId}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refundTx: hash }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new UserFacingError(data?.error ?? `HTTP ${res.status}`);
      router.refresh();
    } catch (err) {
      setError(toFriendlyError(err));
    } finally {
      setBusy(false);
      setBusyLabel("");
    }
  };

  return (
    <div className="space-y-2">
      <Button onClick={claim} disabled={busy || wrongWallet}>
        {busy ? busyLabel || "Claiming…" : "Claim refund"}
      </Button>
      {wrongWallet && (
        <p className="text-xs text-muted-foreground">
          Only the asker ({askerAddress.slice(0, 6)}…{askerAddress.slice(-4)})
          can claim this refund — switch to that wallet.
        </p>
      )}
      <ErrorNote error={error} />
    </div>
  );
}

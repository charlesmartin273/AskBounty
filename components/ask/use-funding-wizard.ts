"use client";

import { useCallback, useEffect, useState } from "react";
import { parseEventLogs } from "viem";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { agenticCommerceAbi } from "@/lib/chain/abi-agentic-commerce";
import { usdcAbi } from "@/lib/chain/abi-usdc";
import { AGENTIC_COMMERCE, USDC_ADDRESS } from "@/lib/chain/config";
import { usdcToRaw } from "@/lib/format-usdc";
import {
  toFriendlyError,
  UserFacingError,
  type FriendlyError,
} from "@/lib/ui/friendly-error";

interface WizardQuestion {
  id: string;
  askerAddress: string;
  budget: string;
  deadline: string;
  jobId: number | null;
  status: string;
}

export interface WizardState {
  loading: boolean;
  step: 1 | 2 | 3 | 4;
  busy: boolean;
  busyLabel: string;
  error: FriendlyError | null;
  question: WizardQuestion | null;
  agentAddress: `0x${string}` | null;
  finalized: boolean;
}

// Wizard truth lives in DB + chain (via GET /api/questions/[id]); this hook
// only drives the current step. Closing the tab loses nothing (yêu cầu 3).
export function useFundingWizard(questionId: string) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const [s, setS] = useState<WizardState>({
    loading: true, step: 1, busy: false, busyLabel: "", error: null,
    question: null, agentAddress: null, finalized: false,
  });

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/questions/${questionId}`);
    if (!res.ok) {
      const msg = (await res.json().catch(() => null))?.error ?? `load failed (${res.status})`;
      setS((p) => ({ ...p, loading: false, error: { message: msg } }));
      return null;
    }
    const data = await res.json();
    setS((p) => ({
      ...p, loading: false, error: null,
      step: data.wizard.step, finalized: data.wizard.finalized,
      question: data.question, agentAddress: data.agentAddress,
    }));
    return data;
  }, [questionId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const post = async (path: string, body?: object) => {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
    // API error strings are already user-facing copy - pass through as-is
    if (!res.ok) {
      throw new UserFacingError(
        (await res.json().catch(() => null))?.error ?? `HTTP ${res.status}`,
      );
    }
    return res.json();
  };

  const runStep = useCallback(async () => {
    const { step, question, agentAddress } = s;
    if (!question || !agentAddress || !publicClient) return;
    const busy = (label: string) => setS((p) => ({ ...p, busy: true, busyLabel: label, error: null }));
    try {
      const budgetRaw = usdcToRaw(question.budget);
      if (step === 4) {
        // Review H1: escrow already Funded onchain but DB finalize failed -
        // retry ONLY the finalize call, no wallet interaction needed.
        busy("Verifying escrow onchain…");
        await post(`/api/questions/${question.id}/finalize`, {});
      } else if (step === 1) {
        busy("Confirm createJob in your wallet…");
        const deadlineUnix = BigInt(Math.floor(Date.parse(question.deadline) / 1000));
        const hash = await writeContractAsync({
          address: AGENTIC_COMMERCE, abi: agenticCommerceAbi, functionName: "createJob",
          args: [agentAddress, agentAddress, deadlineUnix, question.id,
            "0x0000000000000000000000000000000000000000"],
        });
        busy("Waiting for confirmation…");
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        const [created] = parseEventLogs({ abi: agenticCommerceAbi, eventName: "JobCreated", logs: receipt.logs });
        if (!created) throw new Error("JobCreated event missing");
        busy("Recording job…");
        await post(`/api/questions/${question.id}/job`, { jobId: created.args.jobId.toString(), createTx: hash });
      } else if (step === 2) {
        busy("Backend is setting the budget…");
        await post(`/api/questions/${question.id}/set-budget`);
      } else if (step === 3) {
        // Review H1: if a previous attempt already funded the escrow (finalize
        // failed mid-flight), skip straight to finalize - re-running fund
        // would revert and strand the user.
        const jobNow = await publicClient.readContract({
          address: AGENTIC_COMMERCE, abi: agenticCommerceAbi,
          functionName: "getJob", args: [BigInt(question.jobId!)],
        });
        if (jobNow.status === 1 /* Funded */) {
          busy("Escrow already funded - verifying…");
          await post(`/api/questions/${question.id}/finalize`, {});
          await refresh();
          return;
        }
        const allowance = await publicClient.readContract({
          address: USDC_ADDRESS, abi: usdcAbi, functionName: "allowance",
          args: [question.askerAddress as `0x${string}`, AGENTIC_COMMERCE],
        });
        if (allowance < budgetRaw) {
          busy("Confirm USDC approve in your wallet…");
          const approveHash = await writeContractAsync({
            address: USDC_ADDRESS, abi: usdcAbi, functionName: "approve",
            args: [AGENTIC_COMMERCE, budgetRaw],
          });
          await publicClient.waitForTransactionReceipt({ hash: approveHash });
        }
        busy("Confirm fund in your wallet…");
        const fundHash = await writeContractAsync({
          address: AGENTIC_COMMERCE, abi: agenticCommerceAbi, functionName: "fund",
          args: [BigInt(question.jobId!), "0x"],
        });
        busy("Waiting for fund confirmation…");
        await publicClient.waitForTransactionReceipt({ hash: fundHash });
        busy("Verifying escrow onchain…");
        await post(`/api/questions/${question.id}/finalize`, { fundTx: fundHash });
      }
      await refresh();
    } catch (err) {
      setS((p) => ({ ...p, error: toFriendlyError(err) }));
    } finally {
      setS((p) => ({ ...p, busy: false, busyLabel: "" }));
    }
  }, [s, publicClient, writeContractAsync, refresh]);

  const wrongWallet =
    !!s.question && !!address && address.toLowerCase() !== s.question.askerAddress.toLowerCase();

  return { ...s, wrongWallet, connected: !!address, runStep, refresh };
}

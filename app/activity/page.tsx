"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { SiteNav } from "@/components/site-nav";
import { WalletConnect } from "@/components/wallet/wallet-connect";
import { arcscanTxUrl } from "@/lib/chain/config";
import { rawToUsdc, usdcDisplay, usdcToRaw } from "@/lib/format-usdc";

interface AskedRow {
  id: string; title: string; budget: string; net_payout: string | null;
  status: string; deadline: string; refund_tx: string | null;
}
interface AnsweredRow {
  id: string; questionId: string; questionTitle: string; status: string;
  payoutStatus: string | null; forwardTx: string | null; paidAmount: string | null;
}

// My activity (PRD §4.5). C4 — chain is truth: an accepted answer is NEVER
// labeled plain "accepted"; it is either "Paid" (payout_status written only
// after both onchain receipts, forward tx linked for verification) or
// "Accepted — payout pending".
export default function ActivityPage() {
  const { address, isConnected } = useAccount();
  const [tab, setTab] = useState<"asked" | "answered">("asked");
  const [data, setData] = useState<{ asked: AskedRow[]; answered: AnsweredRow[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!address) return; // render guards on isConnected below
    fetch(`/api/activity?address=${address}`)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json().catch(() => null))?.error ?? `HTTP ${r.status}`);
        setData(await r.json());
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [address]);

  const paidAnswers = data?.answered.filter((a) => a.payoutStatus === "paid") ?? [];
  // bigint raw units — never float-sum USDC (review M3).
  const earningsRaw = paidAnswers.reduce(
    (s, a) => s + usdcToRaw(a.paidAmount ?? "0"),
    0n,
  );

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 p-6">
      <SiteNav />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">My activity</h1>
        <WalletConnect />
      </div>
      {!isConnected && (
        <p className="text-sm text-muted-foreground">Connect a wallet to see your questions and answers.</p>
      )}
      {error && <p className="break-all text-sm text-red-600">{error}</p>}
      {isConnected && data && (
        <>
          <div className="flex gap-4 text-sm">
            <button type="button" onClick={() => setTab("asked")}
              className={tab === "asked" ? "font-semibold underline" : "text-muted-foreground"}>
              Asked ({data.asked.length})
            </button>
            <button type="button" onClick={() => setTab("answered")}
              className={tab === "answered" ? "font-semibold underline" : "text-muted-foreground"}>
              Answered ({data.answered.length})
            </button>
          </div>
          {tab === "answered" && data.answered.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Earnings: {rawToUsdc(earningsRaw)} USDC · Pass rate: {paidAnswers.length}/{data.answered.length}
            </p>
          )}
          <div className="space-y-3">
            {tab === "asked"
              ? data.asked.map((q) => (
                  <div key={q.id} className="flex items-center justify-between gap-3 rounded-lg border p-4">
                    <div className="min-w-0">
                      <Link href={`/q/${q.id}`} className="truncate font-medium underline">{q.title}</Link>
                      <p className="text-xs text-muted-foreground">
                        {usdcDisplay(q.budget)} USDC ·{" "}
                        {q.status === "refunded" && q.refund_tx ? (
                          <a href={arcscanTxUrl(q.refund_tx)} target="_blank" rel="noopener noreferrer" className="underline">
                            refunded ↗
                          </a>
                        ) : q.status === "expired" ? (
                          <Link href={`/q/${q.id}`} className="underline">expired — claim refund</Link>
                        ) : (
                          q.status
                        )}
                      </p>
                    </div>
                  </div>
                ))
              : data.answered.map((a) => (
                  <div key={a.id} className="flex items-center justify-between gap-3 rounded-lg border p-4">
                    <div className="min-w-0">
                      <Link href={`/q/${a.questionId}`} className="truncate font-medium underline">
                        {a.questionTitle}
                      </Link>
                      <p className="text-xs">
                        <AnswerLabel a={a} />
                      </p>
                    </div>
                  </div>
                ))}
            {tab === "asked" && data.asked.length === 0 && (
              <p className="text-sm text-muted-foreground">No questions asked yet.</p>
            )}
            {tab === "answered" && data.answered.length === 0 && (
              <p className="text-sm text-muted-foreground">No answers submitted yet.</p>
            )}
          </div>
        </>
      )}
    </main>
  );
}

// C4: derive the label from payout_status — never bare "accepted".
function AnswerLabel({ a }: { a: AnsweredRow }) {
  if (a.status === "accepted" && a.payoutStatus === "paid") {
    return (
      <span className="text-green-700">
        Paid {a.paidAmount ?? "?"} USDC{" "}
        {a.forwardTx && (
          <a href={arcscanTxUrl(a.forwardTx)} target="_blank" rel="noopener noreferrer" className="underline">
            verify ↗
          </a>
        )}
      </span>
    );
  }
  if (a.status === "accepted") {
    return <span className="text-amber-700">Accepted — payout pending (retry on the question page)</span>;
  }
  return <span className="text-muted-foreground">{a.status}</span>;
}

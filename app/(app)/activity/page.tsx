"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { SiteNav } from "@/components/site-nav";
import { ErrorNote } from "@/components/ui/error-note";
import { arcscanTxUrl } from "@/lib/chain/config";
import { rawToUsdc, usdcDisplay, usdcToRaw } from "@/lib/format-usdc";
import {
  toFriendlyError,
  UserFacingError,
  type FriendlyError,
} from "@/lib/ui/friendly-error";

interface AskedRow {
  id: string; title: string; budget: string; net_payout: string | null;
  status: string; deadline: string; refund_tx: string | null;
}
interface AnsweredRow {
  id: string; questionId: string; questionTitle: string; status: string;
  payoutStatus: string | null; forwardTx: string | null; paidAmount: string | null;
}

// My activity (PRD §4.5). C4 - chain is truth: an accepted answer is NEVER
// labeled plain "accepted"; it is either "Paid" (payout_status written only
// after both onchain receipts, forward tx linked for verification) or
// "Accepted - payout pending".
export default function ActivityPage() {
  const { address, isConnected } = useAccount();
  const [tab, setTab] = useState<"asked" | "answered">("asked");
  // Result is keyed by the address it was fetched FOR: switching accounts
  // derives back to "loading" without a setState-in-effect reset, and a slow
  // response for a previous address can never overwrite the current one.
  const [fetched, setFetched] = useState<{
    address: string;
    data?: { asked: AskedRow[]; answered: AnsweredRow[] };
    error?: FriendlyError;
  } | null>(null);

  useEffect(() => {
    if (!address) return; // render guards on isConnected below
    let stale = false;
    fetch(`/api/activity?address=${address}`)
      .then(async (r) => {
        if (!r.ok) {
          throw new UserFacingError(
            (await r.json().catch(() => null))?.error ?? `HTTP ${r.status}`,
          );
        }
        const data = await r.json();
        if (!stale) setFetched({ address, data });
      })
      .catch((e) => {
        if (!stale) setFetched({ address, error: toFriendlyError(e) });
      });
    return () => {
      stale = true;
    };
  }, [address]);

  const current = fetched && fetched.address === address ? fetched : null;
  const data = current?.data ?? null;
  const error = current?.error ?? null;

  const paidAnswers = data?.answered.filter((a) => a.payoutStatus === "paid") ?? [];
  // bigint raw units - never float-sum USDC (review M3).
  const earningsRaw = paidAnswers.reduce(
    (s, a) => s + usdcToRaw(a.paidAmount ?? "0"),
    0n,
  );

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 p-6">
      <SiteNav />
      {/* Wallet connect lives in the nav - no duplicate button here. */}
      <h1 className="t-display-40 pt-2 text-ink">My activity</h1>
      {!isConnected && (
        <p className="t-body-14 text-muted-ink">
          Connect a wallet (top right) to see your questions and answers.
        </p>
      )}
      <ErrorNote error={error} />
      {isConnected && !data && !error && (
        // Loading: fetch in flight after connect - never a blank page.
        <div className="space-y-3">
          <div className="h-5 w-40 animate-pulse rounded-lg bg-muted" />
          {[0, 1].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-paper/60" />
          ))}
        </div>
      )}
      {isConnected && data && (
        <>
          {/* Tab toggle in the mono label voice; active = ink pill */}
          <div className="flex gap-1">
            <button type="button" onClick={() => setTab("asked")}
              className={`t-label cursor-pointer rounded-full px-3 py-1.5 transition-colors duration-300 ${
                tab === "asked" ? "bg-ink text-cream" : "text-muted-ink hover:bg-muted"
              }`}>
              Asked ({data.asked.length})
            </button>
            <button type="button" onClick={() => setTab("answered")}
              className={`t-label cursor-pointer rounded-full px-3 py-1.5 transition-colors duration-300 ${
                tab === "answered" ? "bg-ink text-cream" : "text-muted-ink hover:bg-muted"
              }`}>
              Answered ({data.answered.length})
            </button>
          </div>
          {tab === "answered" && data.answered.length > 0 && (
            <p className="t-body-14 text-muted-ink">
              Earnings: <span className="t-num text-ink">{rawToUsdc(earningsRaw)} USDC</span>{" "}
              · Pass rate: <span className="t-num text-ink">{paidAnswers.length}/{data.answered.length}</span>
            </p>
          )}
          <div className="space-y-3">
            {tab === "asked"
              ? data.asked.map((q) => (
                  <div key={q.id} className="flex items-center justify-between gap-3 rounded-xl bg-paper p-6">
                    <div className="min-w-0 space-y-1">
                      <Link href={`/q/${q.id}`} className="t-display-20 block truncate text-ink no-underline transition-opacity duration-300 hover:opacity-60">{q.title}</Link>
                      <p className="t-body-14 text-muted-ink">
                        <span className="t-num">{usdcDisplay(q.budget)} USDC</span> ·{" "}
                        {q.status === "refunded" && q.refund_tx ? (
                          <a href={arcscanTxUrl(q.refund_tx)} target="_blank" rel="noopener noreferrer" className="text-brand no-underline hover:underline">
                            refunded ↗
                          </a>
                        ) : q.status === "expired" ? (
                          <Link href={`/q/${q.id}`} className="text-brand no-underline hover:underline">expired - claim refund</Link>
                        ) : (
                          q.status
                        )}
                      </p>
                    </div>
                  </div>
                ))
              : data.answered.map((a) => (
                  <div key={a.id} className="flex items-center justify-between gap-3 rounded-xl bg-paper p-6">
                    <div className="min-w-0 space-y-1">
                      <Link href={`/q/${a.questionId}`} className="t-display-20 block truncate text-ink no-underline transition-opacity duration-300 hover:opacity-60">
                        {a.questionTitle}
                      </Link>
                      <p className="t-body-14">
                        <AnswerLabel a={a} />
                      </p>
                    </div>
                  </div>
                ))}
            {tab === "asked" && data.asked.length === 0 && (
              <p className="t-body-14 text-muted-ink">No questions asked yet.</p>
            )}
            {tab === "answered" && data.answered.length === 0 && (
              <p className="t-body-14 text-muted-ink">No answers submitted yet.</p>
            )}
          </div>
        </>
      )}
    </main>
  );
}

// C4: derive the label from payout_status - never bare "accepted".
function AnswerLabel({ a }: { a: AnsweredRow }) {
  if (a.status === "accepted" && a.payoutStatus === "paid") {
    return (
      <span className="text-success">
        Paid <span className="t-num">{a.paidAmount ?? "?"} USDC</span>{" "}
        {a.forwardTx && (
          <a href={arcscanTxUrl(a.forwardTx)} target="_blank" rel="noopener noreferrer" className="text-brand no-underline hover:underline">
            verify ↗
          </a>
        )}
      </span>
    );
  }
  if (a.status === "accepted") {
    return <span className="text-pending">Accepted - payout pending (retry on the question page)</span>;
  }
  return <span className="text-muted-ink">{a.status}</span>;
}

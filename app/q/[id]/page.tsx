import Link from "next/link";
import { notFound } from "next/navigation";
import { Countdown } from "@/components/question/countdown";
import { CriteriaDisplay } from "@/components/question/criteria-display";
import { NetPayoutBadge } from "@/components/question/net-payout-badge";
import { AGENTIC_COMMERCE } from "@/lib/chain/config";
import type { Criteria } from "@/lib/questions/criteria-schema";
import { isQuestionId } from "@/lib/questions/question-id";
import { getQuestionRow } from "@/lib/questions/question-api-helpers";

export const dynamic = "force-dynamic";

// Public question page (server component). LIVE GUARD (yêu cầu 2): a
// question renders as accepting answers ONLY when status === 'open' — which
// the finalize route grants only after verifying Funded + budget > 0
// onchain. Drafts show a "not live" notice so nobody wastes effort.
export default async function QuestionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isQuestionId(id)) notFound();
  const row = await getQuestionRow(id);
  if (!row) notFound();

  const arcscanTx = row.fund_tx
    ? `https://testnet.arcscan.app/tx/${row.fund_tx}`
    : `https://testnet.arcscan.app/address/${AGENTIC_COMMERCE}`;

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <Link href="/" className="text-xl font-bold">AskBounty</Link>
        <Link href="/ask" className="text-sm underline">Ask a question</Link>
      </div>

      {row.status === "draft" ? (
        <div className="rounded-lg border border-amber-400 bg-amber-50 p-4">
          <h1 className="text-lg font-semibold">This question is not live yet</h1>
          <p className="mt-1 text-sm">
            The bounty escrow has not been funded onchain. It is not accepting answers —
            do not spend effort on it. If you are the asker,{" "}
            <Link href="/ask" className="underline">resume funding here</Link>.
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold">{row.title}</h1>
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span className="font-mono">{row.asker_address.slice(0, 6)}…{row.asker_address.slice(-4)}</span>
              <Countdown deadline={row.deadline} />
              <span className="rounded-full bg-secondary px-2 py-0.5 text-xs uppercase">{row.status}</span>
            </div>
          </div>

          <NetPayoutBadge
            budget={String(row.budget)}
            netPayout={String(row.net_payout ?? row.budget)}
            platformFeeBp={row.platform_fee_bp ?? 0}
            evaluatorFeeBp={row.evaluator_fee_bp ?? 0}
          />
          <p className="text-xs">
            <a href={arcscanTx} target="_blank" rel="noopener noreferrer" className="underline">
              Verify escrow on Arcscan ↗
            </a>
            {row.job_id !== null && <span className="ml-2 text-muted-foreground">job #{row.job_id}</span>}
          </p>

          <div className="whitespace-pre-wrap rounded-lg border p-4 text-sm leading-6">
            {row.body}
          </div>

          <CriteriaDisplay criteria={row.criteria as unknown as Criteria} />

          <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Answers</p>
            <p className="mt-1">
              Answer submission opens in the next release (Phase 3). The first answer that
              passes all criteria wins {row.net_payout ?? row.budget} USDC, paid instantly
              from escrow.
            </p>
          </div>
        </>
      )}
    </main>
  );
}

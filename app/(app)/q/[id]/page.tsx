import Link from "next/link";
import { notFound } from "next/navigation";
import { AnswerEditor } from "@/components/answer/answer-editor";
import { AnswerList } from "@/components/answer/answer-list";
import { Countdown } from "@/components/question/countdown";
import { CriteriaDisplay } from "@/components/question/criteria-display";
import { NetPayoutBadge } from "@/components/question/net-payout-badge";
import { QuestionStatusBadge } from "@/components/question/question-status-badge";
import { PayoutReceipt } from "@/components/receipt/payout-receipt";
import { ClaimRefundButton } from "@/components/refund/claim-refund-button";
import { SiteNav } from "@/components/site-nav";
import { getAnswersForQuestion } from "@/lib/answers/answer-queries";
import { toPublicAnswer } from "@/lib/answers/answer-types";
import { AGENTIC_COMMERCE } from "@/lib/chain/config";
import type { Criteria } from "@/lib/questions/criteria-schema";
import { isQuestionId } from "@/lib/questions/question-id";
import { getQuestionRow } from "@/lib/questions/question-api-helpers";

export const dynamic = "force-dynamic";

// Question title in the browser tab / link previews (judges share these).
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isQuestionId(id)) return { title: "Question" };
  const row = await getQuestionRow(id).catch(() => null);
  return { title: row?.title ?? "Question" };
}

// Public question page (server component). LIVE GUARD (yêu cầu 2): a
// question renders as accepting answers ONLY when status === 'open' - which
// the finalize route grants only after verifying Funded + budget > 0
// onchain. Drafts show a "not live" notice so nobody wastes effort.
// Snapshot of the request-time clock (page is force-dynamic - one snapshot
// per request; the live countdown is the client Countdown component).
function deadlineState(deadline: string) {
  const msLeft = Date.parse(deadline) - Date.now();
  return { deadlinePassed: msLeft <= 0, deadlineNear: msLeft < 10 * 60_000 };
}

export default async function QuestionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isQuestionId(id)) notFound();
  const row = await getQuestionRow(id);
  if (!row) notFound();

  const answers =
    row.status === "draft"
      ? []
      : (await getAnswersForQuestion(id)).map(toPublicAnswer);
  const accepted = answers.find((a) => a.status === "accepted");
  const { deadlinePassed, deadlineNear } = deadlineState(row.deadline);

  const arcscanTx = row.fund_tx
    ? `https://testnet.arcscan.app/tx/${row.fund_tx}`
    : `https://testnet.arcscan.app/address/${AGENTIC_COMMERCE}`;

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 p-6">
      <SiteNav />

      {row.status === "draft" ? (
        <div className="rounded-xl border border-pending-line bg-pending-bg p-6">
          <h1 className="t-display-20 text-pending">This question is not live yet</h1>
          <p className="t-body-14 mt-2 text-ink">
            The bounty escrow has not been funded onchain. It is not accepting answers -
            do not spend effort on it. If you are the asker,{" "}
            <Link href="/ask" className="text-brand underline">resume funding here</Link>.
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            <h1 className="t-display-40 text-ink">{row.title}</h1>
            <div className="flex flex-wrap items-center gap-3">
              <span className="t-hash text-muted-ink">{row.asker_address.slice(0, 6)}…{row.asker_address.slice(-4)}</span>
              <Countdown deadline={row.deadline} />
              <QuestionStatusBadge status={row.status} />
            </div>
          </div>

          <NetPayoutBadge
            budget={String(row.budget)}
            netPayout={String(row.net_payout ?? row.budget)}
            platformFeeBp={row.platform_fee_bp ?? 0}
            evaluatorFeeBp={row.evaluator_fee_bp ?? 0}
          />
          <p className="t-body-12-medium">
            <a href={arcscanTx} target="_blank" rel="noopener noreferrer" className="text-brand no-underline hover:underline">
              Verify escrow on Arcscan ↗
            </a>
            {row.job_id !== null && <span className="t-hash ml-2 text-faint">job #{row.job_id}</span>}
          </p>

          {/* Question body on a flat paper card - contrast, no border */}
          <div className="t-body-16 whitespace-pre-wrap rounded-xl bg-paper p-6 text-ink">
            {row.body}
          </div>

          <CriteriaDisplay criteria={row.criteria as unknown as Criteria} />

          {accepted && (
            <PayoutReceipt
              answer={accepted}
              netPayout={String(row.net_payout ?? row.budget)}
            />
          )}

          <section className="space-y-3 pt-4">
            <h2 className="t-display-24 text-ink">Answers ({answers.length})</h2>
            {/* PRD §6: the first-pass-wins rule is printed on every question
                page so racing is fair and legible. */}
            <p className="t-body-14 text-muted-ink">
              First answer that passes all criteria wins the bounty - evaluation
              order is submission order.
            </p>
            <AnswerList answers={answers} />
          </section>

          {row.status === "open" && !deadlinePassed ? (
            <section className="space-y-4 rounded-xl bg-paper p-6">
              {/* Wallet connect lives in the nav - no duplicate button here. */}
              <p className="t-display-20 text-ink">Your answer</p>
              {/* Soft nudge only - never blocks (M2 UX companion). */}
              {deadlineNear && (
                <p className="t-body-12-medium text-pending">
                  Deadline is near: evaluation may not finish in time.
                </p>
              )}
              <AnswerEditor questionId={row.id} />
            </section>
          ) : row.status === "expired" ? (
            // Refund path (opened by the daily cron sweep; PRD-ERRATA E3:
            // claimRefund is asker-wallet-only, the agent cannot do it).
            <section className="space-y-4 rounded-xl border border-pending-line bg-pending-bg p-6">
              <p className="t-body-16-medium text-pending">
                Question expired - no accepted answer. The asker can reclaim
                the escrowed bounty.
              </p>
              <ClaimRefundButton
                questionId={row.id}
                jobId={row.job_id!}
                askerAddress={row.asker_address}
              />
            </section>
          ) : row.status === "refunded" ? (
            <section className="space-y-2 rounded-xl bg-neutral-state-bg p-6">
              <p className="t-body-16-medium text-ink">Bounty refunded to the asker.</p>
              {row.refund_tx && (
                <p className="t-body-14 text-muted-ink">
                  refund tx:{" "}
                  <a
                    href={`https://testnet.arcscan.app/tx/${row.refund_tx}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="t-hash break-all text-brand no-underline hover:underline"
                  >
                    {row.refund_tx} ↗
                  </a>
                </p>
              )}
            </section>
          ) : (
            <p className="t-body-14 text-muted-ink">
              {row.status === "answered"
                ? "This question has an accepted answer - submissions are closed."
                : "The deadline has passed - submissions are closed pending the daily expiry sweep."}
            </p>
          )}
        </>
      )}
    </main>
  );
}

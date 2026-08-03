import { Pill } from "./pill";
import { Reveal } from "./reveal";

/**
 * The two tracks a bounty can take, in the same state names the app shows.
 * `open/answered/expired/refunded` are question states (see
 * components/question/question-status-badge.tsx); `payout pending/paid`
 * belong to the payout state machine that runs after acceptance.
 * Dot colour follows the money-state palette: amber while money is in
 * flight, green once settled, gray when closed with nothing owed.
 */
type Step = { state: string; body: string; tone: "pending" | "success" | "neutral" };

const PAID_TRACK: readonly Step[] = [
  {
    state: "open",
    tone: "pending",
    body: "Funded, live and counting down. Browse lists a question only after its escrow was verified onchain.",
  },
  {
    state: "answered",
    tone: "success",
    body: "An answer cleared every criterion. Evaluation runs in submission order, so the first pass wins.",
  },
  {
    state: "payout pending",
    tone: "pending",
    body: "The escrow released to the agent wallet and the forward to the winner is in flight. Retried by cron, and visible while it retries.",
  },
  {
    state: "paid",
    tone: "success",
    body: "The winner holds the USDC. The receipt links both transactions on Arcscan.",
  },
];

const REFUND_TRACK: readonly Step[] = [
  {
    state: "expired",
    tone: "neutral",
    body: "The deadline passed with no passing answer. A daily sweep flips the state; the escrow itself is claimable the second the deadline passes.",
  },
  {
    state: "refunded",
    tone: "neutral",
    body: "The asker claimed the bounty back straight from the contract. Refunds go to the asker - that is enforced onchain, not by us.",
  },
];

const DOT: Record<Step["tone"], string> = {
  pending: "bg-pending",
  success: "bg-success",
  neutral: "bg-neutral-state",
};

function Track({ steps, delay = 0 }: { steps: readonly Step[]; delay?: number }) {
  return (
    <div className="flex flex-col gap-4 min-[810px]:flex-row min-[810px]:gap-6">
      {steps.map((s, i) => (
        <Reveal key={s.state} variant="left" className="flex flex-1" delay={delay + i * 80}>
          <div className="flex h-full w-full flex-col gap-3 border-t border-line-3 pt-5">
            <div className="flex items-center gap-2">
              <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${DOT[s.tone]}`} />
              <span className="t-label text-ink">{s.state}</span>
            </div>
            <p className="t-body-14 text-muted-ink">{s.body}</p>
          </div>
        </Reveal>
      ))}
    </div>
  );
}

export function LifecycleSection() {
  return (
    <section className="flex flex-col gap-10 px-2 py-14 min-[810px]:py-20 min-[1200px]:px-10">
      <Reveal>
        <div className="flex flex-col gap-4">
          <Pill label="Every state is public" />
          <h2 className="t-display-40 text-ink min-[810px]:text-[56px] min-[810px]:leading-[60px] min-[810px]:tracking-[-2.24px]">
            Two ways this ends,
            <br />
            both of them visible
          </h2>
        </div>
      </Reveal>

      <div className="flex flex-col gap-12">
        <div className="flex flex-col gap-5">
          <span className="t-body-14-medium text-ink">If an answer passes</span>
          <Track steps={PAID_TRACK} />
        </div>

        <div className="flex flex-col gap-5">
          <span className="t-body-14-medium text-ink">If nothing passes</span>
          <Track steps={REFUND_TRACK} delay={80} />
        </div>
      </div>

      <Reveal variant="fade">
        <p className="t-body-14 border-t border-line-3 pt-6 text-faint">
          There is no third ending where the money sits with us. Every state
          above either pays the winner or returns the bounty to the asker, and
          a stuck payout stays loudly pending rather than quietly failing.
        </p>
      </Reveal>
    </section>
  );
}

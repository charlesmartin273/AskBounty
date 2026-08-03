import { Pill } from "./pill";
import { Reveal } from "./reveal";

/**
 * The trade-offs, on the marketing page rather than buried in the README.
 * Every item restates a disclosed limitation from README ("Known limitation")
 * - if one of them stops being true, delete the card, do not soften it.
 */
const TRADE_OFFS = [
  {
    title: "The agent is provider and evaluator",
    body: "The shared ERC-8183 contract fixes the provider when the job is created, and the winner is unknown until after funding. So the escrow releases to the agent wallet, which forwards the exact amount on. Both transactions are public, which is what makes the claim checkable rather than trusted.",
  },
  {
    title: "Pending answers are readable",
    body: "Answers are public while they wait. Acceptance follows submission order, so copying someone's pending answer cannot outrank the original. Private submissions are a v2 item, not a solved problem today.",
  },
  {
    title: "The evaluator has no live knowledge",
    body: "Questions that turn on today's prices or this morning's news are out of scope. When the evaluator cannot judge reliably it fails closed: nothing is paid, the bounty stays in escrow and refunds at the deadline.",
  },
  {
    title: "Expiry is swept once a day",
    body: "A daily cron flips past-deadline questions to expired, so the refund button can lag the deadline by up to 24 hours. Browse already hides past-deadline questions, and the escrow is claimable the moment the deadline passes.",
  },
  {
    title: "No early cancel yet",
    body: "An asker gets their funds back through the expiry refund, so nothing can be stranded. A cancel button would add convenience, not safety - which is why it is v2 and not a launch blocker.",
  },
  {
    title: "Resubmitting has a cooldown",
    body: "One submission per wallet per question per minute. It is a spam guard that runs before the costly evaluation path, so a failed attempt costs you a minute, not a fee.",
  },
] as const;

export function LimitationsSection() {
  return (
    <section className="flex flex-col gap-10 px-2 py-14 min-[810px]:py-20 min-[1200px]:px-10">
      <Reveal>
        <div className="flex flex-col gap-4">
          <Pill label="Known trade-offs" />
          <h2 className="t-display-40 text-ink min-[810px]:text-[56px] min-[810px]:leading-[60px] min-[810px]:tracking-[-2.24px]">
            What we do not
            <br />
            claim yet
          </h2>
          <p className="t-body-16 max-w-[560px] text-muted-ink">
            Escrow is the part that has to be trustless, and it is. Everything
            below is a trade-off we made on purpose, written down so you can
            price it yourself.
          </p>
        </div>
      </Reveal>

      {/* Two columns of hairline blocks - denser than the card rows above */}
      <div className="grid gap-x-12 gap-y-2 min-[810px]:grid-cols-2">
        {TRADE_OFFS.map((t, i) => (
          <Reveal key={t.title} variant="fade" delay={(i % 2) * 80}>
            <div className="flex flex-col gap-2 border-t border-line-3 py-6">
              <h3 className="t-body-16-medium text-ink">{t.title}</h3>
              <p className="t-body-14 text-muted-ink">{t.body}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

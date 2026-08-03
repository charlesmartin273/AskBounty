import { Pill } from "./pill";
import { Reveal } from "./reveal";

// FAQ on native <details> - zero client JS, works with the marketing
// group's no-wagmi/no-hydration constraint. Answers restate README facts.
const FAQ = [
  {
    q: "Is my money actually safe?",
    a: "The bounty sits in the shared ERC-8183 AgenticCommerce contract, not in anyone's wallet. Once the deadline passes, the refund is claimable straight from the contract - the escrow always has an exit path, so funds can never be stranded.",
  },
  {
    q: "What does it cost to answer?",
    a: "Nothing. You sign a message with your wallet - no gas, no stake, no fee. If your answer fails the checks you get per-check reasons, and you can fix and resubmit after a short cooldown.",
  },
  {
    q: "How does the AI decide who gets paid?",
    a: "Objective checks run first (word count, code blocks). Only answers that pass reach the LLM, which judges the asker's written criteria and returns a verdict with quotes as evidence. When it cannot judge reliably it fails closed - the money stays in escrow.",
  },
  {
    q: "Why does every payout have two transactions?",
    a: "The contract releases the escrow to the agent wallet (the registered provider), and the agent immediately forwards the exact released amount to the winner. Both transactions are linked on the receipt, so anyone can verify the agent kept nothing.",
  },
  {
    q: "What happens if nobody answers in time?",
    a: "A daily sweep flips past-deadline questions to expired, and the asker claims the refund from the contract. Refunds always go to the asker - that is enforced onchain, not by us.",
  },
  {
    q: "Which network does this run on?",
    a: "Arc Testnet (chain ID 5042002). USDC is both the bounty currency and the gas token - one visit to faucet.circle.com covers everything you need to try it.",
  },
] as const;

export function FaqSection() {
  return (
    <section className="flex flex-col gap-10 px-2 py-14 min-[810px]:flex-row min-[810px]:justify-between min-[810px]:gap-12 min-[810px]:py-20 min-[1200px]:px-10">
      <Reveal className="min-[810px]:w-[400px] min-[810px]:shrink-0">
        <div className="flex flex-col gap-4">
          <Pill label="FAQ" />
          <h2 className="t-display-40 text-ink">
            Questions?
            <br />
            Fair - it&apos;s the product
          </h2>
        </div>
      </Reveal>

      {/* Cap the accordion column so lines stay readable on wide screens */}
      <div className="flex flex-1 flex-col min-[1200px]:max-w-[760px]">
        {FAQ.map((item, i) => (
          // Quiet plain fade - the accordion itself is the motion here
          <Reveal key={item.q} variant="fade" delay={i * 60}>
            <details className="group border-b border-line-3 py-5">
            <summary className="flex cursor-pointer list-none items-center gap-3 [&::-webkit-details-marker]:hidden">
              <span className="t-display-24 w-7 shrink-0 text-faint">{i + 1}</span>
              <span className="t-body-16-medium flex-1 text-ink">{item.q}</span>
              {/* Plus rotates to x when open - pure CSS, no JS */}
              <span
                aria-hidden="true"
                className="flex size-8 shrink-0 items-center justify-center rounded-full bg-paper text-faint transition-transform duration-300 ease-[cubic-bezier(0.44,0,0.56,1)] group-open:rotate-45"
              >
                +
              </span>
            </summary>
              {/* Inset 40px = number column 28px + gap 12px */}
              <p className="t-body-14 pt-3 pl-10 text-muted-ink">{item.a}</p>
            </details>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

import {
  AGENTIC_COMMERCE,
  ARC_CHAIN_ID,
  USDC_ADDRESS,
  USDC_DECIMALS,
  arcscanAddressUrl,
} from "@/lib/chain/config";
import { Pill } from "./pill";
import { Reveal } from "./reveal";

/**
 * Spec sheet for anyone who wants to check the claims instead of reading
 * them. Addresses and chain id are imported from lib/chain/config so this
 * section cannot drift from what the app actually talks to - never retype
 * them here.
 */
const ADDRESSES = [
  {
    label: "AgenticCommerce · ERC-8183",
    value: AGENTIC_COMMERCE,
    note: "The shared, pre-deployed escrow contract. We hold no admin role on it - the fee parameters and the refund path are not ours to change.",
  },
  {
    label: `USDC · ERC-20, ${USDC_DECIMALS} decimals`,
    value: USDC_ADDRESS,
    note: "Bounty currency and gas token at once. On Arc you do not hold a second asset just to move the first, so one faucet visit covers both sides of a demo.",
  },
] as const;

/** Every point where money moves is one of these calls, all public. */
const ONCHAIN_MOVES = [
  { call: "createJob + fund", when: "when the question is posted" },
  { call: "complete()", when: "when an answer passes" },
  { call: "transfer", when: "agent forwards the released amount to the winner" },
  { call: "claimRefund()", when: "when the deadline passed with no pass" },
] as const;

/** Written the way the README states it - no upgrades, no adjectives. */
const STACK = [
  "Next.js App Router · TypeScript · Tailwind + shadcn/ui",
  "viem / wagmi for every chain read and write",
  "Supabase - service-role writes only, RLS denies client writes",
  "Google Gemini API (free tier) for answer evaluation",
  "Vercel, with a daily cron for the expiry sweep",
] as const;

function ExplorerLink({ address }: { address: string }) {
  return (
    <a
      href={arcscanAddressUrl(address)}
      target="_blank"
      rel="noopener noreferrer"
      className="t-hash break-all text-ink underline decoration-line-4 underline-offset-4 transition-colors duration-300 hover:decoration-brand"
    >
      {address}
    </a>
  );
}

export function UnderTheHoodSection() {
  return (
    <section className="flex flex-col gap-10 px-2 py-14 min-[810px]:py-20 min-[1200px]:px-10">
      <Reveal>
        <div className="flex flex-col gap-4">
          <Pill label="Under the hood" />
          <h2 className="t-display-40 text-ink min-[810px]:text-[56px] min-[810px]:leading-[60px] min-[810px]:tracking-[-2.24px]">
            Check it yourself,
            <br />
            do not take our word
          </h2>
          <p className="t-body-16 max-w-[620px] text-muted-ink">
            Every spending decision this agent makes is a transaction on a
            public chain. Open the contract on Arcscan and you can replay the
            whole history without asking us for anything - our database is a
            cache of that, never the source of truth.
          </p>
        </div>
      </Reveal>

      {/* Network + the two addresses that matter, straight from lib/chain/config */}
      <div className="flex flex-col gap-4 min-[810px]:flex-row min-[810px]:gap-6">
        <Reveal variant="scale" className="flex min-[810px]:w-[280px] min-[810px]:shrink-0">
          <div className="flex h-full w-full flex-col gap-3 rounded-t-xl rounded-b-4xl bg-paper p-8">
            <span className="t-label text-faint">Network</span>
            <span className="t-display-24 text-ink">Arc Testnet</span>
            <span className="t-hash text-muted-ink">chain id {ARC_CHAIN_ID}</span>
          </div>
        </Reveal>

        <div className="flex flex-1 flex-col">
          {ADDRESSES.map((a, i) => (
            <Reveal key={a.label} variant="left" delay={i * 80}>
              <div className="flex flex-col gap-2 border-b border-line-3 py-6">
                <span className="t-label text-faint">{a.label}</span>
                <ExplorerLink address={a.value} />
                <p className="t-body-14 max-w-[640px] text-muted-ink">{a.note}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>

      {/* The four money-moving calls, then the stack behind them */}
      <div className="flex flex-col gap-10 min-[810px]:flex-row min-[810px]:gap-12">
        <Reveal variant="fade" className="flex-1">
          <div className="flex flex-col gap-4">
            <span className="t-body-14-medium text-ink">
              Where money moves, and nowhere else
            </span>
            <ul className="flex flex-col gap-3">
              {ONCHAIN_MOVES.map((m) => (
                <li key={m.call} className="flex flex-col gap-1 border-t border-line-3 pt-3">
                  <span className="t-hash text-ink">{m.call}</span>
                  <span className="t-body-14 text-muted-ink">{m.when}</span>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>

        <Reveal variant="fade" delay={80} className="flex-1">
          <div className="flex flex-col gap-4">
            <span className="t-body-14-medium text-ink">What runs off-chain</span>
            <ul className="flex flex-col gap-3">
              {STACK.map((s) => (
                <li key={s} className="flex items-start gap-3 border-t border-line-3 pt-3">
                  <span
                    aria-hidden="true"
                    className="mt-[7px] size-1.5 shrink-0 rounded-full bg-brand"
                  />
                  <span className="t-body-14 text-muted-ink">{s}</span>
                </li>
              ))}
            </ul>
            <p className="t-body-14 text-faint">
              The PRD specifies the Claude API for evaluation; the demo runs on
              the Gemini free tier for cost. The eval client is
              provider-swappable - same input, same structured verdict.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

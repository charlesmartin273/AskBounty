import type { CSSProperties } from "react";
import { LandingNav } from "@/components/landing-nav";
import { AudienceSection } from "@/components/landing/audience-section";
import { CriteriaSection } from "@/components/landing/criteria-section";
import { FaqSection } from "@/components/landing/faq-section";
import { GiantWordmark } from "@/components/landing/giant-wordmark";
import { HeroBackdrop, HeroCorners, HeroFlow } from "@/components/landing/hero-flow";
import { HeroHeadline } from "@/components/landing/hero-headline";
import { LifecycleSection } from "@/components/landing/lifecycle-section";
import { LimitationsSection } from "@/components/landing/limitations-section";
import { MarqueeStrip } from "@/components/landing/marquee-strip";
import { MoneyMathSection } from "@/components/landing/money-math-section";
import { Pill } from "@/components/landing/pill";
import { PipelineSection } from "@/components/landing/pipeline-section";
import { Reveal } from "@/components/landing/reveal";
import { SlideButton } from "@/components/landing/slide-button";
import { StatsStrip } from "@/components/landing/stats-strip";
import { UnderTheHoodSection } from "@/components/landing/under-the-hood-section";
import { arcscanAddressUrl } from "@/lib/chain/config";

/** Inline mount-delay for the CSS entrance cascade (above the fold only). */
const enterDelay = (ms: number) => ({ "--enter-delay": `${ms}ms` }) as CSSProperties;

/** One step of the money flow. Asymmetric radius (t-24/b-48) is the signature. */
function StepCard({
  index,
  title,
  body,
}: {
  index: string;
  title: string;
  body: string;
}) {
  return (
    // h-full/w-full: the Reveal wrapper owns the flex-1 slot in the row
    <div className="flex h-full w-full flex-col gap-6 rounded-t-xl rounded-b-4xl bg-paper p-8 min-[810px]:p-10">
      <span className="t-display-32 text-faint">{index}</span>
      <div className="flex flex-col gap-3">
        <h3 className="t-display-24 text-ink">{title}</h3>
        <p className="t-body-14 text-muted-ink">{body}</p>
      </div>
    </div>
  );
}

// Landing: marketing page for strangers. No wallet, no wagmi - the single
// job is to show the vibe and push visitors into the app at /browse.
export default function Landing() {
  return (
    // Orionix container width: 1560px with slim outer gutters - shells and
    // panels reach toward the screen edges instead of floating mid-page.
    <main className="mx-auto flex w-full max-w-[1560px] flex-1 flex-col gap-4 px-3 pb-12 min-[810px]:px-6">
      <LandingNav />

      {/* Hero - rounded shell on cream, hairline border, no shadow. Fills
          the first viewport (Orionix h-screen hero): copy centred in the
          leftover space, chain facts pinned to the shell's bottom edge. */}
      {/* Height budget: nav 96 + hero + marquee =~ one viewport frame */}
      <section className="relative flex min-h-[460px] flex-col items-center overflow-clip rounded-[24px] border border-line bg-paper/40 px-6 pt-10 pb-6 min-[810px]:min-h-[calc(100svh-320px)] min-[810px]:rounded-[40px] min-[810px]:px-16 min-[810px]:pb-8">
        {/* Depth: soft washes + film grain, the animated money flow, and
            editorial corner marks framing the canvas */}
        <HeroBackdrop />
        <HeroFlow />
        <HeroCorners />

        {/* Mount cascade: pill → per-character headline → sub → CTAs → facts.
            All pure CSS keyframes with inline delays - no client JS. */}
        <div className="z-[1] flex flex-1 flex-col items-center justify-center gap-6 text-center">
          <div className="animate-enter" style={enterDelay(0)}>
            <Pill label="Agentic escrow · Arc Testnet" />
          </div>
          <HeroHeadline />
          <p
            className="t-body-16 animate-enter max-w-[560px] text-muted-ink"
            style={enterDelay(550)}
          >
            Ask a question and lock a USDC bounty in onchain escrow. An AI agent
            judges answers against your criteria and pays the first one that
            passes - no waiting, no rug-pulls.
          </p>

          <div
            className="animate-enter mt-4 flex flex-col items-center gap-3 min-[810px]:flex-row"
            style={enterDelay(700)}
          >
            <SlideButton href="/browse" label="Launch app" variant="black" />
            <SlideButton href="/ask" label="Ask a question" variant="white" />
          </div>
        </div>

        {/* Chain facts bar - mono voice for anything onchain */}
        <div
          className="animate-enter z-[1] mt-8 flex w-full flex-col items-center justify-between gap-3 border-t border-line-2 pt-5 min-[810px]:flex-row"
          style={enterDelay(850)}
        >
          <span className="t-label text-muted-ink">
            Network <span className="text-ink">Arc Testnet · 5042002</span>
          </span>
          <span className="t-label text-muted-ink">
            Escrow <span className="t-hash text-ink">0x0747…4583</span> · ERC-8183
          </span>
          <span className="t-label text-muted-ink">
            Gas token <span className="text-ink">USDC</span>
          </span>
        </div>
      </section>

      {/* Full-bleed Fraunces marquee - completes the first viewport frame */}
      <MarqueeStrip />

      {/* Protocol guarantees as display numbers */}
      <StatsStrip />

      {/* How it works */}
      <section className="flex flex-col gap-10 px-2 py-14 min-[810px]:py-20 min-[1200px]:px-10">
        <Reveal>
          <div className="flex flex-col gap-4">
            <Pill label="How it works" />
            <h2 className="t-display-40 text-ink min-[810px]:text-[56px] min-[810px]:leading-[60px] min-[810px]:tracking-[-2.24px]">
              Money and criteria,
              <br />
              locked together upfront
            </h2>
          </div>
        </Reveal>

        {/* Cards settle into place (scale 0.95 -> 1), 120ms apart */}
        <div className="flex flex-col gap-4 min-[810px]:flex-row min-[810px]:gap-6">
          <Reveal variant="scale" className="flex flex-1">
            <StepCard
              index="01"
              title="Ask & lock"
              body="Post your question with written criteria and fund the bounty. USDC sits in ERC-8183 escrow from the first second - askers cannot rug-pull answerers."
            />
          </Reveal>
          <Reveal variant="scale" className="flex flex-1" delay={120}>
            <StepCard
              index="02"
              title="Answer free"
              body="Anyone can answer by signing a message. No gas, no stake, no fee - submitting costs nothing but the effort of being right."
            />
          </Reveal>
          <Reveal variant="scale" className="flex flex-1" delay={240}>
            <StepCard
              index="03"
              title="Agent pays"
              body="Objective checks run first, then an LLM judges your criteria and returns a verdict with quoted evidence. First pass gets paid on the spot."
            />
          </Reveal>
        </div>
      </section>

      {/* Fee / net-payout guarantees, straight after the three steps */}
      <MoneyMathSection />

      {/* Asker / answerer value props */}
      <AudienceSection />

      {/* Evaluation pipeline */}
      <PipelineSection />

      {/* What the asker can pin down - reads as the pipeline's input side */}
      <CriteriaSection />

      {/* Both endings of the money, in the app's own state names */}
      <LifecycleSection />

      {/* Trade-offs stated before the FAQ starts answering objections */}
      <LimitationsSection />

      {/* FAQ - answered before the closing CTA asks for the click */}
      <FaqSection />

      {/* Trust panel + closing CTA - the one dark surface on the page.
          No bottom padding: the fused wordmark forms the bottom edge. */}
      <section className="flex flex-col gap-10 overflow-clip rounded-[32px] bg-ink px-6 pt-10 min-[810px]:px-16 min-[810px]:pt-16">
        <Reveal>
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <span aria-hidden="true" className="size-2 rounded-full bg-brand" />
              <span className="t-label text-white">Verifiable by anyone</span>
            </div>
            <h2 className="t-display-32 text-cream min-[810px]:text-[48px] min-[810px]:leading-[52px] min-[810px]:tracking-[-1.92px]">
              The agent keeps nothing.
            </h2>
            <p className="t-body-16 max-w-[560px] text-on-dark-muted">
              Every payout is two onchain transactions: escrow releases to the
              agent wallet, and the agent forwards the exact released amount to
              the winner. Both are linked on every receipt, so anyone can verify
              the agent retained zero. No pass by the deadline? The bounty
              refunds to the asker straight from the contract.
            </p>
          </div>
        </Reveal>

        <Reveal delay={120}>
          <div className="flex flex-col items-start justify-between gap-6 border-t border-line-inv pt-6 min-[810px]:flex-row min-[810px]:items-center">
            <div className="flex flex-col gap-1">
              <span className="t-label text-on-dark-muted">Agent wallet</span>
              {/* Linked, not just printed: the claim above is only checkable
                  if the reader can open the wallet's history themselves. */}
              <a
                href={arcscanAddressUrl("0x8065E80AE2155412d896A5FF761933F8D129c200")}
                target="_blank"
                rel="noopener noreferrer"
                className="t-hash break-all text-white underline decoration-line-inv underline-offset-4 transition-colors duration-300 hover:decoration-brand"
              >
                0x8065E80AE2155412d896A5FF761933F8D129c200
              </a>
            </div>
            <SlideButton href="/browse" label="Browse open bounties" variant="white" />
          </div>
        </Reveal>

        {/* Oversized wordmark rising out of the panel's bottom edge -
            blur-in like the Orionix logo rows */}
        <Reveal blur delay={200}>
          <GiantWordmark />
        </Reveal>
      </section>

      {/* Verifiable spec sheet - last stop before the footer */}
      <UnderTheHoodSection />

      {/* Footer line */}
      <footer className="flex flex-col items-start justify-between gap-2 border-t border-line-3 px-2 pt-6 min-[810px]:flex-row min-[810px]:items-center">
        <p className="t-body-14 text-muted-ink">
          AskBounty - built for the Build on Arc hackathon, Agentic Economy track.
        </p>
        <p className="t-body-14 text-muted-ink">
          Faucet:{" "}
          <a
            href="https://faucet.circle.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand no-underline hover:underline"
          >
            faucet.circle.com
          </a>{" "}
          · Explorer:{" "}
          <a
            href="https://testnet.arcscan.app"
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand no-underline hover:underline"
          >
            arcscan.app
          </a>
        </p>
      </footer>
    </main>
  );
}

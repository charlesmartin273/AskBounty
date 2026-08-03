import { Pill } from "./pill";
import { Reveal } from "./reveal";

// Two-sided value prop: asker card on paper, answerer card on ink - the one
// dark card in the grid, echoing the Orionix pricing highlight pattern.
const ASKER_POINTS = [
  "Your USDC locks in ERC-8183 escrow the moment the question goes live",
  "The criteria you write are the contract - the agent judges nothing else",
  "Live fee read at posting; the promised net payout never changes after",
  "Nothing passes by the deadline? Claim the refund straight from the contract",
] as const;

const ANSWERER_POINTS = [
  "See the money locked onchain before you write a single word",
  "Submitting is free - you sign a message, no gas, no stake",
  "Per-check feedback on every attempt; fix and resubmit after the cooldown",
  "Paid the instant your answer passes - straight to your wallet",
] as const;

function CheckList({ points, dark }: { points: readonly string[]; dark?: boolean }) {
  return (
    <ul className="flex flex-col gap-3">
      {points.map((p) => (
        <li key={p} className="flex items-start gap-3">
          {/* Brand-red dot markers on both cards - reads on ink and paper */}
          <span aria-hidden="true" className="mt-[7px] size-1.5 shrink-0 rounded-full bg-brand" />
          <span className={`t-body-14 ${dark ? "text-on-dark-muted" : "text-muted-ink"}`}>
            {p}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function AudienceSection() {
  return (
    <section className="flex flex-col gap-10 px-2 py-14 min-[810px]:py-20 min-[1200px]:px-10">
      <Reveal>
        <div className="flex flex-col gap-4">
          <Pill label="Both sides of the trade" />
          <h2 className="t-display-40 text-ink min-[810px]:text-[56px] min-[810px]:leading-[60px] min-[810px]:tracking-[-2.24px]">
            Fair by construction,
            <br />
            for askers and answerers
          </h2>
        </div>
      </Reveal>

      <div className="flex flex-col gap-4 min-[810px]:flex-row min-[810px]:gap-6">
        {/* Asker card - paper, slides in from the left wing */}
        <Reveal variant="left" className="flex flex-1">
          <div className="flex h-full w-full flex-col gap-6 rounded-t-xl rounded-b-4xl bg-paper p-8 min-[810px]:p-10">
            <div className="flex flex-col gap-2">
              <span className="t-label text-faint">If you ask</span>
              <h3 className="t-display-24 text-ink">Escrow proves you mean it</h3>
            </div>
            <CheckList points={ASKER_POINTS} />
          </div>
        </Reveal>

        {/* Answerer card - the one dark card, mirrors in from the right */}
        <Reveal variant="right" className="flex flex-1" delay={120}>
          <div className="flex h-full w-full flex-col gap-6 rounded-t-xl rounded-b-4xl bg-ink p-8 min-[810px]:p-10">
            <div className="flex flex-col gap-2">
              <span className="t-label text-on-dark-muted">If you answer</span>
              <h3 className="t-display-24 text-cream">Never work for a maybe</h3>
            </div>
            <CheckList points={ANSWERER_POINTS} dark />
          </div>
        </Reveal>
      </div>
    </section>
  );
}

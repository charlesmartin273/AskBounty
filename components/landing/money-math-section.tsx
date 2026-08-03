import { Pill } from "./pill";
import { Reveal } from "./reveal";

/**
 * Where the bounty actually goes. Deliberately carries NO amounts: fees are
 * read from the contract at posting time and differ per question, so any
 * number printed here would be a lie the moment an admin changes a fee BP.
 * Each row states the guarantee instead - sourced from the payout rules in
 * README plus components/question/net-payout-badge.tsx.
 */
const LEDGER = [
  {
    tag: "locked",
    title: "The bounty",
    body: "Funded into ERC-8183 escrow before the question is visible to anyone. A question only reaches the browse list after its escrow is verified onchain.",
  },
  {
    tag: "read at posting",
    title: "Protocol fees",
    body: "Platform and evaluator fee basis points are read live from the contract when you post, then frozen into the question. Nothing is hardcoded, and they are never re-read afterwards.",
  },
  {
    tag: "promised upfront",
    title: "What the winner receives",
    body: "Printed on the question page before anyone writes a word. Because the fees were snapshotted at creation, a later fee change cannot shrink the number your answerers were promised.",
  },
  {
    tag: "agent pays",
    title: "Gas on the forward hop",
    body: "The agent wallet absorbs the gas of forwarding the payout. It is never deducted from the winner - USDC is the gas token on Arc, so this would otherwise come out of the same balance.",
  },
] as const;

export function MoneyMathSection() {
  return (
    <section className="flex flex-col gap-10 px-2 py-14 min-[810px]:py-20 min-[1200px]:px-10">
      <Reveal>
        <div className="flex flex-col gap-4">
          <Pill label="The money math" />
          <h2 className="t-display-40 text-ink min-[810px]:text-[56px] min-[810px]:leading-[60px] min-[810px]:tracking-[-2.24px]">
            The number you see
            <br />
            is the number you get
          </h2>
        </div>
      </Reveal>

      {/* Receipt-style panel: hairline rows, mono tags in the right column */}
      <Reveal variant="scale">
        <div className="flex flex-col rounded-t-xl rounded-b-4xl bg-paper p-6 min-[810px]:p-10">
          {LEDGER.map((row, i) => (
            <div
              key={row.title}
              className={`flex flex-col gap-3 py-6 min-[810px]:flex-row min-[810px]:items-start min-[810px]:gap-10 ${
                i > 0 ? "border-t border-line-3" : "pt-0"
              }`}
            >
              <span className="t-label w-full shrink-0 text-faint min-[810px]:w-40">
                {row.tag}
              </span>
              <div className="flex flex-col gap-2">
                <h3 className="t-body-16-medium text-ink">{row.title}</h3>
                <p className="t-body-14 max-w-[640px] text-muted-ink">{row.body}</p>
              </div>
            </div>
          ))}

          {/* The awkward case, stated rather than hidden */}
          <p className="t-body-14 border-t border-line-3 pt-6 text-faint">
            If the escrow ever releases an amount that differs from that
            snapshot, the full released amount is still forwarded and the
            receipt shows both numbers. An ambiguous release fails loud instead
            of guessing.
          </p>
        </div>
      </Reveal>
    </section>
  );
}

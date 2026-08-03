import { Pill } from "./pill";
import { Reveal } from "./reveal";

// The evaluation pipeline as numbered hairline rows (Orionix FAQ-row
// rhythm). Mirrors the actual eval order in lib/eval - do not reorder.
const STAGES = [
  {
    n: "1",
    title: "Objective checks, free and instant",
    body: "Minimum word count and required code blocks are verified mechanically. Answers that fail never reach the LLM - no tokens burned on lazy submissions.",
  },
  {
    n: "2",
    title: "LLM verdict on your written criteria",
    body: "The agent judges each criteria topic and returns a structured verdict - pass or fail per topic, with quotes from the answer as evidence you can read.",
  },
  {
    n: "3",
    title: "Uncertain? Fail closed",
    body: "If the evaluator cannot judge reliably, nothing is paid. The bounty stays in escrow and refunds at the deadline - funds are never misdirected.",
  },
] as const;

export function PipelineSection() {
  return (
    <section className="flex flex-col gap-10 px-2 py-14 min-[810px]:flex-row min-[810px]:justify-between min-[810px]:gap-12 min-[810px]:py-20 min-[1200px]:px-10">
      <Reveal className="min-[810px]:w-[400px] min-[810px]:shrink-0">
        <div className="flex flex-col gap-4">
          <Pill label="The evaluation" />
          <h2 className="t-display-40 text-ink">
            Checks first,
            <br />
            judgement second
          </h2>
          <p className="t-body-14 text-muted-ink">
            Every answer runs the same pipeline, in submission order. The full
            verdict is public on the question page - nothing is decided off the
            record.
          </p>
        </div>
      </Reveal>

      {/* Cap the row column so lines stay readable on wide screens */}
      <div className="flex flex-1 flex-col min-[1200px]:max-w-[760px]">
        {STAGES.map((s, i) => (
          // Numbered rows read left-to-right, so they enter from the left
          <Reveal key={s.n} variant="left" delay={i * 80}>
            <div className="flex gap-4 border-b border-line-3 py-6">
              <span className="t-display-32 w-8 shrink-0 text-faint">{s.n}</span>
              <div className="flex flex-col gap-2">
                <h3 className="t-body-16-medium text-ink">{s.title}</h3>
                <p className="t-body-14 text-muted-ink">{s.body}</p>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

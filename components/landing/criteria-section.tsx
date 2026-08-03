import { Pill } from "./pill";
import { Reveal } from "./reveal";
import { SlideButton } from "./slide-button";

/**
 * What an asker can actually pin down, mirroring the three controls in
 * components/ask/criteria-builder.tsx. Keep in sync with that file - this
 * section promises exactly what the builder offers, nothing more.
 */
const CONTROLS = [
  {
    label: "Mechanical",
    title: "Minimum words",
    body: "Counted before the LLM ever sees the answer. One-line drive-bys are rejected for free - no tokens burned, no waiting.",
  },
  {
    label: "Mechanical",
    title: "Code sample required",
    body: "Demand a code block, optionally pinned to a language. Also checked mechanically, so a missing sample fails instantly with a reason.",
  },
  {
    label: "Judged",
    title: "Up to 10 required topics",
    body: "Each topic is judged on its own and comes back pass or fail with a quote from the answer as evidence. You read the same verdict the answerer does.",
  },
] as const;

export function CriteriaSection() {
  return (
    <section className="flex flex-col gap-10 px-2 py-14 min-[810px]:py-20 min-[1200px]:px-10">
      <Reveal>
        <div className="flex flex-col gap-4">
          <Pill label="Writing a question" />
          <h2 className="t-display-40 text-ink min-[810px]:text-[56px] min-[810px]:leading-[60px] min-[810px]:tracking-[-2.24px]">
            Your criteria
            <br />
            are the contract
          </h2>
          <p className="t-body-16 max-w-[560px] text-muted-ink">
            Criteria freeze the moment the question goes live, and the agent
            judges nothing else. Vague question, vague verdict - so the builder
            gives you three things to be concrete about.
          </p>
        </div>
      </Reveal>

      <div className="flex flex-col gap-4 min-[810px]:flex-row min-[810px]:gap-6">
        {CONTROLS.map((c, i) => (
          <Reveal key={c.title} variant="scale" className="flex flex-1" delay={i * 120}>
            <div className="flex h-full w-full flex-col gap-5 rounded-t-xl rounded-b-4xl bg-paper p-8 min-[810px]:p-10">
              <span className="t-label text-faint">{c.label}</span>
              <div className="flex flex-col gap-3">
                <h3 className="t-display-24 text-ink">{c.title}</h3>
                <p className="t-body-14 text-muted-ink">{c.body}</p>
              </div>
            </div>
          </Reveal>
        ))}
      </div>

      <Reveal variant="fade" delay={200}>
        <div className="flex flex-col items-start justify-between gap-6 border-t border-line-3 pt-6 min-[810px]:flex-row min-[810px]:items-center">
          <p className="t-body-14 max-w-[640px] text-muted-ink">
            Set none of them and the agent falls back to judging whether the
            answer actually answers your question. That works - it is just less
            predictable than criteria you wrote down yourself.
          </p>
          <SlideButton href="/ask" label="Write a question" variant="black" />
        </div>
      </Reveal>
    </section>
  );
}

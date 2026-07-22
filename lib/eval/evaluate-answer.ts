import type { Criteria } from "../questions/criteria-schema";
import { callLlm, LlmEvalError, VERDICT_SCHEMA } from "./llm-client";
import { buildReviewPrompt, type QuestionContext } from "./llm-review-prompt";
import { runObjectiveChecks, type CheckResult } from "./objective-checks";
import { validateVerdict, VerdictValidationError } from "./verdict-validation";

// Evaluation orchestrator: objective checks gate the LLM call (spam/cost
// control, PRD §6), the LLM verdict is one signal (PRD §3), and every failure
// path is fail-closed (M3). The `llm` transport is injectable so the
// fail-closed E2E can push crafted bad outputs through the REAL code path.

export type LlmCaller = (args: {
  system: string;
  user: string;
  schema?: object;
}) => Promise<unknown>;

export interface EvalError {
  code: string;
  message: string;
  retryable: boolean;
}

export interface EvalOutcome {
  // pass  -> all objective checks + LLM verdict passed
  // fail  -> a check failed; the answer is definitively rejected
  // error -> evaluation could not complete; answer stays pending + retryable
  outcome: "pass" | "fail" | "error";
  results: CheckResult[];
  error?: EvalError;
}

export async function evaluateAnswer(
  body: string,
  criteria: Criteria,
  question: QuestionContext,
  llm: LlmCaller = callLlm,
): Promise<EvalOutcome> {
  // Objective checks ALWAYS run first, in code, independent of the LLM —
  // the LLM is one signal, never the sole decider (holds for empty topics
  // too: min_words / has_code_block gate below applies unchanged).
  const results = runObjectiveChecks(body, criteria);
  if (results.some((r) => !r.pass)) {
    return { outcome: "fail", results }; // LLM deliberately NOT called
  }
  try {
    const raw = await llm({
      ...buildReviewPrompt(body, criteria, question),
      schema: VERDICT_SCHEMA,
    });
    const verdict = validateVerdict(raw); // M3: throws on any shape violation
    // Belt-and-braces: overall=true only counts when every topic is covered.
    const pass = verdict.overall && verdict.topics.every((t) => t.covered);
    const topicSummary = verdict.topics
      .map((t) => `${t.covered ? "✓" : "✗"} ${t.topic}`)
      .join(" · ");
    results.push({
      check: "topics_covered",
      pass,
      detail: `${topicSummary}${topicSummary ? " — " : ""}${verdict.reasoning}`.slice(0, 1000),
    });
    return { outcome: pass ? "pass" : "fail", results };
  } catch (err) {
    if (err instanceof LlmEvalError) {
      return {
        outcome: "error",
        results,
        error: {
          code: err.code,
          // Single line, capped — this string lands in publicly readable
          // eval_results (review L4), so keep provider payloads terse.
          message: err.message.replace(/\s+/g, " ").slice(0, 200),
          retryable: err.retryable,
        },
      };
    }
    if (err instanceof VerdictValidationError) {
      return {
        outcome: "error",
        results,
        error: { code: "bad_response", message: err.message, retryable: false },
      };
    }
    // Unknown failure: still fail-closed — never accepted, manual retry only.
    return {
      outcome: "error",
      results,
      error: {
        code: "internal",
        message: String(err).slice(0, 500),
        retryable: false,
      },
    };
  }
}

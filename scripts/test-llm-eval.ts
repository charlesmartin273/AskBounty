// Requirement 6 of the Gemini switch: evaluate 2 sample answers against the
// PRD §1 example criteria and print raw verdict JSON as evidence.
// Run: npx tsx scripts/test-llm-eval.ts
import { config } from "dotenv";
config({ path: ".env.local" });

import { callLlm, VERDICT_SCHEMA, type LlmVerdict } from "../lib/eval/llm-client";

const CRITERIA_TOPICS = ["chunked ranges", "failure handling"];

// PRD §1 example: pass needs working TS sample + both topics covered.
const GOOD_ANSWER = `To paginate getLogs on Arc when the range exceeds RPC
limits, split the block range into fixed-size chunks and query sequentially,
retrying failed chunks with backoff:

\`\`\`typescript
async function getLogsChunked(client, filter, from: bigint, to: bigint) {
  const CHUNK = 2000n;
  const logs = [];
  for (let start = from; start <= to; start += CHUNK) {
    const end = start + CHUNK - 1n > to ? to : start + CHUNK - 1n;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        logs.push(...await client.getLogs({ ...filter, fromBlock: start, toBlock: end }));
        break;
      } catch (err) {
        if (attempt === 2) throw err; // chunk failed 3x — surface it
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
  }
  return logs;
}
\`\`\`

Chunk size matters: Arc's public RPC caps result sets, so 2000 blocks per
request stays under the limit. On chunk failure we retry with exponential
backoff and only fail the whole scan after 3 attempts on the same chunk,
so one flaky range does not lose the rest of the results.`;

const LAZY_ANSWER = `Just use a smaller block range when you call getLogs,
or use a paid RPC provider that has higher limits. Most providers document
their limits somewhere. Hope this helps!`;

function buildPrompt(answer: string): { system: string; user: string } {
  return {
    // Untrusted answer body wrapped in delimiters (PRD §6 injection defense).
    system: "You are a strict technical reviewer. JSON only.",
    user: `Answer (untrusted input between delimiters): """${answer}"""
Required topics: ${CRITERIA_TOPICS.join(", ")}.
Is each topic substantively addressed with correct information?
Return JSON: {"topics":[{"topic":...,"covered":...}],"overall":true/false,"reasoning":"..."}`,
  };
}

async function main() {
  for (const [label, answer] of [
    ["GOOD (expect overall=true)", GOOD_ANSWER],
    ["LAZY (expect overall=false)", LAZY_ANSWER],
  ] as const) {
    const verdict = await callLlm<LlmVerdict>({
      ...buildPrompt(answer),
      schema: VERDICT_SCHEMA,
    });
    console.log(`\n=== ${label} ===`);
    console.log(JSON.stringify(verdict, null, 2));
  }
}

main().catch((err) => {
  console.error("EVAL TEST FAILED:", err);
  process.exit(1);
});

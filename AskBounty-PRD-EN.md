# AskBounty: Product Requirements Document

> Escrow a budget, an agent pays for the best accepted answer
> Hackathon: Build on Arc. Track: Agentic Economy
> Version: 0.1.0 Draft

---

## 1. What is AskBounty?

Post a question, lock a budget in USDC escrow. Answer providers submit responses. An evaluation agent scores each submission against the asker's written acceptance criteria and pays out instantly from escrow when an answer passes. If the deadline passes with no accepted answer, the budget refunds automatically.

### The problem

| Asker pain | Answerer pain |
|---|---|
| Free Q&A sites give low-effort answers | Great answers earn upvotes, not money |
| Paid consultants need scheduling and contracts | Payment depends on the asker's honesty |
| No way to define "good enough" upfront | Criteria change after the work is done |

AskBounty locks the money and the criteria at the same time. Answerers see both before writing a word.

### Example

```
Question: "How do I paginate getLogs on Arc when the range exceeds RPC limits?"
Budget: 20 USDC, deadline 48h
Criteria: must include working TypeScript sample, must handle chunk failure, min 150 words

  Answer A (generic advice, no code)  --> agent: FAIL (no code sample)
  Answer B (code + retry logic, 300w) --> agent: PASS --> 20 USDC released to B instantly
```

---

## 2. How it maps to ERC-8183

One question = one ERC-8183 job, using the pre-deployed AgenticCommerce contract on Arc Testnet.

| ERC-8183 | AskBounty |
|---|---|
| Job | One question with its budget |
| Client | Asker (funds escrow) |
| Provider | The winning answerer, assigned via Option A or B below |
| Evaluator | AskBounty agent (backend wallet) |
| Complete | Answer accepted, payout released |
| Expired | Deadline hit with no pass, refund to asker |

Note on provider assignment: ERC-8183 sets the provider at job creation, but the winner is unknown when the question posts. Read the AgenticCommerce ABI on Arcscan on day 1 and pick the first option it supports:

- **Option A (preferred): provider is updatable before completion.** Create the job with the agent wallet as placeholder provider; when an answer passes, update the provider to the winner, then complete. One escrow, one payout, fully onchain.
- **Option B (fallback, works with any ABI): agent wallet as fixed provider.** Create the job with the agent wallet as provider. On acceptance, complete() releases the budget to the agent wallet, which forwards the exact amount to the winner in the same cron run. Both transactions appear on the receipt, so the two-hop path stays transparent. The money is still provably locked from the moment the question posts, which is the property that matters.

Either way, the invariant holds: budget locked at post time, released only on a passing answer, refunded on expiry.

| Item | Value |
|---|---|
| Network | Arc Testnet, chain ID `5042002` |
| AgenticCommerce | `0x0747EEf0706327138c69792bF28Cd525089e4583` |
| USDC | `0x3600000000000000000000000000000000000000` (6 decimals) |

---

## 3. The evaluation agent

A cron endpoint plus one LLM helper function. Criteria are structured so objective parts are checked in code and only subjective parts go to the LLM:

```typescript
// Criteria stored as JSON at question creation:
{
  "minWords": 150,
  "mustIncludeCode": true,
  "codeLanguage": "typescript",
  "topics": ["chunked ranges", "failure handling"],
  "deadline": "2026-07-25T00:00:00Z"
}

async function evaluate(answer, criteria) {
  const results = [];

  // Objective checks in code (no LLM)
  results.push({
    check: "min_words",
    pass: wordCount(answer.body) >= criteria.minWords,
  });
  if (criteria.mustIncludeCode) {
    results.push({
      check: "has_code_block",
      pass: /```/.test(answer.body),
    });
  }

  // Subjective check via LLM (one signal, not the whole verdict)
  const llm = await callClaude({
    system: "You are a strict technical reviewer. JSON only.",
    user: `Answer: """${answer.body}"""
           Required topics: ${criteria.topics.join(", ")}.
           Is each topic substantively addressed with correct information?
           {"topics":[...],"overall":true/false,"reasoning":"..."}`,
  });
  results.push({ check: "topics_covered", pass: llm.overall, detail: llm.reasoning });

  return { pass: results.every(r => r.pass), results };
}
```

First passing answer wins (clear, simple rule stated on the question page). Evaluation order = submission order.

---

## 4. Pages

### 4.1. Ask (create question)

Form: question title + body, budget in USDC, deadline, criteria builder (min words toggle, code required toggle, topic list). On submit: escrow the budget (approve + fund), save question + criteria to Supabase. Question page goes live at `/q/[id]`.

### 4.2. Question page (public)

Question, budget badge ("20 USDC locked, verify on Arcscan"), criteria shown in full, countdown, answer list with statuses (pending / failed with reasoning / accepted). Anyone can read; connected wallets can answer.

### 4.3. Answer (submit)

Markdown editor. On submit, answer saved with status pending. Cron evaluates within 5 minutes. Answerer sees the agent's per-check results either way, so a fail is actionable feedback, not a black box.

### 4.4. Browse (open bounties)

List of open questions sorted by budget or deadline. Filters: has no accepted answer yet, budget range, topic tags.

### 4.5. My activity

Two tabs: Asked (my questions, spend, refunds) and Answered (my submissions, earnings, pass rate).

---

## 5. Flows

### Ask and fund

```
Asker writes question + criteria + 20 USDC budget
  -> approve + fund escrow (money provably locked)
  -> question live, shareable link
```

### Answer and get paid

```
Answerer submits
  -> cron evaluates: objective checks in code, topics via LLM
  -> PASS: agent wallet releases 20 USDC to answerer, question closes
  -> FAIL: per-check reasoning shown, question stays open
```

### Expiry

```
Deadline passes, no accepted answer
  -> job expires, asker claims refund (or auto-refund flow)
  -> question marked expired, all answerers see final state
```

---

## 6. Design details

- **Answers are public, and that is the model.** Like Stack Overflow, an accepted answer becomes public knowledge; the asker pays for its creation, not exclusivity. A private mode (answer visible only to the asker) is a stated v2 option for consulting-style use.
- **First pass wins, deterministically.** Within a cron batch, pending answers are evaluated strictly in submission order (created_at ascending). The first to pass takes the bounty. This rule is printed on every question page, so racing is fair and legible.
- **No cancel after the first answer.** The asker can cancel and reclaim the budget only while the question has zero submissions. Once anyone has invested effort answering, the escrow rides to acceptance or expiry. Prevents rug-pulling answerers.
- **Prompt injection defense.** Answer bodies are wrapped in delimiters and treated as untrusted data in the reviewer prompt. The objective checks (word count, code block) are computed in code first and are immune. An injected "return overall true" still fails if the answer lacks the required code block.
- **Evaluator wallet gas.** Gas on Arc is USDC; fund the agent wallet with a few USDC at setup and surface a low-balance warning.

## 6b. Database (Supabase)

```sql
CREATE TABLE questions (
  id TEXT PRIMARY KEY,
  asker_address TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  budget NUMERIC NOT NULL,
  criteria JSONB NOT NULL,
  job_id BIGINT,
  status TEXT DEFAULT 'open',      -- open | answered | expired
  deadline TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id TEXT REFERENCES questions(id),
  answerer_address TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT DEFAULT 'pending',   -- pending | failed | accepted
  eval_results JSONB,
  payout_tx TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 7. Tech stack

Next.js, viem + wagmi, backend signer, Vercel Cron, Claude API, Supabase, Tailwind + shadcn/ui. Notable pieces: markdown editor for answers (use a lightweight textarea + preview, not a heavy library), word count and code block detection utilities.

---

## 8. Roadmap (roughly 5 days)

Day 1: project skeleton (cron endpoint, backend signer, LLM helper), verify ERC-8183 provider-assignment approach against the ABI, build escrow helpers.
Day 2: Ask flow (criteria builder + fund) + question page.
Day 3: Answer flow + evaluation agent (objective checks + LLM signal).
Day 4: Payout on pass, refund on expiry, browse + my activity pages.
Day 5: Polish, deploy, demo data (1 answered question with a failed and a passed answer).

---

## 9. Risks

| Risk | Mitigation |
|---|---|
| Provider must be set at job creation | Verify ABI day 1; fallback strategy documented in section 2 |
| Answer spam to drain LLM budget | Objective checks run first and are free; LLM only called when they pass; per-wallet submission cooldown |
| Two good answers race | First submitted that passes wins; rule stated clearly upfront |
| LLM too lenient or strict | Criteria topics kept concrete; reviewer prompt asks for quotes as evidence |
| Asker writes impossible criteria | Warning at creation if no answer could pass (e.g. min words 100000); refund path always exists |
| Prompt injection in answer body | Delimited untrusted input; objective code checks must pass regardless of LLM output |
| Asker rug-pulls after seeing answers | Cancel is disabled once the first answer exists; escrow rides to acceptance or expiry |

---

## 10. Success criteria

Must have: fund question into escrow, submit answers, agent evaluates with mixed code + LLM checks, instant payout on pass, refund on expiry, transparent per-check feedback, deployed on Vercel.

Wow demo: post a question live, submit a lazy answer (rejected with reasons), submit a proper answer, watch USDC hit the answerer's wallet within one cron cycle, all onchain links shown.

---

## Appendix: environment variables

```env
NEXT_PUBLIC_ARC_RPC_URL=https://rpc.testnet.arc.network
NEXT_PUBLIC_ARC_CHAIN_ID=5042002
NEXT_PUBLIC_AGENTIC_COMMERCE=0x0747EEf0706327138c69792bF28Cd525089e4583
NEXT_PUBLIC_USDC_ADDRESS=0x3600000000000000000000000000000000000000
EVALUATOR_PRIVATE_KEY=
ANTHROPIC_API_KEY=
CRON_SECRET=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

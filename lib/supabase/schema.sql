-- AskBounty schema — PRD §6b base, extended per Phase 1 plan.
-- Writes happen ONLY via API routes using the service-role key (bypasses RLS).
-- RLS is enabled with read-only access for anon/authenticated: no insert/
-- update/delete policies exist, so client-side writes are denied by default.

CREATE TABLE IF NOT EXISTS questions (
  id TEXT PRIMARY KEY,
  asker_address TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  budget NUMERIC NOT NULL,
  criteria JSONB NOT NULL,
  job_id BIGINT,
  status TEXT DEFAULT 'open',          -- open | answered | expired
  deadline TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- Payout transparency (PRD-ERRATA E2): net amount + fee BPs snapshotted at
  -- question creation so the page can show "winner receives X.XX USDC".
  net_payout NUMERIC,
  platform_fee_bp INT,
  evaluator_fee_bp INT
);

CREATE TABLE IF NOT EXISTS answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id TEXT REFERENCES questions(id),
  answerer_address TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT DEFAULT 'pending',       -- pending | failed | accepted
  eval_results JSONB,
  payout_tx TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- Option B dual-tx payout trail (escrow->agent, agent->winner).
  complete_tx TEXT,
  forward_tx TEXT,
  payout_status TEXT DEFAULT NULL,     -- payout_pending | paid | payout_failed
  -- Signature auth: keccak256(body) signed by answerer_address.
  content_hash TEXT,
  signature TEXT
);

-- First-pass-wins evaluation order: answers per question by submission time.
CREATE INDEX IF NOT EXISTS idx_answers_question_created
  ON answers (question_id, created_at);

-- RLS: public read, NO write policies for anon/authenticated.
-- Service-role key bypasses RLS entirely (server-side API routes only).
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE answers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS questions_public_read ON questions;
CREATE POLICY questions_public_read ON questions FOR SELECT USING (true);

DROP POLICY IF EXISTS answers_public_read ON answers;
CREATE POLICY answers_public_read ON answers FOR SELECT USING (true);

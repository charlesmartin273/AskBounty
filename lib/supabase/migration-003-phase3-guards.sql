-- Phase 3 guards — run in the Supabase SQL editor (after migration-002).
-- 1. Phase 2 review M2: schema default 'open' could bypass the live guard on
--    a future insert path — default must be 'draft', with a status whitelist.
-- 2. Phase 1 review M1: at most ONE accepted answer per question, enforced by
--    the database itself (backstop behind the application-level CAS).

ALTER TABLE questions ALTER COLUMN status SET DEFAULT 'draft';

ALTER TABLE questions DROP CONSTRAINT IF EXISTS questions_status_check;
ALTER TABLE questions ADD CONSTRAINT questions_status_check
  CHECK (status IN ('draft', 'open', 'answered', 'expired'));

ALTER TABLE answers DROP CONSTRAINT IF EXISTS answers_status_check;
ALTER TABLE answers ADD CONSTRAINT answers_status_check
  CHECK (status IN ('pending', 'failed', 'accepted'));

ALTER TABLE answers DROP CONSTRAINT IF EXISTS answers_payout_status_check;
ALTER TABLE answers ADD CONSTRAINT answers_payout_status_check
  CHECK (payout_status IS NULL
         OR payout_status IN ('payout_pending', 'paid', 'payout_failed'));

-- M1: double-accept guard. The partial unique index makes a second 'accepted'
-- row for the same question impossible regardless of application bugs.
CREATE UNIQUE INDEX IF NOT EXISTS one_accepted_per_question
  ON answers (question_id) WHERE status = 'accepted';

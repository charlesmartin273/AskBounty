-- Phase 4 — run in the Supabase SQL editor (after migration-003).
-- Refund path: questions gain a 'refunded' terminal status + the refund tx
-- hash for the receipt/activity views.

ALTER TABLE questions DROP CONSTRAINT IF EXISTS questions_status_check;
ALTER TABLE questions ADD CONSTRAINT questions_status_check
  CHECK (status IN ('draft', 'open', 'answered', 'expired', 'refunded'));

ALTER TABLE questions ADD COLUMN IF NOT EXISTS refund_tx TEXT;

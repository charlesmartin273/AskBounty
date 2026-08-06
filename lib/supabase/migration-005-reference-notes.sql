-- Run in the Supabase SQL editor (after migration-004).
-- Asker-provided ground truth for the AI reviewer (PRD-ERRATA E7): the
-- evaluator LLM has no web access and hallucinates "factually incorrect" on
-- topics newer than its training data. Notes are PRIVATE - deliberately a
-- sibling column, never inside criteria JSONB, because toPublicQuestion()
-- returns criteria verbatim to the public API.

ALTER TABLE questions ADD COLUMN IF NOT EXISTS reference_notes TEXT;

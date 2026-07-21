-- Phase 2 migration: tx hash trail for the ask/fund wizard.
-- Run in Supabase SQL editor (after schema.sql).

ALTER TABLE questions ADD COLUMN IF NOT EXISTS create_tx TEXT;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS fund_tx TEXT;

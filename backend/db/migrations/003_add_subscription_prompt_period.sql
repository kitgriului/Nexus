-- Migration: Add prompt and period_days to subscriptions
-- Date: 2026-02-18

ALTER TABLE subscriptions
ADD COLUMN IF NOT EXISTS prompt TEXT,
ADD COLUMN IF NOT EXISTS period_days INTEGER DEFAULT 7;

UPDATE subscriptions SET period_days = 7 WHERE period_days IS NULL;

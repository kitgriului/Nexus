-- Migration: Add categories and notes support
-- Date: 2026-03-11
-- Description: Add categories table and extend media_items with category_id and note type

-- 1. Categories table
CREATE TABLE IF NOT EXISTS categories (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(255) NOT NULL,
    description TEXT,
    color       VARCHAR(20) DEFAULT '#6366f1',
    icon        VARCHAR(10) DEFAULT '📁',
    parent_id   UUID REFERENCES categories(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON categories(parent_id);

-- 2. Extend media_items with category_id
ALTER TABLE media_items
    ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_media_items_category_id ON media_items(category_id);

-- 3. Allow 'note' as a valid type (no constraint change needed if type is VARCHAR)
-- Ensure type column is VARCHAR (it should already be)
-- No-op if already correct.

COMMENT ON TABLE categories IS 'User-defined folders/categories for organising content';
COMMENT ON COLUMN media_items.category_id IS 'Optional category/folder for this item';

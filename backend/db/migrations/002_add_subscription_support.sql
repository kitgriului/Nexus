-- Migration: Add subscription support to media_items
-- Date: 2026-02-18
-- Description: Add origin tracking and subscription_id foreign key to media_items table

-- Add origin column (manual vs subscription)
ALTER TABLE media_items 
ADD COLUMN IF NOT EXISTS origin VARCHAR(50) DEFAULT 'manual' NOT NULL;

-- Add subscription_id foreign key
ALTER TABLE media_items 
ADD COLUMN IF NOT EXISTS subscription_id UUID,
ADD CONSTRAINT fk_media_items_subscription 
    FOREIGN KEY (subscription_id) 
    REFERENCES subscriptions(id) 
    ON DELETE SET NULL;

-- Create index for faster queries on origin
CREATE INDEX IF NOT EXISTS idx_media_items_origin ON media_items(origin);

-- Create index for subscription_id lookups
CREATE INDEX IF NOT EXISTS idx_media_items_subscription_id ON media_items(subscription_id);

-- Update existing records to have origin='manual' (already set by DEFAULT)
-- No need to update as DEFAULT handles it

COMMENT ON COLUMN media_items.origin IS 'Source of media: manual (user uploaded/added) or subscription (auto-synced from feed)';
COMMENT ON COLUMN media_items.subscription_id IS 'Reference to subscription if origin=subscription';

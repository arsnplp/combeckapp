-- Add billing columns to merchants table
ALTER TABLE merchants
  ADD COLUMN IF NOT EXISTS plan VARCHAR(50) DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255);

-- Create index for plan expiration lookups
CREATE INDEX IF NOT EXISTS idx_merchants_plan_expires_at ON merchants(plan_expires_at)
  WHERE plan_expires_at IS NOT NULL;

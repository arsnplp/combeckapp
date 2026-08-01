-- Add strip_preset column to loyalty_cards: which of the curated banner images
-- (Apple Wallet strip / Google Wallet heroImage) the merchant picked, if any.
-- NULL = no preset, keep the dynamic stamps/points-progress banner (unchanged behaviour).
ALTER TABLE loyalty_cards
  ADD COLUMN IF NOT EXISTS strip_preset VARCHAR(20);

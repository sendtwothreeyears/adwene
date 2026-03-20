-- Add onboarding-related columns to Provider
ALTER TABLE Provider ADD COLUMN passwordHash TEXT;
ALTER TABLE Provider ADD COLUMN teamSize TEXT;
ALTER TABLE Provider ADD COLUMN orgRole TEXT;

-- Enforce unique phone numbers
CREATE UNIQUE INDEX IF NOT EXISTS idx_provider_phone ON Provider(phone) WHERE phone IS NOT NULL;

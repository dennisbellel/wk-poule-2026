-- Wanneer een gebruiker de onboarding-tour heeft afgerond.
-- NULL = nog niet gezien → tour wordt automatisch getoond bij eerste login.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarded_at TIMESTAMPTZ;

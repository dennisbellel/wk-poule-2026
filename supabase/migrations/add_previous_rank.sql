-- Voeg previous_rank toe aan profiles voor leaderboard delta-pijltjes.
-- Wordt geüpdatet door de admin API routes vóór elke publicatie.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS previous_rank INTEGER;

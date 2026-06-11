-- ============================================================
-- Dé WK Poule 2026 — Database Schema
-- Run this in Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── PROFILES ────────────────────────────────────────────────────────────────
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  is_admin BOOLEAN DEFAULT FALSE,
  avatar_color TEXT DEFAULT '#1a5c38',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read all profiles" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Service role full access" ON profiles USING (true) WITH CHECK (true);

-- ─── INVITED EMAILS ──────────────────────────────────────────────────────────
CREATE TABLE invited_emails (
  email TEXT PRIMARY KEY,
  invited_by UUID REFERENCES profiles(id),
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  registered_at TIMESTAMPTZ
);

ALTER TABLE invited_emails ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage invites" ON invited_emails USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);

-- ─── TEAMS ───────────────────────────────────────────────────────────────────
CREATE TABLE teams (
  id TEXT PRIMARY KEY, -- e.g. 'NED', 'BEL'
  name TEXT NOT NULL,
  name_nl TEXT NOT NULL,
  flag TEXT NOT NULL,
  group_id TEXT NOT NULL,
  fd_team_id INTEGER
);

ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Everyone can read teams" ON teams FOR SELECT USING (true);
CREATE POLICY "Admins can manage teams" ON teams USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);

-- ─── PLAYERS ─────────────────────────────────────────────────────────────────
CREATE TABLE players (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  team_id TEXT REFERENCES teams(id) ON DELETE CASCADE,
  position TEXT NOT NULL CHECK (position IN ('GK', 'DEF', 'MID', 'FWD')),
  fd_player_id INTEGER,
  synced_at TIMESTAMPTZ
);

ALTER TABLE players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Everyone can read players" ON players FOR SELECT USING (true);
CREATE POLICY "Admins can manage players" ON players USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);

-- ─── MATCHES ─────────────────────────────────────────────────────────────────
CREATE TABLE matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fd_match_id INTEGER UNIQUE,
  phase TEXT NOT NULL CHECK (phase IN ('group','r32','r16','qf','sf','third','final')),
  group_id TEXT,
  match_number INTEGER NOT NULL,
  home_team_id TEXT REFERENCES teams(id),
  away_team_id TEXT REFERENCES teams(id),
  home_team_placeholder TEXT, -- "Winnaar Groep A" for unknown knockout teams
  away_team_placeholder TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL,
  prediction_deadline_at TIMESTAMPTZ NOT NULL, -- defaults to scheduled_at
  venue TEXT,
  city TEXT,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled','live','finished')),
  home_ht INTEGER,
  away_ht INTEGER,
  home_ft INTEGER,
  away_ft INTEGER,
  home_et INTEGER, -- extra time
  away_et INTEGER,
  penalties BOOLEAN DEFAULT FALSE,
  winner_team_id TEXT REFERENCES teams(id),
  home_yellow INTEGER,
  away_yellow INTEGER,
  home_red INTEGER,
  away_red INTEGER,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Everyone can read matches" ON matches FOR SELECT USING (true);
CREATE POLICY "Admins can manage matches" ON matches USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);

-- ─── MATCH PREDICTIONS ───────────────────────────────────────────────────────
CREATE TABLE match_predictions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  home_ht INTEGER,
  away_ht INTEGER,
  home_ft INTEGER,
  away_ft INTEGER,
  et_predicted BOOLEAN,
  pens_predicted BOOLEAN,
  winner_team_id TEXT REFERENCES teams(id),
  home_yellow INTEGER,
  away_yellow INTEGER,
  home_red INTEGER,
  away_red INTEGER,
  points INTEGER,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, match_id)
);

ALTER TABLE match_predictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read all predictions after deadline" ON match_predictions
  FOR SELECT USING (
    auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM matches m WHERE m.id = match_id AND m.prediction_deadline_at < NOW())
  );
CREATE POLICY "Users can manage own predictions before deadline" ON match_predictions
  FOR ALL USING (
    auth.uid() = user_id AND
    EXISTS (SELECT 1 FROM matches m WHERE m.id = match_id AND m.prediction_deadline_at > NOW())
  );
CREATE POLICY "Admins full access to predictions" ON match_predictions USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);

-- ─── GROUP STANDING PREDICTIONS ──────────────────────────────────────────────
CREATE TABLE group_standing_predictions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  group_id TEXT NOT NULL,
  position INTEGER NOT NULL CHECK (position BETWEEN 1 AND 4),
  team_id TEXT NOT NULL REFERENCES teams(id),
  predicted_points INTEGER DEFAULT 0,
  goals_for INTEGER DEFAULT 0,
  goals_against INTEGER DEFAULT 0,
  yellow_cards INTEGER DEFAULT 0,
  red_cards INTEGER DEFAULT 0,
  points INTEGER,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, group_id, position)
);

ALTER TABLE group_standing_predictions ENABLE ROW LEVEL SECURITY;
-- "Op slot" = de prediction_deadline van de eerste wedstrijd in de groep is verstreken.
-- Eigen rijen altijd leesbaar; andermans pas na het slot (anti-afkijken).
CREATE POLICY "Read own or locked group predictions" ON group_standing_predictions
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM matches m
      WHERE m.group_id = group_standing_predictions.group_id
        AND m.phase = 'group'
        AND m.prediction_deadline_at <= NOW()
    )
  );
CREATE POLICY "Manage own group predictions before lock" ON group_standing_predictions
  FOR ALL USING (
    auth.uid() = user_id
    AND NOT EXISTS (
      SELECT 1 FROM matches m
      WHERE m.group_id = group_standing_predictions.group_id
        AND m.phase = 'group'
        AND m.prediction_deadline_at <= NOW()
    )
  );
CREATE POLICY "Admins full access to group predictions" ON group_standing_predictions
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- Atomic opslaan van een complete poulestand-voorspelling (DELETE + INSERT in één
-- transactie), met eigenaars- en deadline-check. Volledige definitie staat in
-- /supabase/migrations/lock_group_predictions.sql

-- ─── BONUS QUESTIONS ─────────────────────────────────────────────────────────
CREATE TABLE bonus_questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  question_nl TEXT NOT NULL,
  question_type TEXT NOT NULL CHECK (question_type IN ('team','player','number')),
  phase TEXT NOT NULL CHECK (phase IN ('group','tournament')),
  points_value INTEGER DEFAULT 5,
  icon TEXT DEFAULT '🎯',
  deadline_at TIMESTAMPTZ NOT NULL,
  correct_answer TEXT,
  active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE bonus_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Everyone can read active bonus questions" ON bonus_questions
  FOR SELECT USING (active = true OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));
CREATE POLICY "Admins can manage bonus questions" ON bonus_questions USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);

-- ─── BONUS ANSWERS ───────────────────────────────────────────────────────────
CREATE TABLE bonus_answers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES bonus_questions(id) ON DELETE CASCADE,
  answer TEXT NOT NULL,
  points INTEGER,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, question_id)
);

ALTER TABLE bonus_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own answers, admins read all" ON bonus_answers
  FOR SELECT USING (
    auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );
CREATE POLICY "Users can manage own answers before deadline" ON bonus_answers
  FOR ALL USING (
    auth.uid() = user_id AND
    EXISTS (SELECT 1 FROM bonus_questions q WHERE q.id = question_id AND q.deadline_at > NOW())
  );

-- ─── SCORING CONFIG ──────────────────────────────────────────────────────────
CREATE TABLE scoring_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT UNIQUE NOT NULL,
  value INTEGER NOT NULL,
  label_nl TEXT NOT NULL,
  category TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE scoring_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Everyone can read scoring config" ON scoring_config FOR SELECT USING (true);
CREATE POLICY "Admins can update scoring config" ON scoring_config USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);

-- ─── SYNC LOG ────────────────────────────────────────────────────────────────
CREATE TABLE sync_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  matches_updated INTEGER DEFAULT 0,
  status TEXT DEFAULT 'success',
  error TEXT
);

ALTER TABLE sync_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can read sync log" ON sync_log FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);

-- ─── TRIGGERS ────────────────────────────────────────────────────────────────
-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, display_name, is_admin)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    COALESCE((NEW.raw_user_meta_data->>'is_admin')::boolean, false)
  );
  -- Mark invited email as registered
  UPDATE invited_emails SET registered_at = NOW() WHERE email = NEW.email;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER match_predictions_updated_at BEFORE UPDATE ON match_predictions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER group_predictions_updated_at BEFORE UPDATE ON group_standing_predictions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER bonus_answers_updated_at BEFORE UPDATE ON bonus_answers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── LEADERBOARD VIEW ────────────────────────────────────────────────────────
-- Sommeer eerst per tabel per gebruiker, JOIN daarna — anders veroorzaken
-- de drie LEFT JOINs een Cartesisch product en wordt elke punt vermenigvuldigd
-- met het aantal records in de andere tabellen.
CREATE OR REPLACE VIEW leaderboard AS
SELECT
  p.id AS user_id,
  p.display_name,
  p.avatar_color,
  COALESCE(mp_sum.total, 0) AS match_points,
  COALESCE(gsp_sum.total, 0) AS group_points,
  COALESCE(ba_sum.total, 0) AS bonus_points,
  COALESCE(mp_sum.total, 0)
    + COALESCE(gsp_sum.total, 0)
    + COALESCE(ba_sum.total, 0) AS total_points,
  mp_sum.first_submitted AS submitted_at
FROM profiles p
LEFT JOIN (
  SELECT user_id, SUM(points) AS total, MIN(submitted_at) AS first_submitted
  FROM match_predictions GROUP BY user_id
) mp_sum ON mp_sum.user_id = p.id
LEFT JOIN (
  SELECT user_id, SUM(points) AS total
  FROM group_standing_predictions GROUP BY user_id
) gsp_sum ON gsp_sum.user_id = p.id
LEFT JOIN (
  SELECT user_id, SUM(points) AS total
  FROM bonus_answers GROUP BY user_id
) ba_sum ON ba_sum.user_id = p.id;

-- ─── SEED: SCORING CONFIG ────────────────────────────────────────────────────
INSERT INTO scoring_config (key, value, label_nl, category) VALUES
  ('exact_ft', 5, 'Eindstand exact goed', 'Wedstrijd'),
  ('correct_outcome', 2, 'Winnaar/gelijkspel correct', 'Wedstrijd'),
  ('exact_ht', 3, 'Ruststand exact goed (bonus)', 'Wedstrijd'),
  ('exact_yellow', 2, 'Gele kaarten exact goed', 'Wedstrijd'),
  ('exact_red', 3, 'Rode kaarten exact goed', 'Wedstrijd'),
  ('knockout_et', 2, 'Verlenging (ja/nee) correct', 'Knockout extra'),
  ('knockout_pens', 2, 'Strafschoppen (ja/nee) correct', 'Knockout extra'),
  ('knockout_winner', 3, 'Winnaar correct', 'Knockout extra'),
  ('group_position', 3, 'Land op exacte positie', 'Poulestand'),
  ('group_points', 2, 'Punten exact', 'Poulestand'),
  ('group_gf', 1, 'Goals voor exact', 'Poulestand'),
  ('group_ga', 1, 'Goals tegen exact', 'Poulestand'),
  ('group_yellow', 1, 'Gele kaarten exact', 'Poulestand'),
  ('group_red', 1, 'Rode kaarten exact', 'Poulestand'),
  ('bonus_default', 5, 'Bonusvragen standaard', 'Bonus');

-- ─── SEED: WK 2026 TEAMS ─────────────────────────────────────────────────────
INSERT INTO teams (id, name, name_nl, flag, group_id) VALUES
  ('MEX', 'Mexico', 'Mexico', '🇲🇽', 'A'),
  ('KOR', 'South Korea', 'Zuid-Korea', '🇰🇷', 'A'),
  ('RSA', 'South Africa', 'Zuid-Afrika', '🇿🇦', 'A'),
  ('CZE', 'Czechia', 'Tsjechië', '🇨🇿', 'A'),
  ('CAN', 'Canada', 'Canada', '🇨🇦', 'B'),
  ('SUI', 'Switzerland', 'Zwitserland', '🇨🇭', 'B'),
  ('QAT', 'Qatar', 'Qatar', '🇶🇦', 'B'),
  ('BIH', 'Bosnia-Herzegovina', 'Bosnië-Herzegovina', '🇧🇦', 'B'),
  ('BRA', 'Brazil', 'Brazilië', '🇧🇷', 'C'),
  ('MAR', 'Morocco', 'Marokko', '🇲🇦', 'C'),
  ('HAI', 'Haiti', 'Haïti', '🇭🇹', 'C'),
  ('SCO', 'Scotland', 'Schotland', '🏴󠁧󠁢󠁳󠁣󠁴󠁿', 'C'),
  ('USA', 'United States', 'USA', '🇺🇸', 'D'),
  ('PAR', 'Paraguay', 'Paraguay', '🇵🇾', 'D'),
  ('AUS', 'Australia', 'Australië', '🇦🇺', 'D'),
  ('TUR', 'Turkey', 'Turkije', '🇹🇷', 'D'),
  ('GER', 'Germany', 'Duitsland', '🇩🇪', 'E'),
  ('CUW', 'Curaçao', 'Curaçao', '🇨🇼', 'E'),
  ('CIV', 'Ivory Coast', 'Ivoorkust', '🇨🇮', 'E'),
  ('ECU', 'Ecuador', 'Ecuador', '🇪🇨', 'E'),
  ('NED', 'Netherlands', 'Nederland', '🇳🇱', 'F'),
  ('JPN', 'Japan', 'Japan', '🇯🇵', 'F'),
  ('SWE', 'Sweden', 'Zweden', '🇸🇪', 'F'),
  ('TUN', 'Tunisia', 'Tunesië', '🇹🇳', 'F'),
  ('BEL', 'Belgium', 'België', '🇧🇪', 'G'),
  ('EGY', 'Egypt', 'Egypte', '🇪🇬', 'G'),
  ('IRN', 'Iran', 'Iran', '🇮🇷', 'G'),
  ('NZL', 'New Zealand', 'Nieuw-Zeeland', '🇳🇿', 'G'),
  ('ESP', 'Spain', 'Spanje', '🇪🇸', 'H'),
  ('CPV', 'Cape Verde', 'Kaapverdië', '🇨🇻', 'H'),
  ('KSA', 'Saudi Arabia', 'Saoedi-Arabië', '🇸🇦', 'H'),
  ('URU', 'Uruguay', 'Uruguay', '🇺🇾', 'H'),
  ('FRA', 'France', 'Frankrijk', '🇫🇷', 'I'),
  ('SEN', 'Senegal', 'Senegal', '🇸🇳', 'I'),
  ('NOR', 'Norway', 'Noorwegen', '🇳🇴', 'I'),
  ('IRQ', 'Iraq', 'Irak', '🇮🇶', 'I'),
  ('ARG', 'Argentina', 'Argentinië', '🇦🇷', 'J'),
  ('ALG', 'Algeria', 'Algerije', '🇩🇿', 'J'),
  ('AUT', 'Austria', 'Oostenrijk', '🇦🇹', 'J'),
  ('JOR', 'Jordan', 'Jordanië', '🇯🇴', 'J'),
  ('POR', 'Portugal', 'Portugal', '🇵🇹', 'K'),
  ('COD', 'DR Congo', 'DR Congo', '🇨🇩', 'K'),
  ('UZB', 'Uzbekistan', 'Oezbekistan', '🇺🇿', 'K'),
  ('COL', 'Colombia', 'Colombia', '🇨🇴', 'K'),
  ('ENG', 'England', 'Engeland', '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'L'),
  ('CRO', 'Croatia', 'Kroatië', '🇭🇷', 'L'),
  ('GHA', 'Ghana', 'Ghana', '🇬🇭', 'L'),
  ('PAN', 'Panama', 'Panama', '🇵🇦', 'L');

-- ─── SEED: BONUS QUESTIONS ───────────────────────────────────────────────────
INSERT INTO bonus_questions (question_nl, question_type, phase, points_value, icon, deadline_at, sort_order) VALUES
  ('Wie wordt Wereldkampioen?', 'team', 'tournament', 5, '🏆', '2026-06-11 19:00:00+00', 1),
  ('Wie verliest de finale?', 'team', 'tournament', 5, '🥈', '2026-06-11 19:00:00+00', 2),
  ('Wie wordt topscorer van het toernooi?', 'player', 'tournament', 5, '⚽', '2026-06-11 19:00:00+00', 3),
  ('Welk land krijgt de meeste gele kaarten in het toernooi?', 'team', 'tournament', 5, '🟨', '2026-06-11 19:00:00+00', 4),
  ('Welk land heeft de meeste clean sheets in het toernooi?', 'team', 'tournament', 5, '🧤', '2026-06-11 19:00:00+00', 5),
  ('Welk land scoort de meeste doelpunten in de groepsfase?', 'team', 'group', 5, '⚽', '2026-06-11 19:00:00+00', 6),
  ('Wie scoort de meeste doelpunten in de groepsfase?', 'player', 'group', 5, '🎯', '2026-06-11 19:00:00+00', 7),
  ('Welk land krijgt de meeste gele kaarten in de groepsfase?', 'team', 'group', 5, '🟨', '2026-06-11 19:00:00+00', 8),
  ('Hoeveel doelpunten vallen er totaal in de groepsfase?', 'number', 'group', 3, '🔢', '2026-06-11 19:00:00+00', 9);

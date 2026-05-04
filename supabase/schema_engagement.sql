-- ─── MATCH REACTIONS ────────────────────────────────────────────────────────
-- Emoji reactions on finished matches
CREATE TABLE match_reactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL CHECK (emoji IN ('🔥','😭','😤','🎉','🤯','😂','👏','💀')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, match_id, emoji) -- one of each emoji per user per match
);

ALTER TABLE match_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Everyone can read reactions" ON match_reactions FOR SELECT USING (true);
CREATE POLICY "Users can manage own reactions" ON match_reactions FOR ALL USING (auth.uid() = user_id);

-- ─── ACTIVITY FEED ────────────────────────────────────────────────────────────
-- Auto-generated events shown in the feed
CREATE TABLE activity_feed (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL CHECK (type IN (
    'match_result',       -- uitslag bekend
    'perfect_prediction', -- iemand had alles goed
    'exact_score',        -- iemand had de exacte eindstand
    'rank_change',        -- iemand stijgt/daalt in de stand
    'streak',             -- iemand scoort X dagen op rij punten
    'leaderboard_change', -- nieuwe nummer 1
    'deadline_reminder'   -- deadline komt eraan
  )),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE, -- null for system events
  match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  emoji TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE activity_feed ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Everyone can read activity feed" ON activity_feed FOR SELECT USING (true);
CREATE POLICY "Service role can insert activity" ON activity_feed USING (true) WITH CHECK (true);

-- ─── FUNCTION: generate activity after match result ───────────────────────────
-- Called from the sync API after a match is marked finished
CREATE OR REPLACE FUNCTION generate_match_activity(p_match_id UUID)
RETURNS void AS $$
DECLARE
  v_match matches%ROWTYPE;
  v_home_name TEXT;
  v_away_name TEXT;
  v_pred match_predictions%ROWTYPE;
  v_profile profiles%ROWTYPE;
  v_perfect_count INT := 0;
  v_exact_count INT := 0;
BEGIN
  SELECT * INTO v_match FROM matches WHERE id = p_match_id;
  SELECT name_nl INTO v_home_name FROM teams WHERE id = v_match.home_team_id;
  SELECT name_nl INTO v_away_name FROM teams WHERE id = v_match.away_team_id;

  -- Insert match result event
  INSERT INTO activity_feed (type, match_id, title, body, emoji)
  VALUES (
    'match_result',
    p_match_id,
    v_home_name || ' ' || v_match.home_ft || '–' || v_match.away_ft || ' ' || v_away_name,
    'Uitslag bekend — punten worden berekend',
    '⚽'
  );

  -- Find perfect predictions (all fields correct)
  FOR v_pred IN
    SELECT * FROM match_predictions
    WHERE match_id = p_match_id AND points >= 10
  LOOP
    SELECT * INTO v_profile FROM profiles WHERE id = v_pred.user_id;
    INSERT INTO activity_feed (type, user_id, match_id, title, emoji, metadata)
    VALUES (
      'perfect_prediction',
      v_pred.user_id,
      p_match_id,
      v_profile.display_name || ' voorspelde het bijna perfect! 🎯',
      '🔥',
      jsonb_build_object('points', v_pred.points, 'display_name', v_profile.display_name)
    );
    v_perfect_count := v_perfect_count + 1;
  END LOOP;

  -- Find exact score predictions
  FOR v_pred IN
    SELECT * FROM match_predictions
    WHERE match_id = p_match_id
      AND home_ft = v_match.home_ft
      AND away_ft = v_match.away_ft
      AND (points IS NULL OR points < 10) -- not already counted above
  LOOP
    SELECT * INTO v_profile FROM profiles WHERE id = v_pred.user_id;
    INSERT INTO activity_feed (type, user_id, match_id, title, emoji, metadata)
    VALUES (
      'exact_score',
      v_pred.user_id,
      p_match_id,
      v_profile.display_name || ' had de exacte uitslag! 🎉',
      '🎉',
      jsonb_build_object('score', v_match.home_ft || '-' || v_match.away_ft, 'display_name', v_profile.display_name)
    );
    v_exact_count := v_exact_count + 1;
  END LOOP;

  -- Group stat: X people had exact score
  IF v_exact_count > 1 THEN
    INSERT INTO activity_feed (type, match_id, title, emoji, metadata)
    VALUES (
      'exact_score',
      p_match_id,
      v_exact_count || ' deelnemers hadden de exacte uitslag van ' || v_home_name || '–' || v_away_name,
      '🎯',
      jsonb_build_object('count', v_exact_count)
    );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

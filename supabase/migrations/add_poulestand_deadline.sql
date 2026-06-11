-- ─── INSTELBARE POULESTAND-DEADLINE ──────────────────────────────────────────
-- De admin bepaalt zelf tot wanneer de poulestand ingevuld mag worden
-- (Admin → Overzicht → Poulestand-deadline). Tot die deadline open, daarna
-- alles tegelijk op slot. Zonder ingestelde waarde geldt de oude regel:
-- de deadline van de allereerste groepswedstrijd.
--
-- Draai dit één keer in de Supabase SQL Editor (na lock_group_predictions.sql).

-- 1) Klein settings-tabelletje (key/value)
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated can read settings" ON app_settings;
CREATE POLICY "Authenticated can read settings" ON app_settings
  FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Admins can manage settings" ON app_settings;
CREATE POLICY "Admins can manage settings" ON app_settings
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- Startwaarde = de huidige regel (start van het toernooi), zodat er niks
-- verandert totdat de admin zelf een nieuwe deadline kiest.
INSERT INTO app_settings (key, value)
SELECT 'group_predictions_deadline_at', MIN(prediction_deadline_at)::text
FROM matches WHERE phase = 'group'
ON CONFLICT (key) DO NOTHING;

-- 2) Eén centrale functie die de geldende deadline teruggeeft
CREATE OR REPLACE FUNCTION group_predictions_deadline()
RETURNS timestamptz
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT value::timestamptz FROM app_settings WHERE key = 'group_predictions_deadline_at'),
    (SELECT MIN(prediction_deadline_at) FROM matches WHERE phase = 'group')
  );
$$;

-- 3) Policies omzetten naar de instelbare deadline
DROP POLICY IF EXISTS "Read own or locked group predictions" ON group_standing_predictions;
DROP POLICY IF EXISTS "Manage own group predictions before lock" ON group_standing_predictions;

-- Eigen rijen altijd lezen; andermans pas na de deadline (anti-afkijken)
CREATE POLICY "Read own or locked group predictions" ON group_standing_predictions
  FOR SELECT USING (
    auth.uid() = user_id OR NOW() >= group_predictions_deadline()
  );

-- Schrijven: alleen eigen rijen, en alleen vóór de deadline
CREATE POLICY "Manage own group predictions before lock" ON group_standing_predictions
  FOR ALL USING (
    auth.uid() = user_id AND NOW() < group_predictions_deadline()
  );

-- (De policy "Admins full access to group predictions" uit de vorige
--  migratie blijft gewoon staan.)

-- 4) Opslaan-functie: zelfde instelbare deadline-check
CREATE OR REPLACE FUNCTION save_group_predictions(p_user_id uuid, p_group_id text, p_rows jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Je kunt alleen je eigen voorspellingen opslaan';
  END IF;

  IF auth.uid() IS NOT NULL AND NOW() >= group_predictions_deadline() THEN
    RAISE EXCEPTION 'De poulestand zit op slot — de deadline is verstreken';
  END IF;

  -- Atomic DELETE + INSERT: voorkomt halve states bij volgorde-wissels
  DELETE FROM group_standing_predictions
  WHERE user_id = p_user_id AND group_id = p_group_id;

  INSERT INTO group_standing_predictions
    (user_id, group_id, position, team_id, predicted_points, goals_for, goals_against, yellow_cards, red_cards)
  SELECT
    p_user_id, p_group_id,
    (r->>'position')::int,
    r->>'team_id',
    COALESCE((r->>'predicted_points')::int, 0),
    COALESCE((r->>'goals_for')::int, 0),
    COALESCE((r->>'goals_against')::int, 0),
    COALESCE((r->>'yellow_cards')::int, 0),
    COALESCE((r->>'red_cards')::int, 0)
  FROM jsonb_array_elements(p_rows) AS r;
END;
$$;

-- ─── POULESTAND OP SLOT ──────────────────────────────────────────────────────
-- Probleem: group_standing_predictions had géén deadline-regels. Iedereen kon
-- (1) andermans poulestand-voorspellingen lezen vóór enige deadline (afkijken),
-- (2) zijn eigen voorspelling blijven aanpassen nadat de groepsfase al bezig was.
--
-- Definitie van "op slot": zodra de prediction_deadline van de EERSTE wedstrijd
-- in die groep verstreken is. Per groep dus — groepen die later beginnen,
-- blijven langer open.
--
-- Draai dit één keer in de Supabase SQL Editor.

-- 1) Oude policies vervangen
DROP POLICY IF EXISTS "Users can read all group predictions" ON group_standing_predictions;
DROP POLICY IF EXISTS "Users can manage own group predictions" ON group_standing_predictions;
DROP POLICY IF EXISTS "Read own or locked group predictions" ON group_standing_predictions;
DROP POLICY IF EXISTS "Manage own group predictions before lock" ON group_standing_predictions;
DROP POLICY IF EXISTS "Admins full access to group predictions" ON group_standing_predictions;

-- Eigen rijen altijd lezen; andermans pas zodra de groep op slot zit
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

-- Schrijven: alleen eigen rijen, en alleen zolang de groep niet op slot zit
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

-- Admins (eigen sessie, bv. deelnemer-overzicht) mogen alles blijven zien
CREATE POLICY "Admins full access to group predictions" ON group_standing_predictions
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- 2) RPC vervangen door een versie mét eigenaars- en deadline-check.
-- De service-role (admin "voorspel namens" via /api/admin/proxy-save) heeft
-- geen auth.uid() en mag er bewust langs — net als bij wedstrijdvoorspellingen.
DROP FUNCTION IF EXISTS save_group_predictions(uuid, text, jsonb);
DROP FUNCTION IF EXISTS save_group_predictions(uuid, text, json);

CREATE FUNCTION save_group_predictions(p_user_id uuid, p_group_id text, p_rows jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Je kunt alleen je eigen voorspellingen opslaan';
  END IF;

  IF auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM matches m
    WHERE m.group_id = p_group_id
      AND m.phase = 'group'
      AND m.prediction_deadline_at <= NOW()
  ) THEN
    RAISE EXCEPTION 'Groep % zit op slot — de eerste wedstrijd is al begonnen', p_group_id;
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

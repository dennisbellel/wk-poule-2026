-- ─── FIX LEADERBOARD VIEW ────────────────────────────────────────────────────
-- De oude versie joined match_predictions, group_standing_predictions en
-- bonus_answers zonder eerst per gebruiker te sommeren. Daardoor werd elke
-- punt vermenigvuldigd met het aantal records in de andere tabellen
-- (Cartesisch product). Voorbeeld: 16 punten × 8 antwoorden = 128.
--
-- Deze versie sommeert eerst per gebruiker per tabel (subqueries), en joint
-- daarna pas. Resultaat: correcte sommen.

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
  FROM match_predictions
  GROUP BY user_id
) mp_sum ON mp_sum.user_id = p.id
LEFT JOIN (
  SELECT user_id, SUM(points) AS total
  FROM group_standing_predictions
  GROUP BY user_id
) gsp_sum ON gsp_sum.user_id = p.id
LEFT JOIN (
  SELECT user_id, SUM(points) AS total
  FROM bonus_answers
  GROUP BY user_id
) ba_sum ON ba_sum.user_id = p.id;

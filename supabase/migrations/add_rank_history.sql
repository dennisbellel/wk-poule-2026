-- Snapshot van iedereens rank na elke publicatie. Gebruikt voor de lijngrafiek
-- "Mijn positie over tijd" op de statistiekenpagina.
CREATE TABLE IF NOT EXISTS rank_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rank INTEGER NOT NULL,
  total_points INTEGER NOT NULL DEFAULT 0,
  snapshotted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rank_history_user ON rank_history(user_id, snapshotted_at);

ALTER TABLE rank_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Iedereen kan rank_history lezen" ON rank_history FOR SELECT USING (auth.role() = 'authenticated');

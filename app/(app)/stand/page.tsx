import { createClient } from '@/lib/supabase/server'
import { sortLeaderboard } from '@/lib/points/calculate'
import StandClient from '@/components/stand/StandClient'

export default async function StandPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: lbRaw } = await supabase
    .from('leaderboard')
    .select('*')

  const leaderboard = sortLeaderboard(lbRaw || [])

  // Per-user per-day points (from match predictions with points set)
  const { data: matchPreds } = await supabase
    .from('match_predictions')
    .select('user_id, points, match:match_id(scheduled_at)')
    .not('points', 'is', null)

  return (
    <StandClient
      leaderboard={leaderboard}
      currentUserId={user!.id}
      matchPredictions={matchPreds || []}
    />
  )
}

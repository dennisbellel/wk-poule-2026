import { createClient } from '@/lib/supabase/server'
import StatsClient from '@/components/stats/StatsClient'
import { sortLeaderboard } from '@/lib/points/calculate'

export default async function StatsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: lbRaw }, { data: finishedMatches }, { data: reactions }, { data: activityFeed }] = await Promise.all([
    supabase.from('leaderboard').select('*'),
    supabase.from('matches')
      .select('*, home_team:home_team_id(*), away_team:away_team_id(*)')
      .eq('status', 'finished')
      .order('scheduled_at', { ascending: false })
      .limit(10),
    supabase.from('match_reactions').select('*'),
    supabase.from('activity_feed')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30),
  ])

  const leaderboard = sortLeaderboard(lbRaw || [])

  return (
    <StatsClient
      leaderboard={leaderboard}
      finishedMatches={finishedMatches || []}
      reactions={reactions || []}
      activityFeed={activityFeed || []}
      currentUserId={user!.id}
    />
  )
}

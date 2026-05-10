import { createClient } from '@/lib/supabase/server'
import StatsClient from '@/components/stats/StatsClient'
import { sortLeaderboard } from '@/lib/points/calculate'

export const dynamic = 'force-dynamic'

export default async function StatsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: lbRaw } = await supabase.from('leaderboard').select('*')
  const leaderboard = sortLeaderboard(lbRaw || [])

  return <StatsClient leaderboard={leaderboard} currentUserId={user!.id} />
}

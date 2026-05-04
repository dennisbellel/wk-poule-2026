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

  return (
    <StandClient
      leaderboard={leaderboard}
      currentUserId={user!.id}
      matchPredictions={[]}
    />
  )
}
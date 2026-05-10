import { createClient } from '@/lib/supabase/server'
import { sortLeaderboard } from '@/lib/points/calculate'
import StandClient from '@/components/stand/StandClient'

export const dynamic = 'force-dynamic'

export default async function StandPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: lbRaw } = await supabase.from('leaderboard').select('*')
  const leaderboard = sortLeaderboard(lbRaw || [])

  // Vorige rangen ophalen om delta te berekenen
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, previous_rank')

  const prevRankByUser = new Map<string, number | null>()
  for (const p of profiles || []) prevRankByUser.set(p.id, (p as { previous_rank?: number | null }).previous_rank ?? null)

  const leaderboardWithDelta = leaderboard.map(entry => {
    const prev = prevRankByUser.get(entry.user_id) ?? null
    const delta = prev != null ? prev - entry.rank : null
    return { ...entry, previous_rank: prev, delta }
  })

  return (
    <StandClient
      leaderboard={leaderboardWithDelta}
      currentUserId={user!.id}
    />
  )
}

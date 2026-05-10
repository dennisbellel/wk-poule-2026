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

  // Percentage goede antwoorden per gebruiker
  const { data: finishedMatches } = await supabase
    .from('matches')
    .select('id, home_ft, away_ft, home_ht, away_ht, home_yellow, away_yellow, home_red, away_red')
    .eq('status', 'finished')

  const { data: allMatchPreds } = await supabase
    .from('match_predictions')
    .select('user_id, match_id, home_ft, away_ft, home_ht, away_ht, home_yellow, away_yellow, home_red, away_red')

  const { data: bonusQs } = await supabase
    .from('bonus_questions')
    .select('id, correct_answer')
    .not('correct_answer', 'is', null)

  const { data: allBonusAns } = await supabase
    .from('bonus_answers')
    .select('user_id, question_id, answer')

  // Per gebruiker: aantal correcte inputs en totaal mogelijke inputs (zelfde definitie als home)
  const correctByUser = new Map<string, { correct: number; total: number }>()
  for (const lbEntry of leaderboard) {
    correctByUser.set(lbEntry.user_id, { correct: 0, total: 0 })
  }

  type FieldKey = 'home_ft' | 'away_ft' | 'home_ht' | 'away_ht' | 'home_yellow' | 'away_yellow' | 'home_red' | 'away_red'
  const fields: FieldKey[] = ['home_ft', 'away_ft', 'home_ht', 'away_ht', 'home_yellow', 'away_yellow', 'home_red', 'away_red']

  for (const m of finishedMatches || []) {
    for (const f of fields) {
      const actual = (m as Record<string, number | null>)[f]
      if (actual === null) continue
      // Voor elke deelnemer telt dit als één mogelijke punt
      for (const lbEntry of leaderboard) {
        const stats = correctByUser.get(lbEntry.user_id)!
        stats.total++
        const userPred = (allMatchPreds || []).find(p => p.user_id === lbEntry.user_id && p.match_id === m.id)
        if (userPred && (userPred as Record<string, number | null>)[f] === actual) stats.correct++
      }
    }
  }

  for (const q of bonusQs || []) {
    if (!q.correct_answer) continue
    for (const lbEntry of leaderboard) {
      const stats = correctByUser.get(lbEntry.user_id)!
      stats.total++
      const userAns = (allBonusAns || []).find(a => a.user_id === lbEntry.user_id && a.question_id === q.id)
      if (userAns?.answer?.trim().toLowerCase() === q.correct_answer.trim().toLowerCase()) stats.correct++
    }
  }

  const leaderboardWithExtras = leaderboard.map(entry => {
    const prev = prevRankByUser.get(entry.user_id) ?? null
    const delta = prev != null ? prev - entry.rank : null
    const stats = correctByUser.get(entry.user_id) || { correct: 0, total: 0 }
    const correctPct = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0
    return { ...entry, previous_rank: prev, delta, correctPct, correctTotal: stats.total, correctCount: stats.correct }
  })

  return <StandClient leaderboard={leaderboardWithExtras} currentUserId={user!.id} />
}

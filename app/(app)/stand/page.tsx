import { createClient } from '@/lib/supabase/server'
import { sortLeaderboard } from '@/lib/points/calculate'
import { fetchAllRows } from '@/lib/supabase/fetchAll'
import StandClient from '@/components/stand/StandClient'

export const dynamic = 'force-dynamic'

type PredRow = { user_id: string; match_id: string } & Record<string, string | number | null>
type AnsRow = { user_id: string; question_id: string; answer: string | null }

export default async function StandPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [
    { data: lbRaw },
    { data: profiles },
    { data: finishedMatches },
    { data: bonusQs },
  ] = await Promise.all([
    supabase.from('leaderboard').select('*'),
    supabase.from('profiles').select('id, previous_rank'),
    supabase.from('matches')
      .select('id, home_ft, away_ft, home_ht, away_ht, home_yellow, away_yellow, home_red, away_red')
      .eq('status', 'finished'),
    supabase.from('bonus_questions')
      .select('id, correct_answer')
      .not('correct_answer', 'is', null),
  ])

  // Voorspellingen gebatcht ophalen — anders kapt PostgREST stilletjes af op
  // 1000 rijen en kloppen de percentages niet meer
  const [allMatchPreds, allBonusAns] = await Promise.all([
    fetchAllRows<PredRow>((from, to) =>
      supabase.from('match_predictions')
        .select('user_id, match_id, home_ft, away_ft, home_ht, away_ht, home_yellow, away_yellow, home_red, away_red')
        .order('id').range(from, to)
    ),
    fetchAllRows<AnsRow>((from, to) =>
      supabase.from('bonus_answers')
        .select('user_id, question_id, answer')
        .order('id').range(from, to)
    ),
  ])

  const leaderboard = sortLeaderboard(lbRaw || [])

  const prevRankByUser = new Map<string, number | null>()
  for (const p of profiles || []) prevRankByUser.set(p.id, (p as { previous_rank?: number | null }).previous_rank ?? null)

  // Snelle lookups op user+match / user+vraag in plaats van zoeken per veld
  const predByUserMatch = new Map(allMatchPreds.map(p => [`${p.user_id}|${p.match_id}`, p]))
  const ansByUserQ = new Map(allBonusAns.map(a => [`${a.user_id}|${a.question_id}`, a]))

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
        const userPred = predByUserMatch.get(`${lbEntry.user_id}|${m.id}`)
        if (userPred && (userPred as Record<string, number | null>)[f] === actual) stats.correct++
      }
    }
  }

  for (const q of bonusQs || []) {
    if (!q.correct_answer) continue
    for (const lbEntry of leaderboard) {
      const stats = correctByUser.get(lbEntry.user_id)!
      stats.total++
      const userAns = ansByUserQ.get(`${lbEntry.user_id}|${q.id}`)
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

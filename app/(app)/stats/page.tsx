import { createClient } from '@/lib/supabase/server'
import StatsClient from '@/components/stats/StatsClient'
import { sortLeaderboard } from '@/lib/points/calculate'
import { fetchAllRows } from '@/lib/supabase/fetchAll'

export const dynamic = 'force-dynamic'

type PredRow = {
  user_id: string
  match_id: string
  home_ft: number | null
  away_ft: number | null
  points: number | null
}

export default async function StatsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [
    { data: lbRaw },
    { data: myRankHistory },
    { data: finishedMatches },
    { data: profilesWithPrev },
  ] = await Promise.all([
    supabase.from('leaderboard').select('*'),
    // 1) Lijngrafiek: rank_history voor de huidige gebruiker
    supabase.from('rank_history')
      .select('rank, snapshotted_at')
      .eq('user_id', user!.id)
      .order('snapshotted_at', { ascending: true }),
    supabase.from('matches')
      .select('id, home_ft, away_ft')
      .eq('status', 'finished'),
    supabase.from('profiles').select('id, previous_rank'),
  ])

  const leaderboard = sortLeaderboard(lbRaw || [])

  // Eén gebatchte fetch (ipv twee aparte) — boven de 1000 rijen kapt PostgREST
  // anders stilletjes af en kloppen trefzekerheid en topscoorders niet meer
  const allMatchPreds = await fetchAllRows<PredRow>((from, to) =>
    supabase.from('match_predictions')
      .select('user_id, match_id, home_ft, away_ft, points')
      .order('id').range(from, to)
  )

  const predByUserMatch = new Map(allMatchPreds.map(p => [`${p.user_id}|${p.match_id}`, p]))
  const predsByMatch = new Map<string, PredRow[]>()
  for (const p of allMatchPreds) {
    const list = predsByMatch.get(p.match_id)
    if (list) list.push(p)
    else predsByMatch.set(p.match_id, [p])
  }

  // 2) Trefzekerheid (% exact eindstand goed) per gebruiker
  const exactByUser = new Map<string, { exact: number; predicted: number }>()
  for (const e of leaderboard) exactByUser.set(e.user_id, { exact: 0, predicted: 0 })

  for (const m of finishedMatches || []) {
    if (m.home_ft === null || m.away_ft === null) continue
    for (const e of leaderboard) {
      const userPred = predByUserMatch.get(`${e.user_id}|${m.id}`)
      if (!userPred || userPred.home_ft === null || userPred.away_ft === null) continue
      const stats = exactByUser.get(e.user_id)!
      stats.predicted++
      if (userPred.home_ft === m.home_ft && userPred.away_ft === m.away_ft) stats.exact++
    }
  }

  const accuracy = leaderboard.map(e => {
    const s = exactByUser.get(e.user_id) || { exact: 0, predicted: 0 }
    return {
      user_id: e.user_id,
      display_name: e.display_name,
      exact: s.exact,
      predicted: s.predicted,
      pct: s.predicted > 0 ? Math.round((s.exact / s.predicted) * 100) : 0,
    }
  }).sort((a, b) => {
    if (b.pct !== a.pct) return b.pct - a.pct
    return b.exact - a.exact
  })

  // 3) Topscoorder per wedstrijd: per finished match wie de hoogste mp.points had
  const topScorerByMatch = new Map<string, string>() // `match-user` → user_id
  for (const m of finishedMatches || []) {
    const preds = (predsByMatch.get(m.id) || []).filter(p => (p.points ?? 0) > 0)
    if (preds.length === 0) continue
    const maxPts = Math.max(...preds.map(p => p.points ?? 0))
    const winners = preds.filter(p => p.points === maxPts)
    // Bij gelijkspel iedereen tellen
    for (const w of winners) topScorerByMatch.set(`${m.id}-${w.user_id}`, w.user_id)
  }
  const topScorerCount = new Map<string, number>()
  for (const [, uid] of topScorerByMatch) {
    topScorerCount.set(uid, (topScorerCount.get(uid) || 0) + 1)
  }
  const topScorerRanking = leaderboard.map(e => ({
    user_id: e.user_id,
    display_name: e.display_name,
    count: topScorerCount.get(e.user_id) || 0,
  })).sort((a, b) => b.count - a.count).slice(0, 8)

  // 4) Klimmer: grootste rank-stijging tov previous_rank
  const prevById = new Map((profilesWithPrev || []).map(p => [p.id, (p as { previous_rank?: number | null }).previous_rank ?? null]))
  const movers = leaderboard.map(e => {
    const prev = prevById.get(e.user_id) ?? null
    const delta = prev != null ? prev - e.rank : null
    return { user_id: e.user_id, display_name: e.display_name, rank: e.rank, delta }
  })
  const climbers = movers.filter(c => c.delta != null && c.delta > 0)
    .sort((a, b) => (b.delta ?? 0) - (a.delta ?? 0))
    .slice(0, 5)
  const fallers = movers.filter(c => c.delta != null && c.delta < 0)
    .sort((a, b) => (a.delta ?? 0) - (b.delta ?? 0))
    .slice(0, 5)

  return (
    <StatsClient
      leaderboardSize={leaderboard.length}
      currentUserId={user!.id}
      myRankHistory={(myRankHistory || []).map(r => ({ rank: r.rank, at: r.snapshotted_at }))}
      accuracy={accuracy.slice(0, 8)}
      topScorers={topScorerRanking}
      climbers={climbers}
      fallers={fallers}
    />
  )
}

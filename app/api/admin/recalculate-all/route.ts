import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { calculateMatchPoints, calculateGroupStandingPoints, calculateBonusPoints, sortLeaderboard, computeActualStandings } from '@/lib/points/calculate'
import { fetchAllRows } from '@/lib/supabase/fetchAll'
import { DEFAULT_SCORING, SCORING_LABELS, type ScoringKeys, type Match, type MatchPrediction, type GroupStandingPrediction, type BonusQuestion, type BonusAnswer, type LeaderboardEntry } from '@/types'

// Alle bekende scoring-keys met hun default — automatisch in sync met types
const NEW_SCORING_DEFAULTS = (Object.keys(SCORING_LABELS) as (keyof ScoringKeys)[]).map(k => ({
  key: k,
  value: DEFAULT_SCORING[k],
  label_nl: SCORING_LABELS[k].label,
  category: SCORING_LABELS[k].category,
}))

// Oude keys die vervangen zijn — worden verwijderd zodat ze niet meer optellen of verwarring geven
const OLD_KEYS_TO_REMOVE = [
  'exact_ft', 'correct_outcome', 'exact_ht', 'exact_yellow', 'exact_red',
  'match_ft_team', 'match_ht_team', 'match_yellow_team', 'match_red_team',
]

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = await createAdminClient()

  // 0) Snapshot huidige ranks naar previous_rank — zodat de leaderboard delta's kan tonen
  const { data: lbBefore } = await admin.from('leaderboard').select('*')
  if (lbBefore) {
    const ranked = sortLeaderboard(lbBefore as LeaderboardEntry[])
    await Promise.all(
      ranked.map(r =>
        admin.from('profiles').update({ previous_rank: r.rank }).eq('id', r.user_id)
      )
    )
  }

  // 1) Migreer scoring_config: voeg nieuwe keys toe (idempotent), verwijder oude
  for (const row of NEW_SCORING_DEFAULTS) {
    await admin.from('scoring_config').upsert(
      { key: row.key, value: row.value, label_nl: row.label_nl, category: row.category },
      { onConflict: 'key', ignoreDuplicates: true }
    )
  }
  await admin.from('scoring_config').delete().in('key', OLD_KEYS_TO_REMOVE)

  // 2) Laad de huidige scoring config
  const { data: scoringRows } = await admin.from('scoring_config').select('key, value')
  const scoring = { ...DEFAULT_SCORING } as ScoringKeys
  for (const row of scoringRows || []) {
    if (row.key in scoring) (scoring as unknown as Record<string, number>)[row.key] = row.value
  }

  // 3) Herbereken alle match_predictions.
  // Voorspellingen gebatcht ophalen — boven de 1000 rijen kapt PostgREST anders
  // stilletjes af en zou een deel van de deelnemers verkeerde punten houden.
  const { data: allMatches } = await admin.from('matches').select('*')
  const finishedMatches = (allMatches || []).filter((m: Match) => m.status === 'finished')
  const matchPreds = await fetchAllRows<MatchPrediction>((from, to) =>
    admin.from('match_predictions').select('*').order('id').range(from, to)
  )

  let matchUpdated = 0
  const matchById = new Map(finishedMatches.map((m: Match) => [m.id, m]))
  {
    const updates = matchPreds
      .map((pred) => {
        const match = matchById.get(pred.match_id)
        const points = match ? calculateMatchPoints(match, pred, scoring) : 0
        return { id: pred.id, points, changed: points !== (pred.points ?? 0) }
      })
      .filter(u => u.changed)
    await Promise.all(
      updates.map(u =>
        admin.from('match_predictions').update({ points: u.points }).eq('id', u.id)
      )
    )
    matchUpdated = updates.length
  }

  // 4) Herbereken bonus_answers
  const { data: bonusQs } = await admin.from('bonus_questions').select('*')
  const bonusAns = await fetchAllRows<BonusAnswer>((from, to) =>
    admin.from('bonus_answers').select('*').order('id').range(from, to)
  )
  let bonusUpdated = 0
  {
    const qById = new Map((bonusQs || []).map((q: BonusQuestion) => [q.id, q]))
    const updates = bonusAns
      .map((ans) => {
        const q = qById.get(ans.question_id)
        const points = q?.correct_answer
          ? calculateBonusPoints(ans.answer, q.correct_answer, q.points_value || scoring.bonus_default)
          : 0
        return { id: ans.id, points, changed: points !== (ans.points ?? 0) }
      })
      .filter(u => u.changed)
    await Promise.all(
      updates.map(u =>
        admin.from('bonus_answers').update({ points: u.points }).eq('id', u.id)
      )
    )
    bonusUpdated = updates.length
  }

  // 5) Herbereken group_standing_predictions op basis van de werkelijke poulestand.
  // Punten tellen pas zodra een groep COMPLEET gespeeld is — een halve stand
  // zou tussentijds posities belonen die aan het eind weer kunnen omdraaien.
  let groupUpdated = 0
  const groupTotals = new Map<string, { total: number; finished: number }>()
  for (const m of allMatches || []) {
    if (m.phase !== 'group' || !m.group_id) continue
    const t = groupTotals.get(m.group_id) || { total: 0, finished: 0 }
    t.total++
    if (m.status === 'finished') t.finished++
    groupTotals.set(m.group_id, t)
  }
  const completeGroups = new Set(
    [...groupTotals.entries()].filter(([, t]) => t.total > 0 && t.finished === t.total).map(([g]) => g)
  )

  const standings = computeActualStandings(
    finishedMatches.filter((m: Match) => m.phase === 'group' && m.group_id && completeGroups.has(m.group_id))
  )
  const groupPreds = await fetchAllRows<GroupStandingPrediction>((from, to) =>
    admin.from('group_standing_predictions').select('*').order('id').range(from, to)
  )
  {
    const updates = groupPreds
      .map((pred) => {
        const groupStandings = standings.get(pred.group_id) || []
        const teamStanding = groupStandings.find(s => s.team_id === pred.team_id)
        const points = calculateGroupStandingPoints(pred, teamStanding, scoring)
        return { id: pred.id, points, changed: points !== (pred.points ?? 0) }
      })
      .filter(u => u.changed)
    await Promise.all(
      updates.map(u =>
        admin.from('group_standing_predictions').update({ points: u.points }).eq('id', u.id)
      )
    )
    groupUpdated = updates.length
  }

  // Snapshot na recalculate naar rank_history
  const { data: lbAfter } = await admin.from('leaderboard').select('*')
  if (lbAfter) {
    const ranked = sortLeaderboard(lbAfter as LeaderboardEntry[])
    await admin.from('rank_history').insert(
      ranked.map(r => ({ user_id: r.user_id, rank: r.rank, total_points: r.total_points }))
    )
  }

  return NextResponse.json({
    ok: true,
    match_predictions_updated: matchUpdated,
    bonus_answers_updated: bonusUpdated,
    group_predictions_updated: groupUpdated,
  })
}

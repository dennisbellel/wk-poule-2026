import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { calculateMatchPoints, calculateGroupStandingPoints, calculateBonusPoints, type ActualGroupStanding } from '@/lib/points/calculate'
import { DEFAULT_SCORING, type ScoringKeys, type Match, type MatchPrediction, type GroupStandingPrediction, type BonusQuestion, type BonusAnswer } from '@/types'

const NEW_SCORING_DEFAULTS: { key: keyof ScoringKeys; value: number; label_nl: string; category: string }[] = [
  { key: 'match_ft_team', value: DEFAULT_SCORING.match_ft_team, label_nl: 'Eindstand per team correct', category: 'Wedstrijd' },
  { key: 'match_ft_exact_bonus', value: DEFAULT_SCORING.match_ft_exact_bonus, label_nl: 'Bonus: eindstand volledig exact', category: 'Wedstrijd' },
  { key: 'match_ht_team', value: DEFAULT_SCORING.match_ht_team, label_nl: 'Ruststand per team correct', category: 'Wedstrijd' },
  { key: 'match_ht_exact_bonus', value: DEFAULT_SCORING.match_ht_exact_bonus, label_nl: 'Bonus: ruststand volledig exact', category: 'Wedstrijd' },
  { key: 'match_yellow_team', value: DEFAULT_SCORING.match_yellow_team, label_nl: 'Gele kaarten per team correct', category: 'Wedstrijd' },
  { key: 'match_red_team', value: DEFAULT_SCORING.match_red_team, label_nl: 'Rode kaarten per team correct', category: 'Wedstrijd' },
]

// Oude keys die vervangen zijn — worden verwijderd zodat ze niet meer optellen of verwarring geven
const OLD_KEYS_TO_REMOVE = ['exact_ft', 'correct_outcome', 'exact_ht', 'exact_yellow', 'exact_red']

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = await createAdminClient()

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

  // 3) Herbereken alle match_predictions
  const { data: matches } = await admin.from('matches').select('*').eq('status', 'finished')
  const { data: matchPreds } = await admin.from('match_predictions').select('*')

  let matchUpdated = 0
  if (matches && matchPreds) {
    const matchById = new Map(matches.map((m: Match) => [m.id, m]))
    const updates = matchPreds.map((pred: MatchPrediction) => {
      const match = matchById.get(pred.match_id)
      const points = match ? calculateMatchPoints(match, pred, scoring) : 0
      return { id: pred.id, points }
    })
    await Promise.all(
      updates.map(u =>
        admin.from('match_predictions').update({ points: u.points }).eq('id', u.id)
      )
    )
    matchUpdated = updates.length
  }

  // 4) Herbereken bonus_answers
  const { data: bonusQs } = await admin.from('bonus_questions').select('*')
  const { data: bonusAns } = await admin.from('bonus_answers').select('*')
  let bonusUpdated = 0
  if (bonusQs && bonusAns) {
    const qById = new Map(bonusQs.map((q: BonusQuestion) => [q.id, q]))
    const updates = bonusAns.map((ans: BonusAnswer) => {
      const q = qById.get(ans.question_id)
      const points = q?.correct_answer
        ? calculateBonusPoints(ans.answer, q.correct_answer, q.points_value || scoring.bonus_default)
        : 0
      return { id: ans.id, points }
    })
    await Promise.all(
      updates.map(u =>
        admin.from('bonus_answers').update({ points: u.points }).eq('id', u.id)
      )
    )
    bonusUpdated = updates.length
  }

  // 5) Herbereken group_standing_predictions op basis van werkelijke poulestand
  // Werkelijke poulestand wordt bepaald door alle gespeelde groepswedstrijden te aggregeren.
  let groupUpdated = 0
  const groupMatches = (matches || []).filter((m: Match) => m.phase === 'group')
  if (groupMatches.length > 0) {
    const standings = computeActualStandings(groupMatches)
    const { data: groupPreds } = await admin.from('group_standing_predictions').select('*')
    if (groupPreds) {
      const updates = groupPreds.map((pred: GroupStandingPrediction) => {
        const groupStandings = standings.get(pred.group_id) || []
        const teamStanding = groupStandings.find(s => s.team_id === pred.team_id)
        const points = calculateGroupStandingPoints(pred, teamStanding, scoring)
        return { id: pred.id, points }
      })
      await Promise.all(
        updates.map(u =>
          admin.from('group_standing_predictions').update({ points: u.points }).eq('id', u.id)
        )
      )
      groupUpdated = updates.length
    }
  }

  return NextResponse.json({
    ok: true,
    match_predictions_updated: matchUpdated,
    bonus_answers_updated: bonusUpdated,
    group_predictions_updated: groupUpdated,
  })
}

// Bepaal werkelijke poulestand uit gespeelde wedstrijden
function computeActualStandings(matches: Match[]): Map<string, ActualGroupStanding[]> {
  const byGroup = new Map<string, Map<string, ActualGroupStanding>>()

  for (const m of matches) {
    if (!m.group_id || m.home_ft === null || m.away_ft === null) continue
    if (!m.home_team_id || !m.away_team_id) continue

    if (!byGroup.has(m.group_id)) byGroup.set(m.group_id, new Map())
    const g = byGroup.get(m.group_id)!

    const ensure = (teamId: string): ActualGroupStanding => {
      if (!g.has(teamId)) {
        g.set(teamId, { team_id: teamId, position: 0, points: 0, goals_for: 0, goals_against: 0, yellow_cards: 0, red_cards: 0 })
      }
      return g.get(teamId)!
    }

    const home = ensure(m.home_team_id)
    const away = ensure(m.away_team_id)

    home.goals_for += m.home_ft
    home.goals_against += m.away_ft
    away.goals_for += m.away_ft
    away.goals_against += m.home_ft
    home.yellow_cards += m.home_yellow ?? 0
    away.yellow_cards += m.away_yellow ?? 0
    home.red_cards += m.home_red ?? 0
    away.red_cards += m.away_red ?? 0

    if (m.home_ft > m.away_ft) home.points += 3
    else if (m.away_ft > m.home_ft) away.points += 3
    else { home.points += 1; away.points += 1 }
  }

  // Sorteer per groep en wijs posities toe
  const result = new Map<string, ActualGroupStanding[]>()
  for (const [groupId, teams] of byGroup) {
    const sorted = [...teams.values()].sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points
      const aDiff = a.goals_for - a.goals_against
      const bDiff = b.goals_for - b.goals_against
      if (bDiff !== aDiff) return bDiff - aDiff
      return b.goals_for - a.goals_for
    })
    sorted.forEach((s, i) => { s.position = i + 1 })
    result.set(groupId, sorted)
  }
  return result
}

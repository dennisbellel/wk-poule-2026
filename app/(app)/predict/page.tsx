import { createClient } from '@/lib/supabase/server'
import PredictClient from '@/components/predict/PredictClient'
import { computeActualStandings, type ActualGroupStanding } from '@/lib/points/calculate'
import { DEFAULT_SCORING, type ScoringKeys, type Player, type Match } from '@/types'

export default async function PredictPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // All group matches
  const { data: groupMatches } = await supabase
    .from('matches')
    .select('*, home_team:home_team_id(*), away_team:away_team_id(*)')
    .eq('phase', 'group')
    .order('scheduled_at', { ascending: true })

  // Knockout matches
  const { data: koMatches } = await supabase
    .from('matches')
    .select('*, home_team:home_team_id(*), away_team:away_team_id(*)')
    .neq('phase', 'group')
    .order('scheduled_at', { ascending: true })

  // User's match predictions
  const { data: matchPredictions } = await supabase
    .from('match_predictions')
    .select('*')
    .eq('user_id', user!.id)

  // User's group standing predictions
  const { data: groupPredictions } = await supabase
    .from('group_standing_predictions')
    .select('*, team:team_id(*)')
    .eq('user_id', user!.id)
    .order('position', { ascending: true })

  // All teams (for group standing picker)
  const { data: teams } = await supabase
    .from('teams')
    .select('*')
    .order('group_id', { ascending: true })

  // Bonus questions
  const { data: bonusQuestions } = await supabase
    .from('bonus_questions')
    .select('*')
    .eq('active', true)
    .order('sort_order', { ascending: true })

  // User's bonus answers
  const { data: bonusAnswers } = await supabase
    .from('bonus_answers')
    .select('*')
    .eq('user_id', user!.id)

  // All players — in batches om PostgREST max-rows 1000 te omzeilen, ongeacht
  // de project-instelling
  const allPlayers: Player[] = []
  const PAGE = 500
  let from = 0
  while (true) {
    const { data: batch } = await supabase
      .from('players')
      .select('*, team:team_id(*)')
      .order('name', { ascending: true })
      .range(from, from + PAGE - 1)
    if (!batch || batch.length === 0) break
    allPlayers.push(...(batch as unknown as Player[]))
    if (batch.length < PAGE) break
    from += PAGE
    if (from > 10000) break
  }
  const players = allPlayers

  // Instelbare poulestand-deadline (kan ontbreken zolang de migratie niet gedraaid is)
  const { data: groupDeadlineRow } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'group_predictions_deadline_at')
    .maybeSingle()

  // Scoring config — bepaalt punten per onderdeel in de kaart
  const { data: scoringRows } = await supabase.from('scoring_config').select('key, value')
  const scoring = { ...DEFAULT_SCORING } as ScoringKeys
  for (const row of scoringRows || []) {
    if (row.key in scoring) (scoring as unknown as Record<string, number>)[row.key] = row.value
  }

  // Echte poulestand per AFGERONDE groep (alle wedstrijden gespeeld) — voor de
  // feedback "had ik het goed?" op het poulestand-scherm. Wordt uit dezelfde
  // wedstrijduitslagen berekend als de scoring, dus altijd consistent.
  const gm = (groupMatches || []) as unknown as Match[]
  const totalByGroup = new Map<string, number>()
  const finishedByGroup = new Map<string, number>()
  for (const m of gm) {
    if (!m.group_id) continue
    totalByGroup.set(m.group_id, (totalByGroup.get(m.group_id) ?? 0) + 1)
    if (m.status === 'finished') finishedByGroup.set(m.group_id, (finishedByGroup.get(m.group_id) ?? 0) + 1)
  }
  const completeGroups = new Set(
    [...totalByGroup].filter(([g, t]) => t > 0 && finishedByGroup.get(g) === t).map(([g]) => g)
  )
  const standingsMap = computeActualStandings(
    gm.filter(m => m.status === 'finished' && m.group_id && completeGroups.has(m.group_id))
  )
  const actualGroupStandings: Record<string, ActualGroupStanding[]> = {}
  for (const g of completeGroups) actualGroupStandings[g] = standingsMap.get(g) ?? []

  return (
    <PredictClient
      userId={user!.id}
      groupMatches={groupMatches || []}
      koMatches={koMatches || []}
      matchPredictions={matchPredictions || []}
      groupPredictions={groupPredictions || []}
      teams={teams || []}
      bonusQuestions={bonusQuestions || []}
      bonusAnswers={bonusAnswers || []}
      players={players || []}
      scoring={scoring}
      groupDeadline={groupDeadlineRow?.value ?? null}
      actualGroupStandings={actualGroupStandings}
    />
  )
}

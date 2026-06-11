import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { calculateMatchPoints, calculateGroupStandingPoints, computeActualStandings, sortLeaderboard } from '@/lib/points/calculate'
import { fetchAllRows } from '@/lib/supabase/fetchAll'
import { DEFAULT_SCORING, type ScoringKeys, type Match, type MatchPrediction, type GroupStandingPrediction, type LeaderboardEntry } from '@/types'

interface PublishBody {
  match_id: string
  home_ft: number
  away_ft: number
  home_ht: number
  away_ht: number
  home_yellow: number
  away_yellow: number
  home_red: number
  away_red: number
  penalties?: boolean
  home_et?: number | null
  away_et?: number | null
  winner_team_id?: string | null
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json() as PublishBody
  if (!body.match_id) return NextResponse.json({ error: 'match_id required' }, { status: 400 })

  const admin = await createAdminClient()

  // Eerst de huidige match-staat ophalen — we bepalen hieraan of dit een eerste
  // publicatie is of een correctie op een al gepubliceerde uitslag.
  const { data: dbMatch, error: matchErr } = await admin
    .from('matches').select('*').eq('id', body.match_id).single()
  if (matchErr || !dbMatch) return NextResponse.json({ error: 'Match not found' }, { status: 404 })

  const isFirstPublish = dbMatch.status !== 'finished'

  // Alleen bij de eerste publicatie van deze wedstrijd previous_rank vastpinnen,
  // anders raak je bij een correctie de delta-info kwijt (zou steeds 0 worden).
  if (isFirstPublish) {
    const { data: lbBefore } = await admin.from('leaderboard').select('*')
    if (lbBefore) {
      const ranked = sortLeaderboard(lbBefore as LeaderboardEntry[])
      await Promise.all(
        ranked.map(r =>
          admin.from('profiles').update({ previous_rank: r.rank }).eq('id', r.user_id)
        )
      )
    }
  }

  // Bepaal winner automatisch op basis van eindstand (alleen als niet expliciet meegegeven)
  let winnerTeamId = body.winner_team_id ?? null
  if (winnerTeamId === null) {
    if (body.home_ft > body.away_ft) winnerTeamId = dbMatch.home_team_id
    else if (body.away_ft > body.home_ft) winnerTeamId = dbMatch.away_team_id
  }

  const updatedMatch = {
    home_ft: body.home_ft,
    away_ft: body.away_ft,
    home_ht: body.home_ht,
    away_ht: body.away_ht,
    home_yellow: body.home_yellow,
    away_yellow: body.away_yellow,
    home_red: body.home_red,
    away_red: body.away_red,
    penalties: body.penalties ?? false,
    home_et: body.home_et ?? null,
    away_et: body.away_et ?? null,
    winner_team_id: winnerTeamId,
    status: 'finished' as const,
    updated_at: new Date().toISOString(),
  }

  const { error: updErr } = await admin.from('matches').update(updatedMatch).eq('id', body.match_id)
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

  await admin.from('pending_results').upsert({
    match_id: body.match_id,
    home_ft: body.home_ft, away_ft: body.away_ft,
    home_ht: body.home_ht, away_ht: body.away_ht,
    home_yellow: body.home_yellow, away_yellow: body.away_yellow,
    home_red: body.home_red, away_red: body.away_red,
    penalties: body.penalties ?? false,
    status: 'published',
    published_at: new Date().toISOString(),
  }, { onConflict: 'match_id' })

  // Scoring config laden — bovenop de defaults, zodat een key die (nog) niet
  // in de database staat nooit tot NaN-punten leidt
  const { data: scoringRows } = await admin.from('scoring_config').select('*')
  const scoring = { ...DEFAULT_SCORING } as ScoringKeys
  for (const r of scoringRows || []) {
    if (r.key in scoring) (scoring as unknown as Record<string, number>)[r.key] = r.value
  }

  // Herbereken punten voor alle voorspellingen op deze wedstrijd
  const { data: predictions } = await admin
    .from('match_predictions').select('*').eq('match_id', body.match_id)

  const fullMatch = { ...dbMatch, ...updatedMatch } as Match
  let recalculated = 0

  if (predictions && predictions.length > 0) {
    const updates = predictions.map((pred: MatchPrediction) => ({
      id: pred.id,
      points: calculateMatchPoints(fullMatch, pred, scoring),
    }))

    await Promise.all(
      updates.map(u =>
        admin.from('match_predictions').update({ points: u.points }).eq('id', u.id)
      )
    )
    recalculated = updates.length
  }

  // Poulestand-punten automatisch bijwerken zodra deze groep compleet gespeeld
  // is — de admin hoeft dan niet meer aan "herbereken alles" te denken.
  // Punten tellen pas bij een complete groep; een halve stand zou tussentijds
  // posities belonen die aan het eind weer kunnen omdraaien.
  let groupRecalculated = 0
  if (fullMatch.phase === 'group' && fullMatch.group_id) {
    const { data: groupMatchRows } = await admin
      .from('matches').select('*')
      .eq('phase', 'group').eq('group_id', fullMatch.group_id)
    const groupComplete = (groupMatchRows || []).length > 0 &&
      (groupMatchRows || []).every((m: Match) => m.status === 'finished')

    if (groupComplete) {
      const standings = computeActualStandings(groupMatchRows as Match[]).get(fullMatch.group_id) || []
      const groupPreds = await fetchAllRows<GroupStandingPrediction>((from, to) =>
        admin.from('group_standing_predictions').select('*')
          .eq('group_id', fullMatch.group_id).order('id').range(from, to)
      )
      const updates = groupPreds
        .map(pred => ({
          id: pred.id,
          points: calculateGroupStandingPoints(pred, standings.find(s => s.team_id === pred.team_id), scoring),
          prev: pred.points ?? 0,
        }))
        .filter(u => u.points !== u.prev)
      await Promise.all(
        updates.map(u =>
          admin.from('group_standing_predictions').update({ points: u.points }).eq('id', u.id)
        )
      )
      groupRecalculated = updates.length
    }
  }

  // Activity feed entry — best effort, niet blocking
  try {
    await admin.rpc('generate_match_activity', { p_match_id: body.match_id })
  } catch {
    // RPC bestaat misschien niet in alle omgevingen
  }

  // Snapshot nieuwe ranks alleen bij eerste publicatie (correcties zorgen anders
  // voor dubbele dots in de lijngrafiek op stats)
  if (isFirstPublish) {
    const { data: lbAfter } = await admin.from('leaderboard').select('*')
    if (lbAfter) {
      const ranked = sortLeaderboard(lbAfter as LeaderboardEntry[])
      await admin.from('rank_history').insert(
        ranked.map(r => ({ user_id: r.user_id, rank: r.rank, total_points: r.total_points }))
      )
    }
  }

  return NextResponse.json({ ok: true, recalculated, group_recalculated: groupRecalculated })
}

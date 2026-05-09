import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getFinishedMatches, getMatchEvents, mapStatus } from '@/lib/api-football/client'
import { calculateMatchPoints } from '@/lib/points/calculate'
import type { ScoringKeys } from '@/types'

export async function POST(request: Request) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.SYNC_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createAdminClient()
  let matchesUpdated = 0

  try {
    const { data: scoringRows } = await supabase.from('scoring_config').select('*')
    const scoring = Object.fromEntries(
      (scoringRows || []).map(r => [r.key, r.value])
    ) as unknown as ScoringKeys

    const finishedMatches = await getFinishedMatches()

    for (const fm of finishedMatches) {
      const { data: dbMatch } = await supabase
        .from('matches')
        .select('*')
        .eq('fd_match_id', fm.fixture.id)
        .single()

      if (!dbMatch) continue

      const homeFT = fm.score.fulltime.home
      const awayFT = fm.score.fulltime.away
      if (homeFT === null || awayFT === null) continue
      if (dbMatch.status === 'finished' && dbMatch.home_ft === homeFT && dbMatch.away_ft === awayFT) continue

      // Get card events
      const events = await getMatchEvents(fm.fixture.id)
      const homeYellow = events.filter(e => e.team.id === fm.teams.home.id && e.type === 'Card' && e.detail === 'Yellow Card').length
      const awayYellow = events.filter(e => e.team.id === fm.teams.away.id && e.type === 'Card' && e.detail === 'Yellow Card').length
      const homeRed = events.filter(e => e.team.id === fm.teams.home.id && e.type === 'Card' && (e.detail === 'Red Card' || e.detail === 'Second Yellow card')).length
      const awayRed = events.filter(e => e.team.id === fm.teams.away.id && e.type === 'Card' && (e.detail === 'Red Card' || e.detail === 'Second Yellow card')).length

      const penalties = fm.score.penalty.home !== null
      const winner = homeFT > awayFT ? dbMatch.home_team_id : awayFT > homeFT ? dbMatch.away_team_id : null

      await supabase.from('matches').update({
        status: 'finished',
        home_ht: fm.score.halftime.home,
        away_ht: fm.score.halftime.away,
        home_ft: homeFT,
        away_ft: awayFT,
        home_et: fm.score.extratime.home,
        away_et: fm.score.extratime.away,
        penalties,
        winner_team_id: winner,
        home_yellow: homeYellow,
        away_yellow: awayYellow,
        home_red: homeRed,
        away_red: awayRed,
        updated_at: new Date().toISOString(),
      }).eq('id', dbMatch.id)

      // Recalculate points
      const { data: predictions } = await supabase
        .from('match_predictions')
        .select('*')
        .eq('match_id', dbMatch.id)

      if (predictions && predictions.length > 0) {
        const updatedMatch = {
          ...dbMatch, home_ft: homeFT, away_ft: awayFT,
          home_ht: fm.score.halftime.home, away_ht: fm.score.halftime.away,
          status: 'finished' as const, penalties,
          home_yellow: homeYellow, away_yellow: awayYellow,
          home_red: homeRed, away_red: awayRed,
          winner_team_id: winner,
        }
        await Promise.all(
          predictions.map(pred => {
            const points = calculateMatchPoints(updatedMatch as never, pred as never, scoring)
            return supabase.from('match_predictions').update({ points }).eq('id', pred.id)
          })
        )
      }

      await supabase.rpc('generate_match_activity', { p_match_id: dbMatch.id })
      matchesUpdated++
    }

    await supabase.from('sync_log').insert({ matches_updated: matchesUpdated, status: 'success' })
    return NextResponse.json({ ok: true, matchesUpdated })

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    await supabase.from('sync_log').insert({ status: 'error', error: msg })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getCompetitionMatches, mapStatus, mapPhase } from '@/lib/football-data/client'
import { calculateMatchPoints } from '@/lib/points/calculate'
import type { ScoringKeys } from '@/types'

export async function POST(request: Request) {
  // Protect with sync secret
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.SYNC_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createAdminClient()
  let matchesUpdated = 0

  try {
    // Get scoring config
    const { data: scoringRows } = await supabase.from('scoring_config').select('*')
    const scoring: ScoringKeys = Object.fromEntries(
      (scoringRows || []).map(r => [r.key, r.value])
    ) as unknown as ScoringKeys

    // Fetch matches from API
    const fdMatches = await getCompetitionMatches()

    for (const fdMatch of fdMatches) {
      if (fdMatch.status !== 'FINISHED') continue

      // Find match in DB by fd_match_id
      const { data: dbMatch } = await supabase
        .from('matches')
        .select('*')
        .eq('fd_match_id', fdMatch.id)
        .single()

      if (!dbMatch) continue

      const newStatus = mapStatus(fdMatch.status)
      const homeHT = fdMatch.score.halfTime.home
      const awayHT = fdMatch.score.halfTime.away
      const homeFT = fdMatch.score.fullTime.home
      const awayFT = fdMatch.score.fullTime.away
      const penalties = fdMatch.score.duration === 'PENALTY_SHOOTOUT'
      const hasET = ['EXTRA_TIME', 'PENALTY_SHOOTOUT'].includes(fdMatch.score.duration)

      // Skip if already up to date
      if (dbMatch.status === 'finished' && dbMatch.home_ft === homeFT && dbMatch.away_ft === awayFT) continue

      // Update match result
      await supabase.from('matches').update({
        status: newStatus,
        home_ht: homeHT,
        away_ht: awayHT,
        home_ft: homeFT,
        away_ft: awayFT,
        penalties,
        updated_at: new Date().toISOString(),
      }).eq('id', dbMatch.id)

      matchesUpdated++

      // Calculate points for all predictions on this match
      const { data: predictions } = await supabase
        .from('match_predictions')
        .select('*')
        .eq('match_id', dbMatch.id)

      if (predictions) {
        for (const pred of predictions) {
          const updatedMatch = { ...dbMatch, home_ht: homeHT, away_ht: awayHT, home_ft: homeFT, away_ft: awayFT, status: 'finished' as const, penalties }
          const points = calculateMatchPoints(updatedMatch as never, pred as never, scoring)
          await supabase.from('match_predictions').update({ points }).eq('id', pred.id)
        }
      }

      // Generate activity feed events
      await supabase.rpc('generate_match_activity', { p_match_id: dbMatch.id })
    }

    // Log sync
    await supabase.from('sync_log').insert({ matches_updated: matchesUpdated, status: 'success' })

    return NextResponse.json({ ok: true, matchesUpdated })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await supabase.from('sync_log').insert({ status: 'error', error: message })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// Allow manual GET trigger from admin dashboard
export async function GET(request: Request) {
  return POST(request)
}

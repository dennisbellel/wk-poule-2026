import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { calculateMatchPoints } from '@/lib/points/calculate'
import { DEFAULT_SCORING, type ScoringKeys, type Match, type MatchPrediction } from '@/types'

// Admin slaat voorspellingen op namens een andere deelnemer.
// Drie types: 'match' (wedstrijd), 'bonus' (vraag), 'group' (poulestand).
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: callerProfile } = await supabase
    .from('profiles').select('is_admin').eq('id', user.id).single()
  if (!callerProfile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json() as {
    type: 'match' | 'bonus' | 'group'
    user_id: string
    payload: Record<string, unknown>
  }
  if (!body.user_id || !body.type) {
    return NextResponse.json({ error: 'type en user_id verplicht' }, { status: 400 })
  }

  const admin = await createAdminClient()

  if (body.type === 'match') {
    const { match_id, ...fields } = body.payload as { match_id: string }
    if (!match_id) return NextResponse.json({ error: 'match_id verplicht' }, { status: 400 })

    // Is de wedstrijd al gespeeld? Dan moeten we na het opslaan de punten van
    // déze voorspelling direct herberekenen, zodat de tussenstand meteen klopt.
    const { data: dbMatch } = await admin
      .from('matches').select('*').eq('id', match_id).single()

    let points: number | undefined
    if (dbMatch?.status === 'finished') {
      const { data: scoringRows } = await admin.from('scoring_config').select('key, value')
      const scoring = { ...DEFAULT_SCORING } as ScoringKeys
      for (const r of scoringRows || []) {
        if (r.key in scoring) (scoring as unknown as Record<string, number>)[r.key] = r.value
      }
      points = calculateMatchPoints(dbMatch as Match, { ...(fields as Partial<MatchPrediction>) } as MatchPrediction, scoring)
    }

    const { error } = await admin
      .from('match_predictions')
      .upsert(
        { user_id: body.user_id, match_id, ...fields, ...(points !== undefined ? { points } : {}) },
        { onConflict: 'user_id,match_id' }
      )
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, points: points ?? null })
  }

  if (body.type === 'bonus') {
    const { question_id, answer } = body.payload as { question_id: string; answer: string }
    if (!question_id) return NextResponse.json({ error: 'question_id verplicht' }, { status: 400 })
    const { error } = await admin
      .from('bonus_answers')
      .upsert({ user_id: body.user_id, question_id, answer }, { onConflict: 'user_id,question_id' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (body.type === 'group') {
    const { groupId, rows } = body.payload as { groupId?: string; rows?: Array<Record<string, unknown>> }
    if (!groupId || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'groupId en rows verplicht' }, { status: 400 })
    }
    // Atomic DELETE + INSERT via RPC — voorkomt half opgeslagen states bij
    // volgorde-wisselingen
    const { error } = await admin.rpc('save_group_predictions', {
      p_user_id: body.user_id,
      p_group_id: groupId,
      p_rows: rows,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Onbekend type' }, { status: 400 })
}

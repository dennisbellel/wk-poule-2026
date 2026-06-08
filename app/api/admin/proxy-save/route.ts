import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

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
    const { error } = await admin
      .from('match_predictions')
      .upsert({ user_id: body.user_id, match_id, ...fields }, { onConflict: 'user_id,match_id' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
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
    const { rows } = body.payload as { rows: Array<Record<string, unknown>> }
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'rows verplicht' }, { status: 400 })
    }
    const withUser = rows.map(r => ({ ...r, user_id: body.user_id }))
    const { error } = await admin
      .from('group_standing_predictions')
      .upsert(withUser, { onConflict: 'user_id,group_id,position' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Onbekend type' }, { status: 400 })
}

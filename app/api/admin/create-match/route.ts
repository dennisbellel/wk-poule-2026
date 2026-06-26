import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

const PHASES = ['group', 'r32', 'r16', 'qf', 'sf', 'third', 'final']

// Admin maakt een nieuwe wedstrijd aan (vooral voor de knockout-fase, waar de
// fixtures niet via een sync binnenkomen). Teams mogen leeg blijven en worden
// dan met placeholders getoond ("Winnaar Groep A") tot ze bekend zijn.
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json() as {
    phase?: string
    group_id?: string | null
    home_team_id?: string | null
    away_team_id?: string | null
    home_team_placeholder?: string | null
    away_team_placeholder?: string | null
    scheduled_at?: string
    venue?: string | null
    city?: string | null
  }

  if (!body.phase || !PHASES.includes(body.phase)) {
    return NextResponse.json({ error: 'Ongeldige fase' }, { status: 400 })
  }
  const scheduled = body.scheduled_at ? new Date(body.scheduled_at) : null
  if (!scheduled || isNaN(scheduled.getTime())) {
    return NextResponse.json({ error: 'Datum & tijd verplicht' }, { status: 400 })
  }

  const admin = await createAdminClient()

  // Volgend match_number bepalen (NOT NULL, uniek genoeg voor sortering)
  const { data: maxRow } = await admin
    .from('matches').select('match_number').order('match_number', { ascending: false }).limit(1).single()
  const nextNumber = (maxRow?.match_number ?? 0) + 1

  const insert = {
    phase: body.phase,
    group_id: body.phase === 'group' ? (body.group_id ?? null) : null,
    match_number: nextNumber,
    home_team_id: body.home_team_id || null,
    away_team_id: body.away_team_id || null,
    home_team_placeholder: body.home_team_placeholder?.trim() || null,
    away_team_placeholder: body.away_team_placeholder?.trim() || null,
    scheduled_at: scheduled.toISOString(),
    prediction_deadline_at: scheduled.toISOString(), // deadline = aftrap
    venue: body.venue?.trim() || null,
    city: body.city?.trim() || null,
    status: 'scheduled' as const,
  }

  const { data: created, error } = await admin
    .from('matches')
    .insert(insert)
    .select('*, home_team:home_team_id(id, name), away_team:away_team_id(id, name)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, match: created })
}

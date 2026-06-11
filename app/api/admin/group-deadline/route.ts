import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// Admin stelt de poulestand-deadline in (app_settings.group_predictions_deadline_at).
// Tot dat moment kan iedereen zijn poulestand invullen/aanpassen.
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json() as { deadline_at?: string }
  const deadline = body.deadline_at ? new Date(body.deadline_at) : null
  if (!deadline || isNaN(deadline.getTime())) {
    return NextResponse.json({ error: 'Ongeldige datum' }, { status: 400 })
  }

  const admin = await createAdminClient()
  const { error } = await admin.from('app_settings').upsert({
    key: 'group_predictions_deadline_at',
    value: deadline.toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'key' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, deadline_at: deadline.toISOString() })
}

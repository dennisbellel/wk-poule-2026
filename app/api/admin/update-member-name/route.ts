import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { user_id, display_name } = await request.json() as { user_id: string; display_name: string }
  if (!user_id || !display_name?.trim()) {
    return NextResponse.json({ error: 'user_id en display_name verplicht' }, { status: 400 })
  }

  const admin = await createAdminClient()
  const { error } = await admin
    .from('profiles')
    .update({ display_name: display_name.trim() })
    .eq('id', user_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

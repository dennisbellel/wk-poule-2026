import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// Hergebruikt om een nieuwe invite-link te sturen naar iemand die nog niet
// volledig is geregistreerd. Verwijdert het oude (kapotte) auth-account + profiel
// en stuurt een verse invite met een geldig token.
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: callerProfile } = await supabase
    .from('profiles').select('is_admin').eq('id', user.id).single()
  if (!callerProfile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { email } = await request.json() as { email?: string }
  const cleanEmail = email?.trim().toLowerCase()
  if (!cleanEmail) return NextResponse.json({ error: 'E-mail verplicht' }, { status: 400 })

  const admin = await createAdminClient()

  // Veiligheid: alleen voor nog-niet-geactiveerde accounts
  const { data: existing } = await admin
    .from('profiles')
    .select('id, password_set, display_name')
    .eq('email', cleanEmail)
    .maybeSingle()

  if (existing?.password_set === true) {
    return NextResponse.json({
      error: 'Deze persoon is al volledig geregistreerd — gebruik wachtwoord-reset in plaats van opnieuw uitnodigen.',
    }, { status: 400 })
  }

  // Verwijder oud account + profiel zodat de invite schoon kan worden uitgestuurd
  if (existing?.id) {
    await admin.auth.admin.deleteUser(existing.id).catch(() => {})
    await admin.from('profiles').delete().eq('id', existing.id)
  }
  await admin.from('invited_emails').delete().eq('email', cleanEmail)

  // Verstuur verse invite via dezelfde flow als de eerste keer
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://wk-poule-2026.vercel.app'
  const { error: inviteErr } = await admin.auth.admin.inviteUserByEmail(cleanEmail, {
    redirectTo: `${siteUrl}/auth/confirm?type=invite&next=/auth/register`,
    data: { invited_by: user.id },
  })
  if (inviteErr) {
    return NextResponse.json({ error: inviteErr.message }, { status: 500 })
  }

  await admin.from('invited_emails').upsert(
    { email: cleanEmail, invited_by: user.id, invited_at: new Date().toISOString(), registered_at: null },
    { onConflict: 'email' }
  )

  return NextResponse.json({ ok: true })
}

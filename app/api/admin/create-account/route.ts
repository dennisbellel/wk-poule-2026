import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// Genereer een leesbaar tijdelijk wachtwoord zoals "wk2026-x7k3p"
function generateTempPassword(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789' // zonder verwarrende karakters (0/o, 1/l/i)
  let suffix = ''
  for (let i = 0; i < 6; i++) suffix += chars[Math.floor(Math.random() * chars.length)]
  return `wk2026-${suffix}`
}

// Admin maakt direct een account aan. Gebruiker kan inloggen met email + tijdelijk
// wachtwoord en wordt daarna door de wachtwoord-modal gevraagd zijn eigen te kiezen.
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: callerProfile } = await supabase
    .from('profiles').select('is_admin').eq('id', user.id).single()
  if (!callerProfile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { email, displayName, password } = await request.json() as {
    email?: string
    displayName?: string
    password?: string
  }

  const cleanEmail = email?.trim().toLowerCase()
  const cleanName = displayName?.trim()
  if (!cleanEmail || !cleanEmail.includes('@')) {
    return NextResponse.json({ error: 'Geldig e-mailadres verplicht' }, { status: 400 })
  }
  if (!cleanName) {
    return NextResponse.json({ error: 'Naam verplicht' }, { status: 400 })
  }

  const admin = await createAdminClient()

  // Bestaat het account al? Dan blokkeren.
  const { data: existing } = await admin
    .from('profiles').select('id, password_set').eq('email', cleanEmail).maybeSingle()
  if (existing) {
    return NextResponse.json({
      error: existing.password_set
        ? 'Er bestaat al een geactiveerd account met dit e-mailadres.'
        : 'Er staat al een uitnodiging open voor dit e-mailadres. Gebruik "Opnieuw versturen" of verwijder eerst het oude account.',
    }, { status: 400 })
  }

  // Genereer of gebruik het opgegeven wachtwoord
  const tempPassword = password?.trim() || generateTempPassword()
  if (tempPassword.length < 8) {
    return NextResponse.json({ error: 'Wachtwoord moet minstens 8 tekens zijn' }, { status: 400 })
  }

  // Maak de auth user — email_confirm=true zodat ze meteen kunnen inloggen
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: cleanEmail,
    password: tempPassword,
    email_confirm: true,
  })
  if (createErr || !created?.user) {
    return NextResponse.json({ error: createErr?.message || 'Aanmaken mislukt' }, { status: 500 })
  }

  // Profielrij aanmaken (handle_new_user trigger is onbetrouwbaar)
  // password_set=false zodat de modal verschijnt zodra de gebruiker inlogt — die kiest dan zijn eigen wachtwoord
  await admin.from('profiles').upsert({
    id: created.user.id,
    email: cleanEmail,
    display_name: cleanName,
    is_admin: false,
    password_set: false,
  }, { onConflict: 'id' })

  // Markeer als geregistreerd in invited_emails (puur voor admin-overzicht consistentie)
  await admin.from('invited_emails').upsert({
    email: cleanEmail,
    invited_by: user.id,
    registered_at: new Date().toISOString(),
  }, { onConflict: 'email' })

  return NextResponse.json({
    ok: true,
    email: cleanEmail,
    display_name: cleanName,
    temporary_password: tempPassword,
  })
}

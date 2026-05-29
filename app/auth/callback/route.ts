import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'

// Handelt drie soorten links af die Supabase in mails verstuurt:
// 1) PKCE code flow → ?code=xxx (gebruikelijk voor OAuth / signinWithOtp)
// 2) Token-hash flow → ?token_hash=xxx&type=invite|recovery|email|signup
// 3) Legacy token flow → ?token=xxx&type=...
//
// Bij succes redirect naar ?next= (default /), bij fout naar /auth/login met details.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash') || searchParams.get('token')
  const type = searchParams.get('type') as EmailOtpType | null
  // Invite en recovery sturen naar de app; daar verschijnt de verplichte
  // wachtwoord-modal (gedreven door profiles.password_set), dus geen aparte
  // register-redirect meer nodig.
  const next = searchParams.get('next') && type !== 'invite' && type !== 'recovery'
    ? searchParams.get('next')!
    : '/'

  const supabase = await createClient()

  // Garandeer dat er een profiel bestaat voor deze gebruiker en dat password_set
  // op false staat bij invite/recovery. We vertrouwen NIET op de DB-trigger
  // (handle_new_user) — die blijkt in productie niet betrouwbaar te draaien,
  // waardoor nieuwe users zonder profiel-rij de app in glipten.
  async function ensureProfile(userId: string, userEmail: string | undefined) {
    try {
      const admin = await createAdminClient()
      const { data: existing } = await admin
        .from('profiles').select('id').eq('id', userId).maybeSingle()

      if (existing) {
        // Bestaand profiel (bv. recovery): forceer wachtwoord-stap
        if (type === 'invite' || type === 'recovery') {
          await admin.from('profiles').update({ password_set: false }).eq('id', userId)
        }
      } else {
        // Nieuw profiel aanmaken — naam voorlopig het e-mail-deel, wordt in de modal
        // overschreven. is_admin false, password_set false → modal verschijnt.
        const fallbackName = (userEmail?.split('@')[0]) || 'Deelnemer'
        await admin.from('profiles').insert({
          id: userId,
          email: userEmail ?? '',
          display_name: fallbackName,
          is_admin: false,
          password_set: false,
        })
      }
    } catch {}
  }

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) return NextResponse.redirect(`${origin}/auth/login?error=${encodeURIComponent(error.message)}`)
    if (data.user) await ensureProfile(data.user.id, data.user.email)
    return NextResponse.redirect(`${origin}${next}`)
  }

  if (tokenHash && type) {
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
    if (error) return NextResponse.redirect(`${origin}/auth/login?error=${encodeURIComponent(error.message)}`)
    if (data.user) await ensureProfile(data.user.id, data.user.email)
    return NextResponse.redirect(`${origin}${next}`)
  }

  return NextResponse.redirect(`${origin}/auth/login?error=missing_token`)
}

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

  // Markeer dat de gebruiker (opnieuw) een wachtwoord moet instellen.
  // Voor invite is password_set al false (default); voor recovery zetten we 'm terug.
  async function flagPasswordReset() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const admin = await createAdminClient()
        await admin.from('profiles').update({ password_set: false }).eq('id', user.id)
      }
    } catch {}
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) return NextResponse.redirect(`${origin}/auth/login?error=${encodeURIComponent(error.message)}`)
    if (type === 'recovery' || type === 'invite') await flagPasswordReset()
    return NextResponse.redirect(`${origin}${next}`)
  }

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
    if (error) return NextResponse.redirect(`${origin}/auth/login?error=${encodeURIComponent(error.message)}`)
    if (type === 'recovery' || type === 'invite') await flagPasswordReset()
    return NextResponse.redirect(`${origin}${next}`)
  }

  return NextResponse.redirect(`${origin}/auth/login?error=missing_token`)
}

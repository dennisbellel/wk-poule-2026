import { createClient } from '@/lib/supabase/server'
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
  const next = searchParams.get('next') ?? '/'

  const supabase = await createClient()

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(`${origin}${next}`)
    return NextResponse.redirect(`${origin}/auth/login?error=${encodeURIComponent(error.message)}`)
  }

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
    if (!error) return NextResponse.redirect(`${origin}${next}`)
    return NextResponse.redirect(`${origin}/auth/login?error=${encodeURIComponent(error.message)}`)
  }

  return NextResponse.redirect(`${origin}/auth/login?error=missing_token`)
}

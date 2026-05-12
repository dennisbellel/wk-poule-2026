import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { emails } = await request.json() as { emails: string[] }
  if (!emails?.length) return NextResponse.json({ error: 'No emails provided' }, { status: 400 })

  const adminSupabase = await createAdminClient()
  const results = []

  for (const email of emails) {
    const cleanEmail = email.trim().toLowerCase()
    if (!cleanEmail || !cleanEmail.includes('@')) continue

    try {
      // Check if already registered
      const { data: existing } = await adminSupabase
        .from('profiles').select('email').eq('email', cleanEmail).single()

      if (existing) {
        results.push({ email: cleanEmail, status: 'already_registered' })
        continue
      }

      // Add to invited emails table
      await adminSupabase.from('invited_emails')
        .upsert({ email: cleanEmail, invited_by: user.id }, { onConflict: 'email' })

      // Send invite via Supabase Auth — link gaat eerst via /auth/callback
      // dat de session-token uitwisselt, daarna door naar /auth/register
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://wk-poule-2026.vercel.app'
      const { error } = await adminSupabase.auth.admin.inviteUserByEmail(cleanEmail, {
        redirectTo: `${siteUrl}/auth/callback?next=/auth/register`,
        data: { invited_by: user.id },
      })

      if (error) {
        results.push({ email: cleanEmail, status: 'error', error: error.message })
      } else {
        results.push({ email: cleanEmail, status: 'invited' })
      }
    } catch (e) {
      results.push({ email: cleanEmail, status: 'error', error: String(e) })
    }
  }

  return NextResponse.json({ results })
}

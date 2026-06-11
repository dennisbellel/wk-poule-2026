import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { fetchAllRows } from '@/lib/supabase/fetchAll'

// Volledige backup van alle data als downloadbaar JSON-bestand.
// Bedoeld als verzekering tijdens het toernooi: gaat er ooit iets mis met de
// database, dan staat alles in dit bestand om terug te zetten.
// orderBy = primaire sleutel, nodig voor stabiele paginering bij het batchen
const TABLES: { name: string; orderBy: string }[] = [
  { name: 'profiles', orderBy: 'id' },
  { name: 'teams', orderBy: 'id' },
  { name: 'players', orderBy: 'id' },
  { name: 'matches', orderBy: 'id' },
  { name: 'match_predictions', orderBy: 'id' },
  { name: 'group_standing_predictions', orderBy: 'id' },
  { name: 'bonus_questions', orderBy: 'id' },
  { name: 'bonus_answers', orderBy: 'id' },
  { name: 'scoring_config', orderBy: 'id' },
  { name: 'rank_history', orderBy: 'id' },
  { name: 'invited_emails', orderBy: 'email' },
  { name: 'match_reactions', orderBy: 'id' },
  { name: 'pending_results', orderBy: 'match_id' },
]

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = await createAdminClient()

  const backup: Record<string, unknown> = {
    exported_at: new Date().toISOString(),
    exported_by: user.id,
  }

  // Per tabel gebatcht ophalen (1000-rijen-cap). Een tabel die niet bestaat
  // in deze omgeving breekt de export niet — die wordt overgeslagen.
  for (const { name, orderBy } of TABLES) {
    try {
      backup[name] = await fetchAllRows<Record<string, unknown>>((from, to) =>
        admin.from(name).select('*').order(orderBy).range(from, to)
      )
    } catch (e) {
      backup[`${name}_error`] = e instanceof Error ? e.message : 'onbekende fout'
    }
  }

  const filename = `wk-poule-backup-${new Date().toISOString().slice(0, 16).replace(':', '')}.json`
  return new NextResponse(JSON.stringify(backup, null, 1), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}

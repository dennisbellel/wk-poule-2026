// app/admin/matches/page.tsx
import { createClient } from '@/lib/supabase/server'
import AdminMatchesClient from '@/components/admin/AdminMatchesClient'

export const dynamic = 'force-dynamic'

export default async function AdminMatchesPage() {
  const supabase = await createClient()

  const { data: matches } = await supabase
    .from('matches')
    .select('*, home_team:home_team_id(id, name), away_team:away_team_id(id, name)')
    .eq('phase', 'group')
    .order('scheduled_at', { ascending: true })

  const { data: teams } = await supabase
    .from('teams')
    .select('id, name')
    .order('name')

  return <AdminMatchesClient initialMatches={matches || []} teams={teams || []} />
}

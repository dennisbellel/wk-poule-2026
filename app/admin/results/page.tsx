// app/admin/results/page.tsx
import { createClient } from '@/lib/supabase/server'
import AdminResultsPageClient from '@/components/admin/AdminResultsPageClient'

export const dynamic = 'force-dynamic'

export default async function AdminResultsPage() {
  const supabase = await createClient()

  const { data: matches } = await supabase
    .from('matches')
    .select('*, home_team:home_team_id(*), away_team:away_team_id(*)')
    .order('scheduled_at', { ascending: true })

  return <AdminResultsPageClient matches={matches || []} />
}

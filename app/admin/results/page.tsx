// app/admin/results/page.tsx
import { createClient } from '@/lib/supabase/server'
import AdminResultsClient from '@/components/admin/AdminResultsClient'

export const dynamic = 'force-dynamic'

export default async function AdminResultsPage() {
  const supabase = await createClient()

  // Pending uitslagen die nog gepubliceerd moeten worden
  const { data: pending } = await supabase
    .from('pending_results')
    .select('*, match:match_id(*, home_team:home_team_id(*), away_team:away_team_id(*))')
    .eq('status', 'pending')
    .order('synced_at', { ascending: true })

  // Recent gepubliceerde uitslagen
  const { data: published } = await supabase
    .from('pending_results')
    .select('*, match:match_id(*, home_team:home_team_id(*), away_team:away_team_id(*))')
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(10)

  return (
    <AdminResultsClient
      pending={pending || []}
      published={published || []}
    />
  )
}

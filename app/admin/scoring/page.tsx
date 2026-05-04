import { createClient } from '@/lib/supabase/server'
import AdminScoringClient from '@/components/admin/AdminScoringClient'

export default async function AdminScoringPage() {
  const supabase = await createClient()
  const { data: scoringRows } = await supabase.from('scoring_config').select('*').order('category')
  return <AdminScoringClient initialScoring={scoringRows || []} />
}

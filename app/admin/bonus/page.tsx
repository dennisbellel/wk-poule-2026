// app/admin/bonus/page.tsx
import { createClient } from '@/lib/supabase/server'
import AdminBonusClient from '@/components/admin/AdminBonusClient'

export const dynamic = 'force-dynamic'

export default async function AdminBonusPage() {
  const supabase = await createClient()

  const { data: questions } = await supabase
    .from('bonus_questions')
    .select('*')
    .order('sort_order', { ascending: true })

  const { data: teams } = await supabase
    .from('teams')
    .select('id, name')
    .order('name')

  return (
    <AdminBonusClient
      initialQuestions={questions || []}
      teams={teams || []}
    />
  )
}

import { createClient } from '@/lib/supabase/server'
import AdminBonusClient from '@/components/admin/AdminBonusClient'

export default async function AdminBonusPage() {
  const supabase = await createClient()
  const { data: questions } = await supabase
    .from('bonus_questions').select('*').order('sort_order', { ascending: true })

  return <AdminBonusClient initialQuestions={questions || []} />
}

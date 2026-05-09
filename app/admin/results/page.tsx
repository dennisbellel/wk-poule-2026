// app/admin/results/page.tsx
import { createClient } from '@/lib/supabase/server'
import AdminResultForm from '@/components/admin/AdminResultForm'

export const dynamic = 'force-dynamic'

export default async function AdminResultsPage() {
  const supabase = await createClient()

  const { data: matches } = await supabase
    .from('matches')
    .select('*, home_team:home_team_id(*), away_team:away_team_id(*)')
    .order('scheduled_at', { ascending: true })

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h1 className="heading text-2xl font-extrabold text-gray-900">Uitslagen</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Vul alle velden in en klik op Publiceer — pas dan wordt de uitslag zichtbaar voor deelnemers.
        </p>
      </div>
      <div className="space-y-3">
        {(matches || []).map(m => (
          <AdminResultForm key={m.id} match={m} />
        ))}
      </div>
    </div>
  )
}

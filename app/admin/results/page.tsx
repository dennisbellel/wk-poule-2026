import { createClient } from '@/lib/supabase/server'
import AdminResultForm from '@/components/admin/AdminResultForm'

export default async function AdminResultsPage() {
  const supabase = await createClient()

  const { data: matches } = await supabase
    .from('matches')
    .select('*, home_team:home_team_id(*), away_team:away_team_id(*)')
    .order('scheduled_at', { ascending: true })

  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="heading text-2xl font-extrabold text-gray-900">Uitslagen</h1>
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800">
        ℹ️ Uitslagen worden automatisch bijgehouden via de football-data.org API. Pas hier handmatig aan als er een fout is — punten worden direct herberekend.
      </div>
      {matches?.map(m => <AdminResultForm key={m.id} match={m} />)}
    </div>
  )
}

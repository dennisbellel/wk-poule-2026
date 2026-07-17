// app/admin/bonus/page.tsx
import { createClient } from '@/lib/supabase/server'
import AdminBonusClient from '@/components/admin/AdminBonusClient'
import { fetchAllRows } from '@/lib/supabase/fetchAll'

export const dynamic = 'force-dynamic'

type PlayerRow = {
  id: string
  name: string
  position: string | null
  team_id: string | null
  team: { name_nl: string } | { name_nl: string }[] | null
}

export default async function AdminBonusPage() {
  const supabase = await createClient()

  const { data: questions } = await supabase
    .from('bonus_questions')
    .select('*')
    .order('sort_order', { ascending: true })

  // Landen met NL-naam + vlag, zodat de admin-keuze exact matcht met wat
  // deelnemers opslaan (zij slaan name_nl op als antwoord).
  const { data: teams } = await supabase
    .from('teams')
    .select('id, name, name_nl, flag, group_id')
    .order('name_nl')

  // Spelers gebatcht ophalen (kunnen >1000 zijn) — met team-NL-naam voor de
  // "Naam (Land)"-waarde die deelnemers ook opslaan.
  const playersRaw = await fetchAllRows<PlayerRow>((from, to) =>
    supabase.from('players')
      .select('id, name, position, team_id, team:team_id(name_nl)')
      .order('name')
      .range(from, to)
  )
  const players = playersRaw.map(p => ({
    id: p.id,
    name: p.name,
    position: p.position,
    team_id: p.team_id,
    team_nl: (Array.isArray(p.team) ? p.team[0]?.name_nl : p.team?.name_nl) ?? null,
  }))

  return (
    <AdminBonusClient
      initialQuestions={questions || []}
      teams={teams || []}
      players={players}
    />
  )
}

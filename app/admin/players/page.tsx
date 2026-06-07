import { createClient } from '@/lib/supabase/server'
import AdminPlayersImport from '@/components/admin/AdminPlayersImport'

export const dynamic = 'force-dynamic'

type TeamCount = { id: string; name_nl: string; flag: string; player_count: number }

export default async function AdminPlayersPage() {
  const supabase = await createClient()

  const { data: teams } = await supabase
    .from('teams').select('id, name_nl, flag, group_id').order('group_id').order('name_nl')

  // Spelers in batches ophalen — .range(0, 9999) blijkt niet altijd betrouwbaar
  // door PostgREST max-rows, dus loopen we totdat we minder dan een volle batch
  // terugkrijgen. Zo zijn we onafhankelijk van Supabase-instellingen.
  const allPlayers: { team_id: string }[] = []
  const PAGE = 500
  let from = 0
  while (true) {
    const { data: batch } = await supabase
      .from('players')
      .select('team_id')
      .range(from, from + PAGE - 1)
    if (!batch || batch.length === 0) break
    allPlayers.push(...batch)
    if (batch.length < PAGE) break
    from += PAGE
    if (from > 10000) break  // veiligheidsklep tegen oneindige loop
  }

  const countByTeam = new Map<string, number>()
  for (const p of allPlayers) {
    countByTeam.set(p.team_id, (countByTeam.get(p.team_id) ?? 0) + 1)
  }

  const teamRows: TeamCount[] = (teams ?? []).map(t => ({
    id: t.id,
    name_nl: t.name_nl,
    flag: t.flag,
    player_count: countByTeam.get(t.id) ?? 0,
  }))

  const totalPlayers = teamRows.reduce((sum, t) => sum + t.player_count, 0)
  const teamsWithPlayers = teamRows.filter(t => t.player_count > 0).length

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="heading text-2xl font-extrabold text-gray-900">Spelers</h1>
        <div className="text-right">
          <p className="heading text-2xl font-extrabold text-[#1a5c38]">{totalPlayers}</p>
          <p className="text-xs text-[#aaa]">spelers · {teamsWithPlayers} van {teamRows.length} landen gevuld</p>
        </div>
      </div>

      <AdminPlayersImport />

      <div className="bg-white rounded-2xl border border-[#e5e1d8] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#f6f4ef]">
          <h2 className="text-sm font-semibold text-gray-800">Spelers per land</h2>
        </div>
        <div className="divide-y divide-[#f6f4ef]">
          {teamRows.map(t => (
            <div key={t.id} className="flex items-center gap-3 px-5 py-3">
              <span className="text-xl">{t.flag}</span>
              <span className="flex-1 text-sm font-medium text-gray-900">{t.name_nl}</span>
              <span className="text-[11px] text-[#aaa] font-mono">{t.id}</span>
              <span className={`text-sm font-semibold w-12 text-right ${
                t.player_count === 0 ? 'text-red-500' : 'text-[#1a5c38]'
              }`}>
                {t.player_count}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

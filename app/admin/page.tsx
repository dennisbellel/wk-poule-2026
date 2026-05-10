import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import AdminSyncButton from '@/components/admin/AdminSyncButton'
import { formatDateTimeNL } from '@/lib/format'

export const dynamic = 'force-dynamic'

type Todo = {
  id: string
  kind: 'match_unpublished' | 'bonus_no_answer' | 'match_no_teams'
  title: string
  sub: string
  href: string
  urgency: 'high' | 'normal'
}

export default async function AdminPage() {
  const supabase = await createClient()
  const now = new Date()
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000)

  const [
    { count: userCount },
    { count: matchCount },
    { count: predCount },
    { data: syncLog },
    { data: pendingMatches },
    { data: pendingBonusQs },
    { data: upcomingMatchesNoTeams },
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('matches').select('*', { count: 'exact', head: true }),
    supabase.from('match_predictions').select('*', { count: 'exact', head: true }),
    supabase.from('sync_log').select('*').order('synced_at', { ascending: false }).limit(5),
    // Wedstrijden waarvan de aftrap > 2u geleden was, maar status nog niet 'finished'
    supabase.from('matches')
      .select('id, scheduled_at, group_id, phase, home_team:home_team_id(name_nl, flag), away_team:away_team_id(name_nl, flag)')
      .neq('status', 'finished')
      .lte('scheduled_at', twoHoursAgo.toISOString())
      .order('scheduled_at', { ascending: true }),
    // Bonusvragen waarvan de deadline voorbij is en correct_answer nog niet gezet
    supabase.from('bonus_questions')
      .select('id, question_nl, deadline_at, icon')
      .eq('active', true)
      .is('correct_answer', null)
      .lt('deadline_at', now.toISOString())
      .order('deadline_at', { ascending: true }),
    // Knockout-wedstrijden < 24u in toekomst zonder vastgelegde teams
    supabase.from('matches')
      .select('id, scheduled_at, group_id, phase, home_team_id, away_team_id, home_team_placeholder, away_team_placeholder')
      .neq('phase', 'group')
      .gte('scheduled_at', now.toISOString())
      .lte('scheduled_at', new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString())
      .or('home_team_id.is.null,away_team_id.is.null'),
  ])

  const lastSync = syncLog?.[0]

  const todos: Todo[] = []

  for (const m of pendingMatches || []) {
    const home = Array.isArray(m.home_team) ? m.home_team[0] : m.home_team
    const away = Array.isArray(m.away_team) ? m.away_team[0] : m.away_team
    const homeName = (home as { name_nl?: string; flag?: string } | null)?.name_nl ?? '?'
    const homeFlag = (home as { flag?: string } | null)?.flag ?? ''
    const awayName = (away as { name_nl?: string } | null)?.name_nl ?? '?'
    const awayFlag = (away as { flag?: string } | null)?.flag ?? ''
    todos.push({
      id: `match-${m.id}`,
      kind: 'match_unpublished',
      title: `Uitslag publiceren — ${homeFlag} ${homeName} vs ${awayName} ${awayFlag}`,
      sub: `Aftrap was ${formatDateTimeNL(m.scheduled_at)}`,
      href: '/admin/results',
      urgency: 'high',
    })
  }

  for (const q of pendingBonusQs || []) {
    todos.push({
      id: `bonus-${q.id}`,
      kind: 'bonus_no_answer',
      title: `Antwoord publiceren — ${q.icon} ${q.question_nl}`,
      sub: `Deadline was ${formatDateTimeNL(q.deadline_at)}`,
      href: '/admin/bonus',
      urgency: 'high',
    })
  }

  for (const m of upcomingMatchesNoTeams || []) {
    todos.push({
      id: `noteams-${m.id}`,
      kind: 'match_no_teams',
      title: `${m.phase.toUpperCase()}-wedstrijd zonder teams — ${m.home_team_placeholder ?? '?'} vs ${m.away_team_placeholder ?? '?'}`,
      sub: `Aftrap ${formatDateTimeNL(m.scheduled_at)} — vul teams in`,
      href: '/admin/matches',
      urgency: 'normal',
    })
  }

  return (
    <div className="max-w-4xl space-y-6">
      <h1 className="heading text-2xl font-extrabold text-gray-900">Overzicht</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Deelnemers', value: userCount || 0, icon: '👥' },
          { label: 'Wedstrijden', value: matchCount || 0, icon: '⚽' },
          { label: 'Voorspellingen', value: predCount || 0, icon: '✏️' },
          { label: 'Open to-do\'s', value: todos.length, icon: '📋' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl border border-[#e5e1d8] p-4">
            <span className="text-2xl block mb-2">{s.icon}</span>
            <span className="heading text-2xl font-extrabold text-gray-900 block">{s.value}</span>
            <span className="text-sm text-[#aaa]">{s.label}</span>
          </div>
        ))}
      </div>

      {/* TO-DO LIJST */}
      <div className="bg-white rounded-2xl border border-[#e5e1d8] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#f6f4ef] flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-800">Te doen</h2>
            <p className="text-xs text-[#aaa] mt-0.5">Acties die op je wachten</p>
          </div>
          {todos.length > 0 && (
            <span className="tag bg-amber-50 text-amber-700">{todos.length} open</span>
          )}
        </div>
        {todos.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-3xl mb-2">✨</p>
            <p className="text-sm text-[#888]">Niks te doen — alles is bij!</p>
          </div>
        ) : (
          todos.map(todo => (
            <Link key={todo.id} href={todo.href}
              className="flex items-center gap-3 px-5 py-3.5 border-b border-[#f6f4ef] last:border-0 hover:bg-[#fafaf9] transition-colors">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${todo.urgency === 'high' ? 'bg-red-400' : 'bg-amber-400'}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{todo.title}</p>
                <p className="text-xs text-[#aaa] mt-0.5">{todo.sub}</p>
              </div>
              <span className="text-xs text-[#ccc]">→</span>
            </Link>
          ))
        )}
      </div>

      {/* API Sync */}
      <div className="bg-white rounded-2xl border border-[#e5e1d8] p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-800">football-data.org API</h2>
            <p className="text-xs text-[#aaa] mt-0.5">
              {lastSync?.status === 'success'
                ? `Laatste sync: ${new Date(lastSync.synced_at).toLocaleString('nl-NL')} · ${lastSync.matches_updated} wedstrijden bijgewerkt`
                : 'Nog niet gesynchroniseerd'}
            </p>
          </div>
          <div className={`tag ${lastSync?.status === 'success' ? 'bg-green-100 text-green-700' : 'bg-[#f0ede6] text-[#888]'}`}>
            {lastSync?.status === 'success' ? '✓ Verbonden' : 'Onbekend'}
          </div>
        </div>
        <AdminSyncButton />
        {syncLog && syncLog.length > 0 && (
          <div className="mt-4 space-y-1">
            <p className="text-xs font-semibold text-[#aaa] uppercase tracking-wide mb-2">Sync geschiedenis</p>
            {syncLog.map(log => (
              <div key={log.id} className="flex justify-between text-xs text-[#888] py-1 border-b border-[#f6f4ef]">
                <span>{new Date(log.synced_at).toLocaleString('nl-NL')}</span>
                <span className={log.status === 'success' ? 'text-green-600' : 'text-red-500'}>
                  {log.status === 'success' ? `✓ ${log.matches_updated} bijgewerkt` : `✗ ${log.error}`}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

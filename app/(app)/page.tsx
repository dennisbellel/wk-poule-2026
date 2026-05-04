import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { formatDistanceToNow, isPast } from 'date-fns'
import { nl } from 'date-fns/locale'
import { sortLeaderboard } from '@/lib/points/calculate'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Fetch profile
  const { data: profile } = await supabase
    .from('profiles').select('*').eq('id', user!.id).single()

  // Fetch leaderboard
  const { data: lbRaw } = await supabase
    .from('leaderboard').select('*').order('total_points', { ascending: false })

  const leaderboard = sortLeaderboard(lbRaw || [])
  const myEntry = leaderboard.find(e => e.user_id === user!.id)

  // Next upcoming match
  const { data: nextMatch } = await supabase
    .from('matches')
    .select('*, home_team:home_team_id(*), away_team:away_team_id(*)')
    .eq('status', 'scheduled')
    .eq('phase', 'group')
    .order('scheduled_at', { ascending: true })
    .limit(1)
    .single()

  // My prediction count
  const { count: predCount } = await supabase
    .from('match_predictions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user!.id)

  // Total group matches
  const { count: totalGroupMatches } = await supabase
    .from('matches')
    .select('*', { count: 'exact', head: true })
    .eq('phase', 'group')

  // Group predictions count
  const { count: groupPredCount } = await supabase
    .from('group_standing_predictions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user!.id)

  // Bonus answers count
  const { count: bonusCount } = await supabase
    .from('bonus_answers')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user!.id)

  const { count: totalBonus } = await supabase
    .from('bonus_questions')
    .select('*', { count: 'exact', head: true })
    .eq('active', true)

  const DEADLINE = new Date('2026-06-11T19:00:00Z')
  const deadlinePast = isPast(DEADLINE)

  return (
    <div>
      {/* Desktop topbar */}
      <div className="hidden lg:flex items-center justify-between px-8 py-5 bg-white border-b border-[#e5e1d8]">
        <div>
          <h1 className="heading text-xl font-extrabold text-[#1a5c38]">Home</h1>
          <p className="text-sm text-[#aaa] mt-0.5">Welkom terug, {profile?.display_name}</p>
        </div>
        {!deadlinePast && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-full px-4 py-2">
            <span className="text-sm">⏰</span>
            <span className="text-sm font-semibold text-amber-800">
              Deadline {formatDistanceToNow(DEADLINE, { locale: nl, addSuffix: true })}
            </span>
          </div>
        )}
      </div>

      {/* Mobile hero */}
      <div className="lg:hidden bg-[#1a5c38] px-5 pt-8 pb-6">
        <p className="text-xs text-white/60 mb-1">Dé WK Poule 2026</p>
        <h1 className="heading text-2xl font-extrabold text-white mb-4">
          Hey {profile?.display_name} 👋
        </h1>
        <div className="grid grid-cols-3 gap-2.5">
          {[
            ['Punten', String(myEntry?.total_points ?? 0)],
            ['Positie', myEntry ? `${myEntry.rank}/${leaderboard.length}` : '—'],
            ['Goed', myEntry && predCount ? `${Math.round((myEntry.match_points / Math.max(predCount * 5, 1)) * 100)}%` : '—'],
          ].map(([lbl, val]) => (
            <div key={lbl} className="bg-white/10 rounded-xl px-3 py-3">
              <p className="text-[11px] text-white/60 mb-0.5">{lbl}</p>
              <p className="heading text-xl font-extrabold text-white">{val}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="p-4 lg:p-8 space-y-5">
        {/* Stats row (desktop) */}
        <div className="hidden lg:grid grid-cols-3 gap-4">
          {[
            { label: 'Totaal punten', value: String(myEntry?.total_points ?? 0), sub: `${myEntry?.match_points ?? 0} wedstrijd + ${myEntry?.group_points ?? 0} poule + ${myEntry?.bonus_points ?? 0} bonus`, accent: true },
            { label: 'Positie', value: myEntry ? `${myEntry.rank}/${leaderboard.length}` : '—', sub: 'In de tussenstand' },
            { label: 'Goede antwoorden', value: predCount ? `${Math.round((myEntry?.match_points ?? 0) / Math.max(predCount * 5, 1) * 100)}%` : '—', sub: `${predCount ?? 0} van ${totalGroupMatches ?? 0} ingevuld` },
          ].map(s => (
            <div key={s.label} className={`rounded-2xl p-5 border ${s.accent ? 'bg-[#1a5c38] border-[#1a5c38]' : 'bg-white border-[#e5e1d8]'}`}>
              <p className={`text-xs uppercase tracking-wide mb-1 ${s.accent ? 'text-white/60' : 'text-[#aaa]'}`}>{s.label}</p>
              <p className={`heading text-3xl font-extrabold ${s.accent ? 'text-white' : 'text-gray-900'}`}>{s.value}</p>
              <p className={`text-xs mt-1 ${s.accent ? 'text-white/50' : 'text-[#aaa]'}`}>{s.sub}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Left column */}
          <div className="space-y-4">
            {/* Deadline banner (mobile) */}
            {!deadlinePast && (
              <div className="lg:hidden bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex gap-3 items-start">
                <span className="text-base">⏰</span>
                <div>
                  <p className="text-sm font-semibold text-amber-800">Deadline nadert!</p>
                  <p className="text-xs text-amber-700">Vul je voorspellingen in vóór 11 juni</p>
                </div>
              </div>
            )}

            {/* Next match */}
            {nextMatch && (
              <div className="card">
                <div className="px-4 py-3 border-b border-[#f6f4ef] flex justify-between items-center">
                  <span className="text-sm font-semibold">Volgende wedstrijd</span>
                  <span className="tag bg-amber-50 text-amber-700">⚡ Voorspel</span>
                </div>
                <div className="p-4">
                  <div className="flex justify-between items-center mb-3">
                    <span className="tag bg-[#eaf4ef] text-[#1a5c38]">Groep {nextMatch.group_id}</span>
                    <span className="text-xs text-[#aaa]">
                      {new Date(nextMatch.scheduled_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })} ·{' '}
                      {new Date(nextMatch.scheduled_at).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mb-4">
                    <span className="flex-1 text-sm font-semibold">
                      {nextMatch.home_team?.flag} {nextMatch.home_team?.name_nl}
                    </span>
                    <div className="bg-[#f6f4ef] px-3 py-1.5 rounded-lg">
                      <span className="text-xs text-[#ccc]">vs</span>
                    </div>
                    <span className="flex-1 text-sm font-semibold text-right">
                      {nextMatch.away_team?.name_nl} {nextMatch.away_team?.flag}
                    </span>
                  </div>
                  <Link href="/predict" className="btn-primary block text-center w-full py-3">
                    Voorspelling invullen →
                  </Link>
                </div>
              </div>
            )}

            {/* Progress */}
            <div className="card">
              <div className="px-4 py-3 border-b border-[#f6f4ef]">
                <span className="text-sm font-semibold">Voortgang voorspellingen</span>
              </div>
              {[
                ['Wedstrijden', predCount ?? 0, totalGroupMatches ?? 48],
                ['Poulestand', Math.floor((groupPredCount ?? 0) / 4), 12],
                ['Bonusvragen', bonusCount ?? 0, totalBonus ?? 9],
              ].map(([lbl, done, total]) => (
                <div key={String(lbl)} className="flex items-center gap-3 px-4 py-3 border-b border-[#f6f4ef] last:border-0">
                  <span className="text-sm text-[#888] w-28 flex-shrink-0">{lbl}</span>
                  <div className="flex-1 h-1.5 bg-[#f0ede6] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${total ? (Number(done) / Number(total)) * 100 : 0}%`,
                        background: done === total ? '#16a34a' : '#1a5c38',
                      }}
                    />
                  </div>
                  <span className={`text-xs font-semibold w-10 text-right ${done === total ? 'text-green-600' : ''}`}>
                    {done === total ? '✓' : `${done}/${total}`}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Right column: Leaderboard */}
          <div className="card">
            <div className="px-4 py-3 border-b border-[#f6f4ef] flex justify-between items-center">
              <span className="text-sm font-semibold">Tussenstand</span>
              <Link href="/stand" className="text-xs font-semibold text-[#1a5c38]">Alles →</Link>
            </div>
            {leaderboard.slice(0, 8).map(p => (
              <div key={p.user_id}
                className={`flex items-center gap-3 px-4 py-3 border-b border-[#f6f4ef] last:border-0 ${p.user_id === user?.id ? 'bg-[#eaf4ef]' : 'bg-white'}`}>
                <span className={`w-6 text-center ${p.rank <= 3 ? 'text-lg' : 'text-xs font-bold text-[#ccc]'}`}>
                  {p.rank === 1 ? '🥇' : p.rank === 2 ? '🥈' : p.rank === 3 ? '🥉' : p.rank}
                </span>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${p.user_id === user?.id ? 'bg-[#1a5c38]' : 'bg-[#e5e1d8]'}`}>
                  <span className={`heading text-xs font-bold ${p.user_id === user?.id ? 'text-white' : 'text-[#777]'}`}>
                    {p.display_name[0]}
                  </span>
                </div>
                <span className={`flex-1 text-sm ${p.user_id === user?.id ? 'font-semibold text-[#1a5c38]' : ''}`}>
                  {p.display_name}{p.user_id === user?.id ? ' (jij)' : ''}
                </span>
                <span className="heading text-base font-bold">{p.total_points}</span>
              </div>
            ))}
            {leaderboard.length > 8 && (
              <Link href="/stand" className="block text-center py-3 text-sm font-semibold text-[#1a5c38] bg-[#f6f4ef] border-t border-[#e5e1d8]">
                + {leaderboard.length - 8} meer deelnemers →
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

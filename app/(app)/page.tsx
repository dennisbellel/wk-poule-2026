import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { nl } from 'date-fns/locale'
import { sortLeaderboard } from '@/lib/points/calculate'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles').select('*').eq('id', user!.id).single()

  const { data: lbRaw } = await supabase
    .from('leaderboard').select('*').order('total_points', { ascending: false })

  const leaderboard = sortLeaderboard(lbRaw || [])
  const myEntry = leaderboard.find(e => e.user_id === user!.id)

  const { data: nextMatch } = await supabase
    .from('matches')
    .select('*, home_team:home_team_id(*), away_team:away_team_id(*)')
    .eq('status', 'scheduled')
    .eq('phase', 'group')
    .order('scheduled_at', { ascending: true })
    .limit(1)
    .single()

  const { count: predCount } = await supabase
    .from('match_predictions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user!.id)

  const { count: totalGroupMatches } = await supabase
    .from('matches')
    .select('*', { count: 'exact', head: true })
    .eq('phase', 'group')

  const { count: groupPredCount } = await supabase
    .from('group_standing_predictions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user!.id)

  const { count: bonusCount } = await supabase
    .from('bonus_answers')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user!.id)

  const { count: totalBonus } = await supabase
    .from('bonus_questions')
    .select('*', { count: 'exact', head: true })
    .eq('active', true)

  // Punt 7: granulaire "goede antwoorden" — tel correcte individuele inputs
  const { data: myPredictions } = await supabase
    .from('match_predictions')
    .select('home_ft, away_ft, home_ht, away_ht, home_yellow, away_yellow, home_red, away_red, match:match_id(home_ft, away_ft, home_ht, away_ht, home_yellow, away_yellow, home_red, away_red, status)')
    .eq('user_id', user!.id)

  const { data: myBonusAnswersFull } = await supabase
    .from('bonus_answers')
    .select('answer, question:question_id(correct_answer)')
    .eq('user_id', user!.id)

  let correctInputs = 0
  let totalInputs = 0

  for (const pred of myPredictions || []) {
    const matchData = Array.isArray(pred.match) ? pred.match[0] : pred.match
    const m = matchData as { home_ft: number | null; away_ft: number | null; home_ht: number | null; away_ht: number | null; home_yellow: number | null; away_yellow: number | null; home_red: number | null; away_red: number | null; status: string } | null
    if (!m || m.status !== 'finished') continue
    const fields: Array<[unknown, unknown]> = [
      [pred.home_ft, m.home_ft], [pred.away_ft, m.away_ft],
      [pred.home_ht, m.home_ht], [pred.away_ht, m.away_ht],
      [pred.home_yellow, m.home_yellow], [pred.away_yellow, m.away_yellow],
      [pred.home_red, m.home_red], [pred.away_red, m.away_red],
    ]
    for (const [p, a] of fields) {
      if (p !== null && a !== null) {
        totalInputs++
        if (p === a) correctInputs++
      }
    }
  }

  for (const ans of myBonusAnswersFull || []) {
    const questionData = Array.isArray(ans.question) ? ans.question[0] : ans.question
    const q = questionData as { correct_answer: string | null } | null
    if (!q?.correct_answer) continue
    totalInputs++
    if (ans.answer?.trim().toLowerCase() === q.correct_answer.trim().toLowerCase()) correctInputs++
  }

  const correctPct = totalInputs > 0 ? Math.round((correctInputs / totalInputs) * 100) : 0

  const now = new Date()
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

  const { data: upcomingMatches } = await supabase
    .from('matches')
    .select('*, home_team:home_team_id(*), away_team:away_team_id(*)')
    .eq('status', 'scheduled')
    .gt('prediction_deadline_at', now.toISOString())
    .lte('prediction_deadline_at', in7Days.toISOString())
    .order('prediction_deadline_at', { ascending: true })
    .limit(10)

  const { data: myMatchPreds } = await supabase
    .from('match_predictions')
    .select('match_id')
    .eq('user_id', user!.id)

  const predictedMatchIds = new Set((myMatchPreds || []).map((p: { match_id: string }) => p.match_id))

  const { data: openBonusQuestions } = await supabase
    .from('bonus_questions')
    .select('*')
    .eq('active', true)
    .gt('deadline_at', now.toISOString())
    .order('deadline_at', { ascending: true })

  const { data: myBonusAnswers } = await supabase
    .from('bonus_answers')
    .select('question_id')
    .eq('user_id', user!.id)

  const answeredBonusIds = new Set((myBonusAnswers || []).map((a: { question_id: string }) => a.question_id))

  type DeadlineItem = {
    kind: 'match' | 'bonus'
    id: string
    deadline: Date
    label: string
    sub: string
    done: boolean
  }

  const allDeadlineItems: DeadlineItem[] = [
    ...(upcomingMatches || []).map(m => ({
      kind: 'match' as const,
      id: m.id,
      deadline: new Date(m.prediction_deadline_at),
      label: `${m.home_team?.flag ?? ''} ${m.home_team?.name_nl ?? m.home_team_placeholder ?? '?'} — ${m.away_team?.name_nl ?? m.away_team_placeholder ?? '?'} ${m.away_team?.flag ?? ''}`,
      sub: `Groep ${m.group_id} · ${m.city ?? ''}`,
      done: predictedMatchIds.has(m.id),
    })),
    ...(openBonusQuestions || []).map(q => ({
      kind: 'bonus' as const,
      id: q.id,
      deadline: new Date(q.deadline_at),
      label: `${q.icon} ${q.question_nl}`,
      sub: `Bonusvraag · ${q.points_value} punten`,
      done: answeredBonusIds.has(q.id),
    })),
  ].sort((a, b) => a.deadline.getTime() - b.deadline.getTime())

  // Punt 6: alleen OPEN items tonen — geen voltooide
  const deadlineItems = allDeadlineItems
    .filter(item => !item.done)
    .slice(0, 8)

  function formatDeadline(date: Date) {
    return date.toLocaleString('nl-NL', {
      timeZone: 'Europe/Amsterdam',
      day: 'numeric', month: 'short',
      hour: '2-digit', minute: '2-digit',
    })
  }

  function isUrgent(date: Date) {
    return date.getTime() - now.getTime() < 48 * 60 * 60 * 1000
  }

  return (
    <div>
      {/* Punt 8: desktop header ZONDER deadline notificatie */}
      <div className="hidden lg:flex items-center justify-between px-8 py-5 bg-white border-b border-[#e5e1d8]">
        <div>
          <h1 className="heading text-xl font-extrabold text-[#1a5c38]">Home</h1>
          <p className="text-sm text-[#aaa] mt-0.5">Welkom terug, {profile?.display_name}</p>
        </div>
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
            ['Goed', `${correctPct}%`],
          ].map(([lbl, val]) => (
            <div key={lbl} className="bg-white/10 rounded-xl px-3 py-3">
              <p className="text-[11px] text-white/60 mb-0.5">{lbl}</p>
              <p className="heading text-xl font-extrabold text-white">{val}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="p-4 lg:p-8 space-y-5">
        {/* Stats row desktop */}
        <div className="hidden lg:grid grid-cols-3 gap-4">
          {[
            {
              label: 'Totaal punten',
              value: String(myEntry?.total_points ?? 0),
              sub: `${myEntry?.match_points ?? 0} wedstrijd + ${myEntry?.group_points ?? 0} poule + ${myEntry?.bonus_points ?? 0} bonus`,
              accent: true,
            },
            {
              label: 'Positie',
              value: myEntry ? `${myEntry.rank}/${leaderboard.length}` : '—',
              sub: 'In de tussenstand',
              accent: false,
            },
            {
              // Punt 7: granulaire correcte antwoorden over alle inputs
              label: 'Goede antwoorden',
              value: `${correctPct}%`,
              sub: `${correctInputs} van ${totalInputs} invoeren correct`,
              accent: false,
            },
          ].map(s => (
            <div key={s.label} className={`rounded-2xl p-5 border ${s.accent ? 'bg-[#1a5c38] border-[#1a5c38]' : 'bg-white border-[#e5e1d8]'}`}>
              <p className={`text-xs uppercase tracking-wide mb-1 ${s.accent ? 'text-white/60' : 'text-[#aaa]'}`}>{s.label}</p>
              <p className={`heading text-3xl font-extrabold ${s.accent ? 'text-white' : 'text-gray-900'}`}>{s.value}</p>
              <p className={`text-xs mt-1 ${s.accent ? 'text-white/50' : 'text-[#aaa]'}`}>{s.sub}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="space-y-4">

            {/* Aankomende deadlines — alleen open items */}
            {deadlineItems.length > 0 && (
              <div className="card">
                <div className="px-4 py-3 border-b border-[#f6f4ef] flex justify-between items-center">
                  <span className="text-sm font-semibold">Aankomende deadlines</span>
                  <span className="tag bg-amber-50 text-amber-700">{deadlineItems.length} open</span>
                </div>
                {deadlineItems.map(item => {
                  const urgent = isUrgent(item.deadline)
                  return (
                    <Link
                      key={item.id}
                      href={item.kind === 'match' ? '/predict' : '/predict'}
                      className="flex items-center gap-3 px-4 py-3 border-b border-[#f6f4ef] last:border-0 hover:bg-[#fafaf9] transition-colors"
                    >
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${urgent ? 'bg-red-400' : 'bg-amber-400'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate text-gray-900">{item.label}</p>
                        <p className="text-[11px] text-[#aaa] mt-0.5">{item.sub}</p>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          urgent ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
                        }`}>
                          {formatDeadline(item.deadline)}
                        </span>
                        <p className="text-[10px] text-[#ccc] mt-0.5">
                          {formatDistanceToNow(item.deadline, { locale: nl, addSuffix: true })}
                        </p>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}

            {/* Volgende wedstrijd */}
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

            {/* Voortgang */}
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

          {/* Tussenstand */}
          <div className="card">
            <div className="px-4 py-3 border-b border-[#f6f4ef] flex justify-between items-center">
              <span className="text-sm font-semibold">Tussenstand</span>
              <Link href="/stand" className="text-xs font-semibold text-[#1a5c38]">Alles →</Link>
            </div>
            {leaderboard.slice(0, 8).map(p => (
              <div key={p.user_id}
                className={`flex items-center gap-3 px-4 py-3 border-b border-[#f6f4ef] last:border-0 ${
                  p.user_id === user?.id ? 'bg-[#eaf4ef]' : 'bg-white'
                }`}>
                <span className={`w-6 text-center ${p.rank <= 3 ? 'text-lg' : 'text-xs font-bold text-[#ccc]'}`}>
                  {p.rank === 1 ? '🥇' : p.rank === 2 ? '🥈' : p.rank === 3 ? '🥉' : p.rank}
                </span>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  p.user_id === user?.id ? 'bg-[#1a5c38]' : 'bg-[#e5e1d8]'
                }`}>
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

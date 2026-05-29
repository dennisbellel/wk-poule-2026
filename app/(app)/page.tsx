import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { nl } from 'date-fns/locale'
import { sortLeaderboard } from '@/lib/points/calculate'
import { formatDateTimeNL, isDeadlineUrgent } from '@/lib/format'
import FeedReactions from '@/components/home/FeedReactions'
import DeadlineCountdown from '@/components/home/DeadlineCountdown'

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

  // Eerstvolgende deadline (wedstrijd of bonusvraag) voor de countdown bovenin
  const nowIso = new Date().toISOString()
  const [{ data: nextMatchForCountdown }, { data: nextBonusForCountdown }] = await Promise.all([
    supabase.from('matches')
      .select('id, prediction_deadline_at, home_team:home_team_id(name_nl), away_team:away_team_id(name_nl), home_team_placeholder, away_team_placeholder')
      .eq('status', 'scheduled')
      .gt('prediction_deadline_at', nowIso)
      .order('prediction_deadline_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase.from('bonus_questions')
      .select('id, question_nl, deadline_at, icon')
      .eq('active', true)
      .gt('deadline_at', nowIso)
      .order('deadline_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ])

  let countdownLabel: string | null = null
  let countdownDeadline: string | null = null
  const matchDeadline = nextMatchForCountdown?.prediction_deadline_at
  const bonusDeadline = nextBonusForCountdown?.deadline_at
  if (matchDeadline && (!bonusDeadline || new Date(matchDeadline) <= new Date(bonusDeadline))) {
    const m = nextMatchForCountdown
    const home = Array.isArray(m?.home_team) ? m.home_team[0] : m?.home_team
    const away = Array.isArray(m?.away_team) ? m.away_team[0] : m?.away_team
    const homeName = (home as { name_nl?: string } | null)?.name_nl ?? m?.home_team_placeholder ?? '?'
    const awayName = (away as { name_nl?: string } | null)?.name_nl ?? m?.away_team_placeholder ?? '?'
    countdownLabel = `${homeName} - ${awayName}`
    countdownDeadline = matchDeadline
  } else if (bonusDeadline) {
    countdownLabel = `${nextBonusForCountdown?.icon ?? '🎯'} ${nextBonusForCountdown?.question_nl}`
    countdownDeadline = bonusDeadline
  }

  const { count: predCount } = await supabase
    .from('match_predictions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user!.id)

  const { count: totalGroupMatches } = await supabase
    .from('matches')
    .select('*', { count: 'exact', head: true })
    .eq('phase', 'group')

  // Aantal volledig voorspelde groepen (alle 4 teams ingevuld)
  const { data: myGroupPreds } = await supabase
    .from('group_standing_predictions')
    .select('group_id')
    .eq('user_id', user!.id)
  const groupCounts = new Map<string, number>()
  for (const p of myGroupPreds || []) groupCounts.set(p.group_id, (groupCounts.get(p.group_id) || 0) + 1)
  const completedGroups = Array.from(groupCounts.values()).filter(n => n === 4).length

  const { count: bonusCount } = await supabase
    .from('bonus_answers')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user!.id)

  const { count: totalBonus } = await supabase
    .from('bonus_questions')
    .select('*', { count: 'exact', head: true })
    .eq('active', true)

  // Percentage goed: tel mijn correcte inputs / totaal mogelijke inputs voor alle gespeelde wedstrijden.
  // "Mogelijke inputs" = aantal velden in gespeelde wedstrijden waar een uitslag bekend is (max 8 per match).
  const { data: finishedForStats } = await supabase
    .from('matches')
    .select('id, home_ft, away_ft, home_ht, away_ht, home_yellow, away_yellow, home_red, away_red')
    .eq('status', 'finished')

  const { data: myPredictions } = await supabase
    .from('match_predictions')
    .select('match_id, home_ft, away_ft, home_ht, away_ht, home_yellow, away_yellow, home_red, away_red')
    .eq('user_id', user!.id)

  const myPredsByMatch = new Map<string, typeof myPredictions extends (infer U)[] | null ? U : never>()
  for (const p of myPredictions || []) myPredsByMatch.set(p.match_id, p)

  let correctInputs = 0
  let totalInputs = 0
  for (const m of finishedForStats || []) {
    const fields: Array<[number | null, keyof typeof m, string]> = [
      [m.home_ft, 'home_ft', 'home_ft'], [m.away_ft, 'away_ft', 'away_ft'],
      [m.home_ht, 'home_ht', 'home_ht'], [m.away_ht, 'away_ht', 'away_ht'],
      [m.home_yellow, 'home_yellow', 'home_yellow'], [m.away_yellow, 'away_yellow', 'away_yellow'],
      [m.home_red, 'home_red', 'home_red'], [m.away_red, 'away_red', 'away_red'],
    ]
    const myPred = myPredsByMatch.get(m.id)
    for (const [actual, , predKey] of fields) {
      if (actual === null) continue
      totalInputs++
      const myVal = myPred ? (myPred as Record<string, number | null>)[predKey] : null
      if (myVal === actual) correctInputs++
    }
  }

  // Bonusvragen: ook meetellen als "had goed kunnen zijn" zodra correct_answer gezet is
  const { data: publishedBonusQs } = await supabase
    .from('bonus_questions')
    .select('id, correct_answer')
    .not('correct_answer', 'is', null)

  const { data: myBonusAnswersFull } = await supabase
    .from('bonus_answers')
    .select('question_id, answer')
    .eq('user_id', user!.id)

  const myBonusByQ = new Map((myBonusAnswersFull || []).map(a => [a.question_id, a.answer]))
  for (const q of publishedBonusQs || []) {
    if (!q.correct_answer) continue
    totalInputs++
    const myAns = myBonusByQ.get(q.id)
    if (myAns?.trim().toLowerCase() === q.correct_answer.trim().toLowerCase()) correctInputs++
  }

  const correctPct = totalInputs > 0 ? Math.round((correctInputs / totalInputs) * 100) : 0

  // Rivaliteit: persoon één plek boven jou (of onder als je #1 bent)
  type Rival = { display_name: string; rank: number; total_points: number; pointsDiff: number; direction: 'above' | 'below' }
  let rival: Rival | null = null
  if (myEntry && leaderboard.length > 1) {
    if (myEntry.rank > 1) {
      const above = leaderboard.find(e => e.rank === myEntry.rank - 1)
      if (above) rival = {
        display_name: above.display_name,
        rank: above.rank,
        total_points: above.total_points,
        pointsDiff: above.total_points - myEntry.total_points,
        direction: 'above',
      }
    } else {
      const below = leaderboard.find(e => e.rank === 2)
      if (below) rival = {
        display_name: below.display_name,
        rank: below.rank,
        total_points: below.total_points,
        pointsDiff: myEntry.total_points - below.total_points,
        direction: 'below',
      }
    }
  }

  // Reactions voor feed-items
  const { data: reactionsData } = await supabase
    .from('match_reactions')
    .select('id, user_id, match_id, emoji')

  // Bijzondere scores feed: per recent gepubliceerde wedstrijd één statement
  const { data: recentFinished } = await supabase
    .from('matches')
    .select('id, scheduled_at, home_ft, away_ft, home_ht, away_ht, home_yellow, away_yellow, home_red, away_red, home_team:home_team_id(name_nl, flag), away_team:away_team_id(name_nl, flag)')
    .eq('status', 'finished')
    .order('scheduled_at', { ascending: false })
    .limit(5)

  type FeedItem = {
    matchId: string
    homeFlag: string; homeName: string
    awayFlag: string; awayName: string
    homeFt: number; awayFt: number
    headline: string
    headlineEmoji: string
    sub: string | null
  }
  const feedItems: FeedItem[] = []

  if (recentFinished && recentFinished.length > 0) {
    const matchIds = recentFinished.map(m => m.id)
    const { data: predsForRecent } = await supabase
      .from('match_predictions')
      .select('match_id, user_id, points, home_ft, away_ft, home_ht, away_ht, home_yellow, away_yellow, home_red, away_red, profile:user_id(display_name)')
      .in('match_id', matchIds)

    for (const m of recentFinished) {
      const homeTeam = Array.isArray(m.home_team) ? m.home_team[0] : m.home_team
      const awayTeam = Array.isArray(m.away_team) ? m.away_team[0] : m.away_team
      const matchPreds = (predsForRecent || []).filter(p => p.match_id === m.id)

      type FieldKey = 'home_ft' | 'away_ft' | 'home_ht' | 'away_ht' | 'home_yellow' | 'away_yellow' | 'home_red' | 'away_red'
      const fieldKeys: FieldKey[] = ['home_ft', 'away_ft', 'home_ht', 'away_ht', 'home_yellow', 'away_yellow', 'home_red', 'away_red']
      function correctCount(p: Record<string, unknown>): number {
        let c = 0
        for (const k of fieldKeys) {
          const actual = (m as unknown as Record<string, number | null>)[k]
          if (actual !== null && p[k] === actual) c++
        }
        return c
      }

      const exactScorers = matchPreds.filter(p => p.home_ft === m.home_ft && p.away_ft === m.away_ft)
      const perfectScorers = matchPreds.filter(p => correctCount(p as unknown as Record<string, unknown>) === 8)

      const topScorer = matchPreds.length > 0
        ? [...matchPreds].sort((a, b) => (b.points ?? 0) - (a.points ?? 0))[0]
        : null
      const topName = topScorer
        ? (Array.isArray(topScorer.profile) ? topScorer.profile[0]?.display_name : (topScorer.profile as { display_name?: string } | null)?.display_name)
        : null

      let headline = ''
      let headlineEmoji = ''
      if (perfectScorers.length > 0) {
        const perfectNames = perfectScorers.map(p => Array.isArray(p.profile) ? p.profile[0]?.display_name : (p.profile as { display_name?: string } | null)?.display_name).filter(Boolean)
        headlineEmoji = '⭐'
        headline = perfectScorers.length === 1
          ? `Perfect! ${perfectNames[0]} had alles goed`
          : `${perfectScorers.length} deelnemers hadden alles goed`
      } else if (exactScorers.length === 0) {
        headlineEmoji = '🤷'
        headline = 'Niemand had de uitslag goed'
      } else if (exactScorers.length === 1) {
        const name = Array.isArray(exactScorers[0].profile) ? exactScorers[0].profile[0]?.display_name : (exactScorers[0].profile as { display_name?: string } | null)?.display_name
        headlineEmoji = '🎯'
        headline = `${name} had als enige de uitslag goed`
      } else {
        headlineEmoji = '🤝'
        headline = `${exactScorers.length} deelnemers hadden de uitslag goed`
      }

      feedItems.push({
        matchId: m.id,
        homeFlag: homeTeam?.flag ?? '', homeName: homeTeam?.name_nl ?? '?',
        awayFlag: awayTeam?.flag ?? '', awayName: awayTeam?.name_nl ?? '?',
        homeFt: m.home_ft ?? 0, awayFt: m.away_ft ?? 0,
        headline, headlineEmoji,
        sub: topScorer && (topScorer.points ?? 0) > 0 && topName ? `Topscoorder: ${topName} · ${topScorer.points} pt` : null,
      })
    }
  }


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
    href: string  // gerichte deeplink naar de juiste tab + specifieke kaart
  }

  // Bouw deeplinks die naar de juiste tab + sub-tab navigeren, met een hash om de
  // exacte kaart in beeld te scrollen.
  function buildMatchHref(m: { id: string; phase: string }): string {
    if (m.phase === 'group') return `/predict?tab=group&sub=matches#match-${m.id}`
    return `/predict?tab=knockout#match-${m.id}`
  }

  function buildBonusHref(q: { id: string; phase: string }): string {
    if (q.phase === 'group') return `/predict?tab=group&sub=bonus#bonus-${q.id}`
    if (q.phase === 'live') return `/predict?tab=live#bonus-${q.id}`
    // tournament + knockout vallen onder de Toernooi-tab
    return `/predict?tab=tournament#bonus-${q.id}`
  }

  const allDeadlineItems: DeadlineItem[] = [
    ...(upcomingMatches || []).map(m => ({
      kind: 'match' as const,
      id: m.id,
      deadline: new Date(m.prediction_deadline_at),
      label: `${m.home_team?.flag ?? ''} ${m.home_team?.name_nl ?? m.home_team_placeholder ?? '?'} — ${m.away_team?.name_nl ?? m.away_team_placeholder ?? '?'} ${m.away_team?.flag ?? ''}`,
      sub: `Groep ${m.group_id} · ${m.city ?? ''}`,
      done: predictedMatchIds.has(m.id),
      href: buildMatchHref(m),
    })),
    ...(openBonusQuestions || []).map(q => ({
      kind: 'bonus' as const,
      id: q.id,
      deadline: new Date(q.deadline_at),
      label: `${q.icon} ${q.question_nl}`,
      sub: `Bonusvraag · ${q.points_value} punten`,
      done: answeredBonusIds.has(q.id),
      href: buildBonusHref(q),
    })),
  ].sort((a, b) => a.deadline.getTime() - b.deadline.getTime())

  // Punt 6: alleen OPEN items tonen — geen voltooide
  const deadlineItems = allDeadlineItems
    .filter(item => !item.done)
    .slice(0, 8)

  const formatDeadline = formatDateTimeNL
  const isUrgent = (date: Date) => isDeadlineUrgent(date, now)

  return (
    <div>
      {/* Punt 8: desktop header ZONDER deadline notificatie */}
      <div className="hidden lg:flex items-center justify-between px-8 py-5 bg-white border-b border-[#e5e1d8]">
        <div>
          <h1 className="heading text-xl font-extrabold text-[#1a5c38]">Home</h1>
          <p className="text-sm text-[#aaa] mt-0.5">Welkom terug, {profile?.display_name}</p>
        </div>
      </div>

      {/* Mobile hero — met de stat-cards erin gevangen */}
      <div className="lg:hidden bg-[#1a5c38] px-5 pt-8 pb-5">
        <p className="text-xs text-white/60 mb-1">Dé WK Poule 2026</p>
        <h1 className="heading text-2xl font-extrabold text-white mb-4">
          Hey {profile?.display_name} 👋
        </h1>
        <div className="grid grid-cols-3 gap-2.5">
          {[
            { label: 'Positie', value: myEntry ? `${myEntry.rank}/${leaderboard.length}` : '—' },
            { label: 'Punten', value: String(myEntry?.total_points ?? 0) },
            { label: 'Goed', value: `${correctPct}%` },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl p-3">
              <p className="text-[10px] uppercase tracking-wide mb-0.5 text-[#aaa]">{s.label}</p>
              <p className="heading text-xl font-extrabold text-gray-900">{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="p-4 lg:p-8 space-y-5">
        {/* Sectie 1: Live countdown bovenaan */}
        {countdownLabel && countdownDeadline && (
          <DeadlineCountdown label={countdownLabel} deadline={countdownDeadline} />
        )}

        {/* Desktop stat cards (mobile staan ze in de hero) */}
        <div className="hidden lg:grid grid-cols-3 gap-4">
          {[
            { label: 'Positie', value: myEntry ? `${myEntry.rank}/${leaderboard.length}` : '—' },
            { label: 'Punten', value: String(myEntry?.total_points ?? 0) },
            { label: 'Goed', value: `${correctPct}%` },
          ].map(s => (
            <div key={s.label} className="rounded-2xl p-5 border bg-white border-[#e5e1d8]">
              <p className="text-xs uppercase tracking-wide mb-1 text-[#aaa]">{s.label}</p>
              <p className="heading text-3xl font-extrabold text-gray-900">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Sectie 2: Deadlines + Tussenstand naast elkaar */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Aankomende deadlines */}
          {deadlineItems.length > 0 ? (
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
                    href={item.href}
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
          ) : (
            <div className="card p-6 text-center text-sm text-[#aaa]">
              Geen open deadlines de komende 7 dagen 🎉
            </div>
          )}

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

        {/* Sectie 3: Feed (links) | Rivaliteit + Voortgang (rechts gestapeld) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
          {/* Feed met bijzondere scores */}
          {feedItems.length > 0 ? (
            <div className="card">
              <div className="px-4 py-3 border-b border-[#f6f4ef]">
                <span className="text-sm font-semibold">Recente wedstrijden</span>
              </div>
              {feedItems.map(item => (
                <div key={item.matchId} className="px-4 py-3 border-b border-[#f6f4ef] last:border-0">
                  <Link href={`/match/${item.matchId}`} className="block hover:bg-[#fafaf9] -mx-4 px-4 py-1 rounded transition-colors">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-sm font-medium flex-1 truncate">
                        {item.homeFlag} {item.homeName}
                      </span>
                      <span className="heading text-base font-extrabold text-[#1a5c38] px-2">
                        {item.homeFt}–{item.awayFt}
                      </span>
                      <span className="text-sm font-medium flex-1 truncate text-right">
                        {item.awayName} {item.awayFlag}
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-base">{item.headlineEmoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-700">{item.headline}</p>
                        {item.sub && <p className="text-[11px] text-[#aaa] mt-0.5">{item.sub}</p>}
                      </div>
                      <span className="text-[10px] text-[#ccc] flex-shrink-0 self-center">details →</span>
                    </div>
                  </Link>
                  <FeedReactions matchId={item.matchId} reactions={reactionsData || []} currentUserId={user!.id} />
                </div>
              ))}
            </div>
          ) : (
            <div className="card p-6 text-center text-sm text-[#aaa]">
              Nog geen gespeelde wedstrijden
            </div>
          )}

          {/* Rivaliteit + Voortgang gestapeld */}
          <div className="space-y-5">
            {/* Rivaliteit */}
            {rival && myEntry && (
              <div className="card overflow-hidden">
                <div className="px-4 py-3 border-b border-[#f6f4ef]">
                  <span className="text-sm font-semibold">
                    {rival.direction === 'above' ? '🎯 In jouw vizier' : '👀 Op jouw hielen'}
                  </span>
                </div>
                <div className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex items-center gap-2 flex-1">
                      <div className="w-9 h-9 rounded-full bg-[#1a5c38] flex items-center justify-center flex-shrink-0">
                        <span className="heading text-sm font-bold text-white">{myEntry.display_name[0]}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-[#aaa]">#{myEntry.rank}</p>
                        <p className="text-sm font-semibold text-[#1a5c38] truncate">Jij</p>
                      </div>
                    </div>
                    <div className="text-center px-3">
                      <p className="text-[10px] uppercase tracking-wide text-[#aaa]">verschil</p>
                      <p className="heading text-xl font-extrabold text-gray-900">{rival.pointsDiff} pt</p>
                    </div>
                    <div className="flex items-center gap-2 flex-1 justify-end">
                      <div className="min-w-0 text-right">
                        <p className="text-xs text-[#aaa]">#{rival.rank}</p>
                        <p className="text-sm font-semibold truncate" title={rival.display_name}>{rival.display_name}</p>
                      </div>
                      <div className="w-9 h-9 rounded-full bg-[#e5e1d8] flex items-center justify-center flex-shrink-0">
                        <span className="heading text-sm font-bold text-[#777]">{rival.display_name[0]}</span>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-[#888] text-center">
                    {rival.direction === 'above'
                      ? rival.pointsDiff <= 3
                        ? `Nog ${rival.pointsDiff} ${rival.pointsDiff === 1 ? 'punt' : 'punten'} en je staat op ${rival.rank} 👀`
                        : `${rival.pointsDiff} punten goedmaken voor plek ${rival.rank}. Komt goed.`
                      : rival.pointsDiff <= 3
                        ? `Nek-aan-nek — ${rival.display_name} zit ${rival.pointsDiff} ${rival.pointsDiff === 1 ? 'punt' : 'punten'} achter je 😅`
                        : `${rival.display_name} zit ${rival.pointsDiff} punten achter je. Voorlopig veilig.`}
                  </p>
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
                ['Poulestand (groepen af)', completedGroups, 12],
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
        </div>
      </div>
    </div>
  )
}

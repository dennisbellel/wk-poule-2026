import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { DEFAULT_SCORING, type ScoringKeys } from '@/types'
import { formatDateTimeNL } from '@/lib/format'
import { calculateMatchPointsBreakdown } from '@/lib/points/calculate'

export const dynamic = 'force-dynamic'

type PageProps = { params: Promise<{ id: string }> }

export default async function MatchDetailPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: match } = await supabase
    .from('matches')
    .select('*, home_team:home_team_id(*), away_team:away_team_id(*)')
    .eq('id', id)
    .single()

  if (!match) notFound()
  if (match.status !== 'finished') {
    // Alleen gespeelde wedstrijden hebben zinvolle detail-data
    return (
      <div className="p-4 lg:p-8 max-w-2xl mx-auto">
        <Link href="/" className="text-sm text-[#1a5c38] font-semibold mb-3 inline-block">← Terug</Link>
        <div className="card p-6 text-center text-sm text-[#888]">
          Deze wedstrijd is nog niet gespeeld — er is nog niets te zien.
        </div>
      </div>
    )
  }

  // Scoring config voor breakdown
  const { data: scoringRows } = await supabase.from('scoring_config').select('key, value')
  const scoring = { ...DEFAULT_SCORING } as ScoringKeys
  for (const row of scoringRows || []) {
    if (row.key in scoring) (scoring as unknown as Record<string, number>)[row.key] = row.value
  }

  // Alle voorspellingen op deze wedstrijd, met profiel
  const { data: predictionsRaw } = await supabase
    .from('match_predictions')
    .select('*, profile:user_id(id, display_name, avatar_color)')
    .eq('match_id', id)

  type PredWithProfile = {
    id: string
    user_id: string
    points: number | null
    home_ft: number | null
    away_ft: number | null
    home_ht: number | null
    away_ht: number | null
    home_yellow: number | null
    away_yellow: number | null
    home_red: number | null
    away_red: number | null
    profile: { id: string; display_name: string; avatar_color: string | null } | { id: string; display_name: string; avatar_color: string | null }[] | null
  }

  const predictions: Array<{
    user_id: string
    display_name: string
    avatar_color: string | null
    points: number
    home_ft: number | null
    away_ft: number | null
    home_ht: number | null
    away_ht: number | null
    home_yellow: number | null
    away_yellow: number | null
    home_red: number | null
    away_red: number | null
    isExact: boolean
  }> = (predictionsRaw || []).map((p: PredWithProfile) => {
    const profile = Array.isArray(p.profile) ? p.profile[0] : p.profile
    return {
      user_id: p.user_id,
      display_name: profile?.display_name ?? 'Onbekend',
      avatar_color: profile?.avatar_color ?? null,
      points: p.points ?? 0,
      home_ft: p.home_ft, away_ft: p.away_ft,
      home_ht: p.home_ht, away_ht: p.away_ht,
      home_yellow: p.home_yellow, away_yellow: p.away_yellow,
      home_red: p.home_red, away_red: p.away_red,
      isExact: p.home_ft === match.home_ft && p.away_ft === match.away_ft,
    }
  })

  // Sorteer op punten descending, dan op naam
  predictions.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    return a.display_name.localeCompare(b.display_name)
  })

  // Statistieken
  const totalParticipants = predictions.length
  const exactCount = predictions.filter(p => p.isExact).length
  const totalPossible = predictions.length > 0 ? Math.max(...predictions.map(p => p.points)) : 0
  const topScorers = predictions.filter(p => p.points === totalPossible && totalPossible > 0)
  const homeTeam = Array.isArray(match.home_team) ? match.home_team[0] : match.home_team
  const awayTeam = Array.isArray(match.away_team) ? match.away_team[0] : match.away_team

  return (
    <div className="p-4 lg:p-8 max-w-3xl mx-auto space-y-5">
      <Link href="/" className="text-sm text-[#1a5c38] font-semibold inline-block">← Terug naar home</Link>

      {/* Wedstrijd header */}
      <div className="card overflow-hidden">
        <div className="bg-[#1a5c38] px-5 py-4">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
            <span className="text-[11px] uppercase tracking-wide text-white/60 font-semibold">
              {match.group_id ? `Groep ${match.group_id}` : (match.phase || '').toUpperCase()}
            </span>
            <span className="text-[11px] text-white/60">{formatDateTimeNL(match.scheduled_at)}</span>
          </div>
          <div className="flex items-center gap-3 mt-2">
            <span className="flex-1 text-base font-semibold text-white">{homeTeam?.flag} {homeTeam?.name_nl}</span>
            <div className="bg-white/20 px-4 py-2 rounded-xl">
              <span className="heading text-2xl font-extrabold text-white">{match.home_ft} – {match.away_ft}</span>
            </div>
            <span className="flex-1 text-base font-semibold text-white text-right">{awayTeam?.name_nl} {awayTeam?.flag}</span>
          </div>
          <p className="text-[11px] text-white/70 text-center mt-2">
            rust {match.home_ht}–{match.away_ht}
            {(match.home_yellow ?? 0) + (match.away_yellow ?? 0) > 0 && ` · 🟨 ${(match.home_yellow ?? 0) + (match.away_yellow ?? 0)}`}
            {(match.home_red ?? 0) + (match.away_red ?? 0) > 0 && ` · 🟥 ${(match.home_red ?? 0) + (match.away_red ?? 0)}`}
            {match.venue && ` · ${match.venue}, ${match.city}`}
          </p>
        </div>

        {/* Overzicht-statistieken */}
        <div className="grid grid-cols-3 divide-x divide-[#f6f4ef]">
          <div className="p-4 text-center">
            <p className="heading text-2xl font-extrabold text-gray-900">{totalParticipants}</p>
            <p className="text-[11px] text-[#888] uppercase tracking-wide mt-0.5">Voorspellingen</p>
          </div>
          <div className="p-4 text-center">
            <p className="heading text-2xl font-extrabold text-[#1a5c38]">{exactCount}</p>
            <p className="text-[11px] text-[#888] uppercase tracking-wide mt-0.5">Exact goed</p>
          </div>
          <div className="p-4 text-center">
            <p className="heading text-2xl font-extrabold text-amber-600">{totalPossible}</p>
            <p className="text-[11px] text-[#888] uppercase tracking-wide mt-0.5">Topscore</p>
          </div>
        </div>
      </div>

      {/* Topscoorder(s) van deze wedstrijd */}
      {topScorers.length > 0 && (
        <div className="card p-4">
          <p className="text-[11px] text-[#888] uppercase tracking-wide font-semibold mb-2">🏆 Beste voorspelling</p>
          <div className="flex flex-wrap gap-2">
            {topScorers.map(p => (
              <div key={p.user_id} className={`flex items-center gap-2 px-3 py-2 rounded-xl ${p.user_id === user?.id ? 'bg-[#eaf4ef] border border-[#c8e6d4]' : 'bg-[#f6f4ef]'}`}>
                <div className="w-7 h-7 rounded-full bg-[#1a5c38] flex items-center justify-center flex-shrink-0">
                  <span className="heading text-xs font-bold text-white">{p.display_name[0]}</span>
                </div>
                <span className={`text-sm font-semibold ${p.user_id === user?.id ? 'text-[#1a5c38]' : 'text-gray-800'}`}>
                  {p.display_name}{p.user_id === user?.id ? ' (jij)' : ''}
                </span>
                <span className="heading text-sm font-extrabold text-[#1a5c38]">{p.points} pt</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lijst per deelnemer */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-[#f6f4ef]">
          <p className="text-sm font-semibold">Alle voorspellingen</p>
          <p className="text-[11px] text-[#aaa] mt-0.5">Gerangschikt op behaalde punten</p>
        </div>
        {predictions.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-[#aaa]">Niemand heeft deze wedstrijd voorspeld</div>
        ) : (
          predictions.map(p => {
            const breakdown = calculateMatchPointsBreakdown(match, {
              home_ft: p.home_ft, away_ft: p.away_ft,
              home_ht: p.home_ht, away_ht: p.away_ht,
              home_yellow: p.home_yellow, away_yellow: p.away_yellow,
              home_red: p.home_red, away_red: p.away_red,
            }, scoring)
            const isMe = p.user_id === user?.id
            return (
              <div key={p.user_id} className={`px-4 py-3 border-b border-[#f6f4ef] last:border-0 ${isMe ? 'bg-[#eaf4ef]' : ''}`}>
                <div className="flex items-center gap-3 mb-1.5">
                  <div className="w-8 h-8 rounded-full bg-[#e5e1d8] flex items-center justify-center flex-shrink-0">
                    <span className="heading text-xs font-bold text-[#777]">{p.display_name[0]}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm truncate ${isMe ? 'font-semibold text-[#1a5c38]' : 'font-medium'}`}>
                      {p.display_name}{isMe ? ' (jij)' : ''}
                    </p>
                    <p className="text-[11px] text-[#aaa]">
                      {p.home_ft ?? '–'}-{p.away_ft ?? '–'}
                      <span className="text-[#ccc]"> · rust </span>{p.home_ht ?? '–'}-{p.away_ht ?? '–'}
                      <span className="text-[#ccc]"> · </span>🟨 {p.home_yellow ?? '–'}/{p.away_yellow ?? '–'}
                      <span className="text-[#ccc]"> · </span>🟥 {p.home_red ?? '–'}/{p.away_red ?? '–'}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    {p.isExact && <span className="block text-[10px] text-[#1a5c38] font-bold mb-0.5">🎯 EXACT</span>}
                    <span className={`heading text-lg font-extrabold ${p.points > 0 ? 'text-[#1a5c38]' : 'text-[#ccc]'}`}>
                      {p.points} pt
                    </span>
                  </div>
                </div>
                {/* Mini-breakdown chips */}
                <div className="flex flex-wrap gap-1 pl-11">
                  {breakdown.ft_home + breakdown.ft_away + breakdown.ft_exact_bonus > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#eaf4ef] text-[#1a5c38] font-semibold">
                      Eindstand +{breakdown.ft_home + breakdown.ft_away + breakdown.ft_exact_bonus}
                    </span>
                  )}
                  {breakdown.ht_home + breakdown.ht_away + breakdown.ht_exact_bonus > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#eaf4ef] text-[#1a5c38] font-semibold">
                      Ruststand +{breakdown.ht_home + breakdown.ht_away + breakdown.ht_exact_bonus}
                    </span>
                  )}
                  {breakdown.yellow_home + breakdown.yellow_away > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#eaf4ef] text-[#1a5c38] font-semibold">
                      🟨 +{breakdown.yellow_home + breakdown.yellow_away}
                    </span>
                  )}
                  {breakdown.red_home + breakdown.red_away > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#eaf4ef] text-[#1a5c38] font-semibold">
                      🟥 +{breakdown.red_home + breakdown.red_away}
                    </span>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

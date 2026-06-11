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

  const isFinished = match.status === 'finished'
  const deadlinePassed = new Date(match.prediction_deadline_at) < new Date()

  // Voorspellingen van anderen pas zichtbaar vanaf de deadline (anti-afkijken)
  if (!deadlinePassed && !isFinished) {
    return (
      <div className="p-4 lg:p-8 max-w-2xl mx-auto">
        <Link href="/" className="text-sm text-[#1a5c38] font-semibold mb-3 inline-block">← Terug</Link>
        <div className="card p-6 text-center text-sm text-[#888]">
          🔒 Voorspellingen van anderen worden zichtbaar zodra de deadline van deze wedstrijd is verstreken.
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

  const { data: predictionsRaw } = await supabase
    .from('match_predictions')
    .select('*, profile:user_id(id, display_name, avatar_color)')
    .eq('match_id', id)

  type PredWithProfile = {
    user_id: string
    points: number | null
    home_ft: number | null; away_ft: number | null
    home_ht: number | null; away_ht: number | null
    home_yellow: number | null; away_yellow: number | null
    home_red: number | null; away_red: number | null
    profile: { display_name: string } | { display_name: string }[] | null
  }

  const predictions = (predictionsRaw || []).map((p: PredWithProfile) => {
    const profile = Array.isArray(p.profile) ? p.profile[0] : p.profile
    return {
      user_id: p.user_id,
      display_name: profile?.display_name ?? 'Onbekend',
      points: p.points ?? 0,
      home_ft: p.home_ft, away_ft: p.away_ft,
      home_ht: p.home_ht, away_ht: p.away_ht,
      home_yellow: p.home_yellow, away_yellow: p.away_yellow,
      home_red: p.home_red, away_red: p.away_red,
      isExact: isFinished && p.home_ft === match.home_ft && p.away_ft === match.away_ft,
    }
  })

  // Sorteer: gespeeld → op punten; nog niet gespeeld → op naam
  predictions.sort((a, b) => {
    if (isFinished && b.points !== a.points) return b.points - a.points
    return a.display_name.localeCompare(b.display_name)
  })

  const homeTeam = Array.isArray(match.home_team) ? match.home_team[0] : match.home_team
  const awayTeam = Array.isArray(match.away_team) ? match.away_team[0] : match.away_team
  const homeName = homeTeam?.name_nl ?? match.home_team_placeholder ?? '?'
  const awayName = awayTeam?.name_nl ?? match.away_team_placeholder ?? '?'

  // ── Samenvatting (optie 3): verdeling van uitkomsten + meest voorspelde eindstand ──
  const total = predictions.length
  let homeWin = 0, draw = 0, awayWin = 0
  const scoreCount = new Map<string, number>()
  for (const p of predictions) {
    if (p.home_ft != null && p.away_ft != null) {
      if (p.home_ft > p.away_ft) homeWin++
      else if (p.away_ft > p.home_ft) awayWin++
      else draw++
      const key = `${p.home_ft}-${p.away_ft}`
      scoreCount.set(key, (scoreCount.get(key) || 0) + 1)
    }
  }
  let topScore: { score: string; count: number } | null = null
  for (const [score, count] of scoreCount) {
    if (!topScore || count > topScore.count) topScore = { score, count }
  }

  // Statistieken voor finished
  const exactCount = predictions.filter(p => p.isExact).length
  const topPoints = isFinished && predictions.length > 0 ? Math.max(...predictions.map(p => p.points)) : 0
  const topScorers = isFinished ? predictions.filter(p => p.points === topPoints && topPoints > 0) : []

  function pct(n: number) { return total > 0 ? Math.round((n / total) * 100) : 0 }

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
            <span className="flex-1 text-base font-semibold text-white">{homeTeam?.flag} {homeName}</span>
            <div className="bg-white/20 px-4 py-2 rounded-xl">
              {isFinished ? (
                <span className="heading text-2xl font-extrabold text-white">{match.home_ft} – {match.away_ft}</span>
              ) : (
                <span className="text-sm font-semibold text-white/70">nog te spelen</span>
              )}
            </div>
            <span className="flex-1 text-base font-semibold text-white text-right">{awayName} {awayTeam?.flag}</span>
          </div>
          {isFinished && (
            <p className="text-[11px] text-white/70 text-center mt-2">
              rust {match.home_ht}–{match.away_ht}
              {(match.home_yellow ?? 0) + (match.away_yellow ?? 0) > 0 && ` · 🟨 ${(match.home_yellow ?? 0) + (match.away_yellow ?? 0)}`}
              {(match.home_red ?? 0) + (match.away_red ?? 0) > 0 && ` · 🟥 ${(match.home_red ?? 0) + (match.away_red ?? 0)}`}
              {match.venue && ` · ${match.venue}, ${match.city}`}
            </p>
          )}
        </div>
      </div>

      {/* ── Samenvatting (optie 3) ── */}
      {total > 0 && (
        <div className="card p-4">
          <p className="text-[11px] text-[#888] uppercase tracking-wide font-semibold mb-3">
            Wat denkt de groep? · {total} voorspelling{total === 1 ? '' : 'en'}
          </p>
          {/* Verdeling-balk */}
          <div className="flex h-8 rounded-lg overflow-hidden mb-2">
            {homeWin > 0 && <div className="bg-[#1a5c38] flex items-center justify-center" style={{ width: `${pct(homeWin)}%` }}>
              {pct(homeWin) >= 12 && <span className="text-[10px] font-bold text-white">{pct(homeWin)}%</span>}
            </div>}
            {draw > 0 && <div className="bg-[#c9930a] flex items-center justify-center" style={{ width: `${pct(draw)}%` }}>
              {pct(draw) >= 12 && <span className="text-[10px] font-bold text-white">{pct(draw)}%</span>}
            </div>}
            {awayWin > 0 && <div className="bg-[#3b82f6] flex items-center justify-center" style={{ width: `${pct(awayWin)}%` }}>
              {pct(awayWin) >= 12 && <span className="text-[10px] font-bold text-white">{pct(awayWin)}%</span>}
            </div>}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#888]">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#1a5c38]" /> {homeName} wint ({homeWin})</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#c9930a]" /> Gelijk ({draw})</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#3b82f6]" /> {awayName} wint ({awayWin})</span>
          </div>
          {topScore && (
            <p className="text-xs text-[#888] mt-3 pt-3 border-t border-[#f6f4ef]">
              Meest voorspelde eindstand: <strong className="text-gray-800">{topScore.score}</strong> ({topScore.count}×)
            </p>
          )}
        </div>
      )}

      {/* Beste voorspelling (alleen gespeeld) */}
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
          <p className="text-sm font-semibold">Ieders voorspelling</p>
          <p className="text-[11px] text-[#aaa] mt-0.5">
            {isFinished ? 'Gerangschikt op behaalde punten' : 'Zichtbaar omdat de deadline is verstreken'}
          </p>
        </div>
        {predictions.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-[#aaa]">Niemand heeft deze wedstrijd voorspeld</div>
        ) : (
          predictions.map(p => {
            const breakdown = isFinished ? calculateMatchPointsBreakdown(match, {
              home_ft: p.home_ft, away_ft: p.away_ft,
              home_ht: p.home_ht, away_ht: p.away_ht,
              home_yellow: p.home_yellow, away_yellow: p.away_yellow,
              home_red: p.home_red, away_red: p.away_red,
            }, scoring) : null
            const isMe = p.user_id === user?.id
            return (
              <div key={p.user_id} className={`px-4 py-3 border-b border-[#f6f4ef] last:border-0 ${isMe ? 'bg-[#eaf4ef]' : ''}`}>
                <div className="flex items-center gap-3">
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
                  {isFinished && (
                    <div className="text-right flex-shrink-0">
                      {p.isExact && <span className="block text-[10px] text-[#1a5c38] font-bold mb-0.5">🎯 EXACT</span>}
                      <span className={`heading text-lg font-extrabold ${p.points > 0 ? 'text-[#1a5c38]' : 'text-[#ccc]'}`}>
                        {p.points} pt
                      </span>
                    </div>
                  )}
                </div>
                {breakdown && (
                  <div className="flex flex-wrap gap-1 pl-11 mt-1.5">
                    {breakdown.toto > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#eaf4ef] text-[#1a5c38] font-semibold">Toto +{breakdown.toto}</span>
                    )}
                    {breakdown.ft_home + breakdown.ft_away + breakdown.ft_exact_bonus > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#eaf4ef] text-[#1a5c38] font-semibold">Eindstand +{breakdown.ft_home + breakdown.ft_away + breakdown.ft_exact_bonus}</span>
                    )}
                    {breakdown.ht_home + breakdown.ht_away + breakdown.ht_exact_bonus > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#eaf4ef] text-[#1a5c38] font-semibold">Ruststand +{breakdown.ht_home + breakdown.ht_away + breakdown.ht_exact_bonus}</span>
                    )}
                    {breakdown.yellow_home + breakdown.yellow_away > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#eaf4ef] text-[#1a5c38] font-semibold">🟨 +{breakdown.yellow_home + breakdown.yellow_away}</span>
                    )}
                    {breakdown.red_home + breakdown.red_away > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#eaf4ef] text-[#1a5c38] font-semibold">🟥 +{breakdown.red_home + breakdown.red_away}</span>
                    )}
                    {breakdown.all_correct_bonus > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#1a5c38] text-white font-semibold">🌟 Alles goed +{breakdown.all_correct_bonus}</span>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

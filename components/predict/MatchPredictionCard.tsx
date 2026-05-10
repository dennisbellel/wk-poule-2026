'use client'
import { useState } from 'react'
import type { Match, MatchPrediction, ScoringKeys } from '@/types'
import { calculateMatchPointsBreakdown } from '@/lib/points/calculate'
import { formatDateTimeNL, formatDateShortNL, formatTimeNL, isDeadlineUrgent } from '@/lib/format'

function YellowCard() {
  return <span style={{ display: 'inline-block', width: 10, height: 13, background: '#F5A623', borderRadius: 2, flexShrink: 0 }} />
}
function RedCard() {
  return <span style={{ display: 'inline-block', width: 10, height: 13, background: '#E2231A', borderRadius: 2, flexShrink: 0 }} />
}

function ScoreInput({ value, onChange }: {
  value: number | null | undefined
  onChange: (v: number | null) => void
}) {
  return (
    <input
      type="number" min="0" max="20"
      value={value ?? ''}
      onChange={e => onChange(e.target.value === '' ? null : parseInt(e.target.value))}
      className={`input-score w-11 h-11 text-lg ${value != null ? 'border-[#1a5c38] bg-[#eaf4ef]' : ''}`}
    />
  )
}

function PredRow({ label, icon, homeVal, awayVal, pts, showResult, single }: {
  label: string
  icon?: React.ReactNode
  homeVal: React.ReactNode
  awayVal?: React.ReactNode
  pts?: number
  showResult?: boolean
  single?: boolean
}) {
  const totalPts = pts !== undefined ? pts : 0

  // Grid met symmetrische zijkolommen → score wordt echt gecentreerd binnen de kaart
  return (
    <div className="grid grid-cols-[7rem_1fr_7rem] items-center gap-2 px-3 py-2.5 border-b border-[#f6f4ef] last:border-0">
      <span className="flex items-center gap-1.5 text-xs text-[#888] min-w-0">
        {icon}{label}
      </span>
      <div className="flex items-center justify-center gap-1 text-sm">
        {single ? (
          homeVal
        ) : (
          <>
            {homeVal}
            <span className="text-xs text-[#ccc] px-0.5">–</span>
            {awayVal}
          </>
        )}
      </div>
      <div className="flex justify-end">
        {showResult && pts !== undefined && (
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${
            totalPts > 0 ? 'bg-[#eaf4ef] text-[#1a5c38]' : 'bg-red-50 text-red-600'
          }`}>
            {totalPts > 0 ? `+${totalPts} pt` : '+0 pt'}
          </span>
        )}
      </div>
    </div>
  )
}

export default function MatchPredictionCard({
  match, prediction, onSave, isGroup, scoring,
}: {
  match: Match
  prediction: Partial<MatchPrediction> | undefined
  onSave: (data: Partial<MatchPrediction>) => Promise<void>
  isGroup: boolean
  scoring: ScoringKeys
}) {
  const [v, setV] = useState<Partial<MatchPrediction>>(prediction || {})
  const [saving, setSaving] = useState(false)
  // 'saved' = net succesvol opgeslagen (toont "✓ Bijgewerkt"). Reset altijd naar false bij mount —
  // bij paginawissel zie je weer "Opslaan" zodat het duidelijk is wat de actie doet.
  const [saved, setSaved] = useState(false)
  // Snapshot van laatst-opgeslagen state om ongeslagen wijzigingen te detecteren
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState<Partial<MatchPrediction>>(prediction || {})
  // Een voorspelling bestaat al in de DB als prediction != null
  const hasExisting = prediction != null && Object.values(prediction).some(val => val !== null && val !== undefined && val !== '')

  // Detecteer of huidige state afwijkt van laatst opgeslagen state
  const hasUnsavedChanges = (() => {
    const keys: (keyof MatchPrediction)[] = ['home_ft','away_ft','home_ht','away_ht','home_yellow','away_yellow','home_red','away_red','et_predicted','pens_predicted','winner_team_id']
    return keys.some(k => {
      const a = v[k]
      const b = lastSavedSnapshot[k]
      return (a ?? null) !== (b ?? null)
    })
  })()
  const set = (k: keyof MatchPrediction, val: unknown) => setV(p => ({ ...p, [k]: val }))

  const isPast = new Date(match.prediction_deadline_at) < new Date()
  const isFinished = match.status === 'finished'
  const isLocked = !isFinished && isPast
  const isLive = match.status === 'live'
  const isOpen = !isFinished && !isPast

  const homeLabel = match.home_team?.name_nl ?? match.home_team_placeholder ?? '?'
  const awayLabel = match.away_team?.name_nl ?? match.away_team_placeholder ?? '?'
  const homeFlag = match.home_team?.flag ?? '🏳️'
  const awayFlag = match.away_team?.flag ?? '🏳️'

  // Breakdown gebruikt scoring config — komt overeen met server-berekening
  const breakdown = calculateMatchPointsBreakdown(match, v, scoring)

  async function handleSave() {
    setSaving(true)
    try {
      await onSave(v)
      setSaved(true)
      setLastSavedSnapshot({ ...v })
      // Reset terug naar "Opslaan" na 2s — duidelijker bij volgende wijziging
      setTimeout(() => setSaved(false), 2000)
    } catch {
      // Fout-feedback wordt door de parent (toast) getoond
    } finally {
      setSaving(false)
    }
  }

  const deadlineFormatted = formatDateTimeNL(match.prediction_deadline_at)
  const isUrgent = isDeadlineUrgent(match.prediction_deadline_at)

  return (
    <div className={`card overflow-hidden ${(hasExisting || saved) && !isFinished ? 'border-[#1a5c38]' : ''}`}>
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-[#f6f4ef] flex justify-between items-center flex-wrap gap-2 bg-white">
        <div className="flex gap-2 items-center">
          <span className="tag bg-[#f0ede6] text-[#999]">Gr.{match.group_id}</span>
          <span className="text-[11px] text-[#aaa]">
            {formatDateShortNL(match.scheduled_at)} · {formatTimeNL(match.scheduled_at)}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {isOpen && (
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
              isUrgent ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
            }`}>
              ⏰ {deadlineFormatted}
            </span>
          )}
          {isLocked && <span className="tag bg-[#f0ede6] text-[#999]">🔒 Vergrendeld</span>}
          {isLive && <span className="tag bg-red-50 text-red-600">● Live</span>}
          {isFinished && <span className="tag bg-[#eaf4ef] text-[#1a5c38]">Gespeeld</span>}
        </div>
      </div>

      {/* Teams + uitslag */}
      <div className="px-3 py-3 border-b border-[#f6f4ef]">
        {isFinished ? (
          <>
            <div className="flex items-center gap-2 mb-2">
              <span className="flex-1 text-sm font-semibold">{homeFlag} {homeLabel}</span>
              <div className="text-center px-3 py-1 bg-[#f6f4ef] rounded-lg">
                <span className="heading text-lg font-extrabold text-[#1a1a1a]">
                  {match.home_ft} – {match.away_ft}
                </span>
              </div>
              <span className="flex-1 text-sm font-semibold text-right">{awayLabel} {awayFlag}</span>
            </div>
            {/* Kaarten + ruststand op één regel: kaarten links/rechts, ruststand centraal */}
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-1.5 text-[11px] text-[#aaa] flex-1">
                {Array.from({ length: Math.min(match.home_yellow ?? 0, 5) }).map((_, i) => <YellowCard key={i} />)}
                {(match.home_yellow ?? 0) > 0 && <span>{match.home_yellow}</span>}
                {(match.home_red ?? 0) > 0 && (
                  <><RedCard /><span>{match.home_red}</span></>
                )}
              </div>
              <div className="text-[11px] text-[#aaa] text-center flex-shrink-0">
                rust {match.home_ht}–{match.away_ht}
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-[#aaa] flex-1 justify-end">
                {(match.away_red ?? 0) > 0 && (
                  <><span>{match.away_red}</span><RedCard /></>
                )}
                {(match.away_yellow ?? 0) > 0 && <span>{match.away_yellow}</span>}
                {Array.from({ length: Math.min(match.away_yellow ?? 0, 5) }).map((_, i) => <YellowCard key={i} />)}
              </div>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2">
            <span className="flex-1 text-sm font-semibold">{homeFlag} {homeLabel}</span>
            <span className="text-xs text-[#ccc] px-2">vs</span>
            <span className="flex-1 text-sm font-semibold text-right">{awayLabel} {awayFlag}</span>
          </div>
        )}
      </div>

      {/* Voorspelling sectie */}
      {isFinished && hasExisting && (
        <div>
          <div className="px-3 pt-2.5 pb-0 text-center">
            <p className="text-[11px] font-semibold text-[#aaa] uppercase tracking-wide">Jouw voorspelling</p>
          </div>
          <PredRow
            label={breakdown.ft_exact_bonus > 0 ? 'Eindstand (exact!)' : 'Eindstand'}
            homeVal={v.home_ft ?? null} awayVal={v.away_ft ?? null}
            showResult pts={breakdown.ft_home + breakdown.ft_away + breakdown.ft_exact_bonus}
          />
          <PredRow
            label={breakdown.ht_exact_bonus > 0 ? 'Ruststand (exact!)' : 'Ruststand'}
            homeVal={v.home_ht ?? null} awayVal={v.away_ht ?? null}
            showResult pts={breakdown.ht_home + breakdown.ht_away + breakdown.ht_exact_bonus}
          />
          <PredRow
            label="Geel"
            icon={<YellowCard />}
            homeVal={v.home_yellow ?? null} awayVal={v.away_yellow ?? null}
            showResult pts={breakdown.yellow_home + breakdown.yellow_away}
          />
          <PredRow
            label="Rood"
            icon={<RedCard />}
            homeVal={v.home_red ?? null} awayVal={v.away_red ?? null}
            showResult pts={breakdown.red_home + breakdown.red_away}
          />
          {!isGroup && (breakdown.et > 0 || breakdown.pens > 0 || breakdown.winner > 0 || v.et_predicted != null) && (
            <>
              {v.et_predicted != null && (
                <PredRow label="Verlenging" homeVal={v.et_predicted ? 'Ja' : 'Nee'} single showResult pts={breakdown.et} />
              )}
              {v.pens_predicted != null && (
                <PredRow label="Strafschoppen" homeVal={v.pens_predicted ? 'Ja' : 'Nee'} single showResult pts={breakdown.pens} />
              )}
              {v.winner_team_id && (
                <PredRow label="Winnaar" homeVal={v.winner_team_id === match.home_team_id ? homeLabel : awayLabel} single showResult pts={breakdown.winner} />
              )}
            </>
          )}
          {/* Totaal — witte achtergrond, vetgedrukt voor leesbaarheid */}
          <div className="flex justify-between items-center px-3 py-3 bg-white border-t border-[#f6f4ef]">
            <span className="text-sm font-bold text-gray-900">Totaal deze wedstrijd</span>
            <span className="text-base font-extrabold text-[#1a5c38]">{breakdown.total} pt</span>
          </div>
        </div>
      )}

      {/* Vergrendeld of gespeeld zonder voorspelling */}
      {(isLocked || isFinished) && !hasExisting && (
        <div className="px-3 py-4 text-center text-sm text-[#888]">
          Je had geen voorspelling ingevuld voor deze wedstrijd.
        </div>
      )}

      {/* Vergrendeld: toon voorspelling readonly */}
      {isLocked && hasExisting && (
        <div>
          <div className="px-3 pt-2.5 pb-0 text-center">
            <p className="text-[11px] font-semibold text-[#aaa] uppercase tracking-wide">Jouw voorspelling</p>
          </div>
          <PredRow label="Eindstand" homeVal={v.home_ft ?? '–'} awayVal={v.away_ft ?? '–'} />
          <PredRow label="Ruststand" homeVal={v.home_ht ?? '–'} awayVal={v.away_ht ?? '–'} />
          <PredRow label="Geel" icon={<YellowCard />} homeVal={v.home_yellow ?? '–'} awayVal={v.away_yellow ?? '–'} />
          <PredRow label="Rood" icon={<RedCard />} homeVal={v.home_red ?? '–'} awayVal={v.away_red ?? '–'} />
          <div className="px-3 py-2 text-[11px] text-[#aaa]">Uitslag volgt zodra de wedstrijd klaar is</div>
        </div>
      )}

      {/* Open: invulformulier */}
      {isOpen && (
        <div className="bg-white">
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[#f6f4ef]">
            <span className="text-xs text-[#888] w-28 flex-shrink-0">Eindstand</span>
            <div className="flex items-center gap-1 flex-1 justify-center">
              <ScoreInput value={v.home_ft} onChange={val => set('home_ft', val)} />
              <span className="text-xs text-[#ccc] px-0.5">–</span>
              <ScoreInput value={v.away_ft} onChange={val => set('away_ft', val)} />
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[#f6f4ef]">
            <span className="text-xs text-[#888] w-28 flex-shrink-0">Ruststand</span>
            <div className="flex items-center gap-1 flex-1 justify-center">
              <ScoreInput value={v.home_ht} onChange={val => set('home_ht', val)} />
              <span className="text-xs text-[#ccc] px-0.5">–</span>
              <ScoreInput value={v.away_ht} onChange={val => set('away_ht', val)} />
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[#f6f4ef]">
            <span className="flex items-center gap-1.5 text-xs text-[#888] w-28 flex-shrink-0"><YellowCard />Geel</span>
            <div className="flex items-center gap-1 flex-1 justify-center">
              <ScoreInput value={v.home_yellow} onChange={val => set('home_yellow', val)} />
              <span className="text-xs text-[#ccc] px-0.5">–</span>
              <ScoreInput value={v.away_yellow} onChange={val => set('away_yellow', val)} />
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[#f6f4ef]">
            <span className="flex items-center gap-1.5 text-xs text-[#888] w-28 flex-shrink-0"><RedCard />Rood</span>
            <div className="flex items-center gap-1 flex-1 justify-center">
              <ScoreInput value={v.home_red} onChange={val => set('home_red', val)} />
              <span className="text-xs text-[#ccc] px-0.5">–</span>
              <ScoreInput value={v.away_red} onChange={val => set('away_red', val)} />
            </div>
          </div>

          {/* Knockout extras */}
          {!isGroup && (
            <div className="px-3 py-2.5 border-b border-[#f6f4ef] space-y-2">
              {[['Verlenging?', 'et_predicted'], ['Strafschoppen?', 'pens_predicted']].map(([lbl, key]) => (
                <div key={key} className="flex items-center gap-2">
                  <span className="text-xs text-[#888] w-28 flex-shrink-0">{lbl}</span>
                  <div className="flex gap-2">
                    {[['Ja', true], ['Nee', false]].map(([l, val]) => (
                      <button key={String(l)} onClick={() => set(key as keyof MatchPrediction, val)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border-0 cursor-pointer transition-colors ${
                          v[key as keyof MatchPrediction] === val ? 'bg-[#eaf4ef] text-[#1a5c38]' : 'bg-white text-[#aaa]'
                        }`}>{l}</button>
                    ))}
                  </div>
                </div>
              ))}
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#888] w-28 flex-shrink-0">Wie wint?</span>
                <div className="flex gap-2 flex-1">
                  {[{ id: match.home_team_id, label: `${homeFlag} ${homeLabel}` }, { id: match.away_team_id, label: `${awayFlag} ${awayLabel}` }].map(opt => (
                    <button key={opt.id} onClick={() => set('winner_team_id', opt.id)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border-0 cursor-pointer transition-colors ${
                        v.winner_team_id === opt.id ? 'bg-[#eaf4ef] text-[#1a5c38]' : 'bg-white text-gray-700'
                      }`}>{opt.label}</button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="px-3 py-2.5">
            <button onClick={handleSave} disabled={saving || (!hasUnsavedChanges && !saved)}
              className={`w-full py-2.5 text-sm font-semibold rounded-xl border-0 cursor-pointer transition-colors disabled:opacity-50 ${
                saved
                  ? 'bg-green-500 text-white'
                  : hasUnsavedChanges
                    ? 'bg-[#1a5c38] text-white hover:bg-[#154a2d]'
                    : 'bg-[#e5e1d8] text-[#888] cursor-not-allowed'
              }`}>
              {saving
                ? 'Opslaan...'
                : saved
                  ? '✓ Bijgewerkt'
                  : hasUnsavedChanges
                    ? (hasExisting ? '● Wijzigingen opslaan' : 'Opslaan')
                    : (hasExisting ? '✓ Opgeslagen' : 'Opslaan')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

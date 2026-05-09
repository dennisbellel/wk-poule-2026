'use client'
import { useState } from 'react'
import type { Match, MatchPrediction } from '@/types'

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

function PredRow({ label, icon, homeVal, awayVal, homeActual, awayActual, pts, showResult }: {
  label: string
  icon?: React.ReactNode
  homeVal: React.ReactNode
  awayVal: React.ReactNode
  homeActual?: number | null
  awayActual?: number | null
  pts?: number
  showResult?: boolean
}) {
  const homeCorrect = homeActual !== undefined && homeActual !== null && typeof homeVal === 'number' ? homeVal === homeActual : null
  const awayCorrect = awayActual !== undefined && awayActual !== null && typeof awayVal === 'number' ? awayVal === awayActual : null
  const totalPts = pts !== undefined ? pts : 0

  return (
    <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[#f6f4ef] last:border-0">
      <span className="flex items-center gap-1.5 text-xs text-[#888] w-28 flex-shrink-0">
        {icon}{label}
      </span>
      <div className="flex items-center gap-1 flex-1 justify-center">
        {homeVal}
        <span className="text-xs text-[#ccc] px-0.5">–</span>
        {awayVal}
      </div>
      {showResult && pts !== undefined && (
        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${
          totalPts > 0 ? 'bg-[#eaf4ef] text-[#1a5c38]' : 'bg-red-50 text-red-600'
        }`}>
          {totalPts > 0 ? `+${totalPts} pt` : '+0 pt'}
        </span>
      )}
    </div>
  )
}

export default function MatchPredictionCard({
  match, prediction, onSave, isGroup,
}: {
  match: Match
  prediction: Partial<MatchPrediction> | undefined
  onSave: (data: Partial<MatchPrediction>) => Promise<void>
  isGroup: boolean
}) {
  const [v, setV] = useState<Partial<MatchPrediction>>(prediction || {})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(prediction?.home_ft !== null && prediction?.home_ft !== undefined)
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

  // Bereken punten per onderdeel voor weergave
  function calcRowPts(predH: number | null | undefined, predA: number | null | undefined, actH: number | null | undefined, actA: number | null | undefined, ptsPerTeam: number): number {
    let pts = 0
    if (predH !== null && predH !== undefined && actH !== null && actH !== undefined && predH === actH) pts += ptsPerTeam
    if (predA !== null && predA !== undefined && actA !== null && actA !== undefined && predA === actA) pts += ptsPerTeam
    return pts
  }

  async function handleSave() {
    setSaving(true)
    await onSave(v)
    setSaved(true)
    setSaving(false)
  }

  const deadlineFormatted = new Date(match.prediction_deadline_at).toLocaleString('nl-NL', {
    timeZone: 'Europe/Amsterdam',
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })

  const msDiff = new Date(match.prediction_deadline_at).getTime() - Date.now()
  const isUrgent = msDiff < 48 * 60 * 60 * 1000 && msDiff > 0

  return (
    <div className={`card overflow-hidden ${saved && !isFinished ? 'border-[#1a5c38]' : ''}`}>
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-[#f6f4ef] flex justify-between items-center flex-wrap gap-2 bg-white">
        <div className="flex gap-2 items-center">
          <span className="tag bg-[#f0ede6] text-[#999]">Gr.{match.group_id}</span>
          <span className="text-[11px] text-[#aaa]">
            {new Date(match.scheduled_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })} ·{' '}
            {new Date(match.scheduled_at).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}
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
                <div className="text-[10px] text-[#ccc]">rust {match.home_ht} – {match.away_ht}</div>
              </div>
              <span className="flex-1 text-sm font-semibold text-right">{awayLabel} {awayFlag}</span>
            </div>
            {/* Kaarten bij uitslag */}
            <div className="flex justify-between px-1">
              <div className="flex items-center gap-1.5 text-[11px] text-[#aaa]">
                {Array.from({ length: Math.min(match.home_yellow ?? 0, 5) }).map((_, i) => <YellowCard key={i} />)}
                {(match.home_yellow ?? 0) > 0 && <span>{match.home_yellow}</span>}
                {(match.home_red ?? 0) > 0 && (
                  <><RedCard /><span>{match.home_red}</span></>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-[#aaa]">
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
      {isFinished && saved && (
        <div>
          <div className="px-3 pt-2.5 pb-0">
            <p className="text-[11px] font-semibold text-[#aaa] uppercase tracking-wide">Jouw voorspelling</p>
          </div>
          <PredRow
            label="Eindstand"
            homeVal={v.home_ft ?? null} awayVal={v.away_ft ?? null}
            showResult pts={calcRowPts(v.home_ft, v.away_ft, match.home_ft, match.away_ft, 3)}
          />
          <PredRow
            label="Ruststand"
            homeVal={v.home_ht ?? null} awayVal={v.away_ht ?? null}
            showResult pts={calcRowPts(v.home_ht, v.away_ht, match.home_ht, match.away_ht, 1)}
          />
          <PredRow
            label="Geel"
            icon={<YellowCard />}
            homeVal={v.home_yellow ?? null} awayVal={v.away_yellow ?? null}
            showResult pts={calcRowPts(v.home_yellow, v.away_yellow, match.home_yellow, match.away_yellow, 1)}
          />
          <PredRow
            label="Rood"
            icon={<RedCard />}
            homeVal={v.home_red ?? null} awayVal={v.away_red ?? null}
            showResult pts={calcRowPts(v.home_red, v.away_red, match.home_red, match.away_red, 1)}
          />
          {/* Totaal */}
          <div className="flex justify-between items-center px-3 py-2.5 bg-[#f6f4ef]">
            <span className="text-xs text-[#888]">Totaal deze wedstrijd</span>
            <span className="text-base font-bold text-[#1a5c38]">{
              calcRowPts(v.home_ft, v.away_ft, match.home_ft, match.away_ft, 3) +
              calcRowPts(v.home_ht, v.away_ht, match.home_ht, match.away_ht, 1) +
              calcRowPts(v.home_yellow, v.away_yellow, match.home_yellow, match.away_yellow, 1) +
              calcRowPts(v.home_red, v.away_red, match.home_red, match.away_red, 1)
            } pt</span>
          </div>
        </div>
      )}

      {/* Vergrendeld: toon voorspelling readonly */}
      {isLocked && saved && (
        <div>
          <div className="px-3 pt-2.5 pb-0">
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
            <button onClick={handleSave} disabled={saving}
              className="btn-primary w-full py-2.5 text-sm disabled:opacity-50">
              {saving ? 'Opslaan...' : saved ? '✓ Bijgewerkt' : 'Opslaan'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

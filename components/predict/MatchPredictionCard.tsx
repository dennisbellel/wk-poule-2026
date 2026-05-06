'use client'
import { useState } from 'react'
import type { Match, MatchPrediction } from '@/types'

function ScoreInput({ value, onChange, size = 'md' }: {
  value: number | null | undefined
  onChange: (v: number | null) => void
  size?: 'sm' | 'md'
}) {
  const dim = size === 'sm' ? 'w-9 h-9 text-base' : 'w-11 h-11 text-lg'
  return (
    <input
      type="number" min="0" max="20"
      value={value ?? ''}
      onChange={e => onChange(e.target.value === '' ? null : parseInt(e.target.value))}
      placeholder="–"
      className={`input-score ${dim} ${value != null ? 'border-[#1a5c38] bg-[#eaf4ef]' : ''}`}
    />
  )
}

function DeadlinePill({ deadline }: { deadline: string }) {
  const d = new Date(deadline)
  const now = new Date()
  const msDiff = d.getTime() - now.getTime()
  const urgent = msDiff < 48 * 60 * 60 * 1000

  const formatted = d.toLocaleString('nl-NL', {
    timeZone: 'Europe/Amsterdam',
    day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit',
  })

  const hoursLeft = Math.floor(msDiff / (1000 * 60 * 60))
  const minutesLeft = Math.floor((msDiff % (1000 * 60 * 60)) / (1000 * 60))
  const timeLeft = hoursLeft > 0 ? `${hoursLeft}u` : `${minutesLeft}m`

  return (
    <div className={`flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full ${
      urgent ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
    }`}>
      <span>⏰</span>
      <span>Sluit {formatted}</span>
      {urgent && <span className="opacity-60">({timeLeft})</span>}
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
  const [saved, setSaved] = useState(!!prediction?.home_ft !== undefined && prediction?.home_ft !== null)
  const set = (k: keyof MatchPrediction, val: unknown) => setV(p => ({ ...p, [k]: val }))

  const isPast = new Date(match.prediction_deadline_at) < new Date()
  const isFinished = match.status === 'finished'
  const isLocked = match.status === 'scheduled' && !match.home_team_id && !match.away_team_id

  const homeLabel = match.home_team?.name_nl ?? match.home_team_placeholder ?? '?'
  const awayLabel = match.away_team?.name_nl ?? match.away_team_placeholder ?? '?'
  const homeFlag = match.home_team?.flag ?? '🏳️'
  const awayFlag = match.away_team?.flag ?? '🏳️'

  async function handleSave() {
    setSaving(true)
    await onSave(v)
    setSaved(true)
    setSaving(false)
  }

  return (
    <div className={`card ${saved ? 'border-[#1a5c38]' : ''} ${isLocked ? 'opacity-50' : ''}`}>
      {/* Header */}
      <div className={`px-4 py-2.5 border-b border-[#f6f4ef] flex justify-between items-center gap-2 flex-wrap ${saved ? 'bg-[#eaf4ef]' : 'bg-white'}`}>
        <div className="flex gap-2 items-center">
          <span className="tag bg-[#f0ede6] text-[#999]">Gr.{match.group_id}</span>
          <span className="text-[11px] text-[#aaa]">
            {new Date(match.scheduled_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })} ·{' '}
            {new Date(match.scheduled_at).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Deadline pill — alleen als nog niet gespeeld en deadline nog niet verstreken */}
          {!isFinished && !isPast && !isLocked && (
            <DeadlinePill deadline={match.prediction_deadline_at} />
          )}
          {isFinished
            ? <span className="tag bg-[#eaf4ef] text-[#1a5c38]">Gespeeld</span>
            : saved
            ? <span className="tag bg-[#eaf4ef] text-[#1a5c38]">✓ Opgeslagen</span>
            : isLocked
            ? <span className="tag bg-[#f0ede6] text-[#999]">🔒 Teams onbekend</span>
            : null}
        </div>
      </div>

      <div className="p-4">
        {/* Teams row */}
        <div className="flex items-center gap-2 mb-3">
          <span className="flex-1 text-sm font-semibold">{homeFlag} {homeLabel}</span>
          {isFinished ? (
            <div className="text-center">
              <span className="heading text-xl font-extrabold text-[#1a5c38]">{match.home_ft}–{match.away_ft}</span>
              <span className="block text-[10px] text-[#ccc]">rust {match.home_ht}–{match.away_ht}</span>
            </div>
          ) : (
            <span className="text-xs text-[#ccc] px-2">vs</span>
          )}
          <span className="flex-1 text-sm font-semibold text-right">{awayLabel} {awayFlag}</span>
        </div>

        {/* Finished: show my prediction result */}
        {isFinished && saved && (
          <div className="bg-[#eaf4ef] rounded-lg px-3 py-2">
            <span className="text-xs font-semibold text-[#1a5c38]">
              ✓ Jouw voorspelling: {v.home_ft ?? '–'}–{v.away_ft ?? '–'} (rust {v.home_ht ?? '–'}–{v.away_ht ?? '–'})
            </span>
          </div>
        )}

        {/* Prediction form */}
        {!isFinished && !isLocked && !isPast && (
          <div className="bg-[#f6f4ef] rounded-xl p-3 space-y-2.5">
            {[
              { label: 'Eindstand', hk: 'home_ft' as const, ak: 'away_ft' as const, size: 'md' as const },
              { label: 'Ruststand', hk: 'home_ht' as const, ak: 'away_ht' as const, size: 'sm' as const },
            ].map(row => (
              <div key={row.label} className="flex items-center">
                <span className="text-[11px] text-[#aaa] w-14 flex-shrink-0">{row.label}</span>
                <div className="flex items-center gap-0 flex-1 justify-center">
                  <ScoreInput value={v[row.hk] as number | null} onChange={val => set(row.hk, val)} size={row.size} />
                  <span className="text-sm font-semibold text-[#ddd] w-5 text-center">–</span>
                  <ScoreInput value={v[row.ak] as number | null} onChange={val => set(row.ak, val)} size={row.size} />
                </div>
              </div>
            ))}

            <div className="h-px bg-[#e5e1d8]" />

            <div className="grid grid-cols-2 gap-2">
              {[
                { label: '🟨 Gele kaarten', hk: 'home_yellow' as const, ak: 'away_yellow' as const },
                { label: '🟥 Rode kaarten', hk: 'home_red' as const, ak: 'away_red' as const },
              ].map(row => (
                <div key={row.label} className="bg-white rounded-lg p-2.5">
                  <p className="text-[11px] font-semibold text-[#888] mb-2">{row.label}</p>
                  <div className="flex items-center gap-1.5">
                    <ScoreInput value={v[row.hk] as number | null} onChange={val => set(row.hk, val)} size="sm" />
                    <span className="text-xs text-[#ddd]">–</span>
                    <ScoreInput value={v[row.ak] as number | null} onChange={val => set(row.ak, val)} size="sm" />
                  </div>
                </div>
              ))}
            </div>

            {!isGroup && (
              <>
                <div className="h-px bg-[#e5e1d8]" />
                <div className="grid grid-cols-2 gap-2">
                  {[['Verlenging?', 'et_predicted'], ['Strafschoppen?', 'pens_predicted']].map(([lbl, key]) => (
                    <div key={key} className="bg-white rounded-lg p-2.5">
                      <p className="text-[11px] font-semibold text-[#888] mb-2">{lbl}</p>
                      <div className="flex gap-1.5">
                        {[['Ja', true], ['Nee', false]].map(([l, val]) => (
                          <button key={String(l)} onClick={() => set(key as keyof MatchPrediction, val)}
                            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border-0 cursor-pointer transition-colors ${
                              v[key as keyof MatchPrediction] === val ? 'bg-[#eaf4ef] text-[#1a5c38]' : 'bg-[#f6f4ef] text-[#aaa]'
                            }`}>{l}</button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-[#888] mb-2">Wie wint?</p>
                  <div className="flex gap-2">
                    {[{ id: match.home_team_id, label: `${homeFlag} ${homeLabel}` }, { id: match.away_team_id, label: `${awayFlag} ${awayLabel}` }].map(opt => (
                      <button key={opt.id} onClick={() => set('winner_team_id', opt.id)}
                        className={`flex-1 py-2.5 rounded-xl text-xs font-semibold border-0 cursor-pointer transition-colors ${
                          v.winner_team_id === opt.id ? 'bg-[#eaf4ef] text-[#1a5c38]' : 'bg-white text-gray-700'
                        }`}>{opt.label}</button>
                    ))}
                  </div>
                </div>
              </>
            )}

            <button onClick={handleSave} disabled={saving}
              className="btn-primary w-full py-2.5 text-sm disabled:opacity-50">
              {saving ? 'Opslaan...' : 'Opslaan ✓'}
            </button>
          </div>
        )}

        {isPast && !isFinished && (
          <p className="text-xs text-[#aaa] text-center py-2">Deadline verstreken</p>
        )}
        {isLocked && (
          <p className="text-xs text-[#bbb] mt-2">Beschikbaar zodra beide teams vaststaan</p>
        )}
      </div>
    </div>
  )
}

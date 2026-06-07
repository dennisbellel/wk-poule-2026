'use client'
import { useState, useEffect, useRef } from 'react'
import type { BonusQuestion, Team, Player } from '@/types'

const POSITION_LABELS: Record<string, string> = {
  GK: 'Keeper', DEF: 'Verdediger', MID: 'Middenvelder', FWD: 'Aanvaller'
}

export default function BonusQuestionItem({
  question, value, teams, players, onSave,
}: {
  question: BonusQuestion
  value: string
  teams: Team[]
  players: Player[]
  onSave: (val: string) => void
}) {
  const [q, setQ] = useState('')
  const [posFilter, setPosFilter] = useState('')
  const [editing, setEditing] = useState(false)
  // Optie 4: ieders antwoord bekijken (alleen na deadline)
  const [showAll, setShowAll] = useState(false)
  const [allAnswers, setAllAnswers] = useState<{ answer: string; names: string[]; count: number }[] | null>(null)
  const [loadingAll, setLoadingAll] = useState(false)

  async function toggleAllAnswers() {
    if (showAll) { setShowAll(false); return }
    setShowAll(true)
    if (allAnswers === null) {
      setLoadingAll(true)
      try {
        const res = await fetch(`/api/bonus-answers/${question.id}`)
        const json = await res.json()
        if (res.ok && json.open) setAllAnswers(json.answers)
        else setAllAnswers([])
      } catch {
        setAllAnswers([])
      } finally {
        setLoadingAll(false)
      }
    }
  }
  // Lokale state voor text/number — onSave wordt gedebouncet
  const [localValue, setLocalValue] = useState(value)
  useEffect(() => { setLocalValue(value) }, [value])

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  function handleTypedChange(val: string) {
    setLocalValue(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      if (val !== value) onSave(val)
    }, 600)
  }
  function handleBlur() {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (localValue !== value) onSave(localValue)
  }

  const deadlinePast = new Date(question.deadline_at) < new Date()
  const hasVal = value !== ''

  // Player-vragen wachten op spelersdata (bv. landenselecties bekend op 1 juni)
  const isPlayerType = question.question_type === 'player'
  const playerPool = isPlayerType
    ? players.filter(p => !question.team_filter || p.team_id === question.team_filter)
    : []
  const waitingForPlayers = isPlayerType && playerPool.length === 0

  // Gefilterde spelers: als de vraag een team_filter heeft, alleen spelers van dat team tonen
  const filteredPlayers = players
    .filter(p => !question.team_filter || p.team_id === question.team_filter)
    .filter(p => !posFilter || p.position === posFilter)
    .filter(p =>
      !q ||
      p.name.toLowerCase().includes(q.toLowerCase()) ||
      p.team?.name_nl?.toLowerCase().includes(q.toLowerCase())
    )
    .map(p => ({
      label: p.name,
      sub: question.team_filter
        ? (POSITION_LABELS[p.position] || p.position)  // bij 1 team: alleen positie tonen
        : `${p.team?.name_nl} · ${POSITION_LABELS[p.position] || p.position}`,
      val: `${p.name} (${p.team?.name_nl})`,
    }))

  const filteredTeams = teams
    .filter(t => !q || t.name_nl.toLowerCase().includes(q.toLowerCase()))
    .map(t => ({
      label: `${t.flag} ${t.name_nl}`,
      sub: `Groep ${t.group_id}`,
      val: t.name_nl,
    }))

  const opts = question.question_type === 'player' ? filteredPlayers
    : question.question_type === 'team' ? filteredTeams
    : []

  return (
    <div id={`bonus-${question.id}`} className={`card p-4 scroll-mt-24 ${hasVal ? 'border-[#1a5c38]' : ''}`}>
      {/* Header */}
      <div className="flex gap-3 items-start mb-3">
        <span className="text-lg flex-shrink-0">{question.icon}</span>
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-900">{question.question_nl}</p>
          <p className="text-[11px] text-[#aaa] mt-0.5">
            {question.points_value} punten ·{' '}
            {question.question_type === 'yes_no' ? 'ja / nee'
              : question.question_type === 'team' ? 'land'
              : question.question_type === 'player'
                ? question.team_filter
                  ? `speler ${teams.find(t => t.id === question.team_filter)?.name_nl ?? ''}`
                  : 'speler'
              : question.question_type === 'number' ? 'getal'
              : 'open'}
          </p>
        </div>
        {hasVal && <span className="tag bg-[#1a5c38] text-white flex-shrink-0">✓ Ingevuld</span>}
      </div>

      {/* Wachten op spelersdata (alleen player-type vragen) */}
      {waitingForPlayers ? (
        <div className="bg-[#f6f4ef] rounded-lg px-3 py-2.5 text-sm text-[#888] flex items-center gap-2">
          <span>🕐</span>
          <span>Wachten op definitieve selecties — beschikbaar vanaf 1 juni</span>
        </div>

      /* Deadline verstreken */
      ) : deadlinePast ? (
        <div className="bg-[#f6f4ef] rounded-lg px-3 py-2 text-sm text-[#888]">
          {value || 'Niet ingevuld'} · <span className="text-[11px]">Deadline verstreken</span>
        </div>

      /* ── JA / NEE ─────────────────────────────── */
      ) : question.question_type === 'yes_no' ? (
        <div className="flex gap-3">
          {['Ja', 'Nee'].map(opt => (
            <button
              key={opt}
              onClick={() => onSave(opt)}
              className={`flex-1 py-3 rounded-xl text-sm font-bold border-2 transition-all cursor-pointer ${
                value === opt
                  ? opt === 'Ja'
                    ? 'border-[#1a5c38] bg-[#eaf4ef] text-[#1a5c38]'
                    : 'border-red-400 bg-red-50 text-red-600'
                  : 'border-[#e5e1d8] bg-white text-gray-500 hover:border-[#c8c4bc]'
              }`}
            >
              {opt === 'Ja' ? '✅ Ja' : '❌ Nee'}
            </button>
          ))}
        </div>

      /* ── GETAL ────────────────────────────────── */
      ) : question.question_type === 'number' ? (
        <input
          type="number" min="0" max="999"
          value={localValue}
          onChange={e => handleTypedChange(e.target.value)}
          onBlur={handleBlur}
          placeholder="Vul een getal in"
          className="w-full border border-[#e5e1d8] rounded-xl px-4 py-2.5 text-sm font-bold
                     bg-[#f6f4ef] outline-none focus:border-[#1a5c38]"
          style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}
        />

      /* ── VRIJE TEKST ──────────────────────────── */
      ) : question.question_type === 'text' ? (
        <input
          type="text"
          value={localValue}
          onChange={e => handleTypedChange(e.target.value)}
          onBlur={handleBlur}
          placeholder="Typ je antwoord..."
          className="w-full border border-[#e5e1d8] rounded-xl px-4 py-2.5 text-sm
                     bg-[#f6f4ef] outline-none focus:border-[#1a5c38]"
        />

      /* ── TEAM / SPELER: al gekozen → toon prominent met wijzig-optie ─────── */
      ) : value && !editing ? (
        <div className="flex items-center justify-between gap-2 bg-[#eaf4ef] border border-[#c8e6d4] rounded-xl px-4 py-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[#1a5c38] flex-shrink-0">✓</span>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wide text-[#1a5c38]/60 font-semibold">Jouw keuze</p>
              <p className="text-sm font-bold text-[#1a5c38] truncate">{value}</p>
            </div>
          </div>
          <button
            onClick={() => { setEditing(true); setQ('') }}
            className="text-xs font-semibold text-[#1a5c38] underline flex-shrink-0 cursor-pointer border-0 bg-transparent"
          >
            Wijzig
          </button>
        </div>

      /* ── TEAM / SPELER ZOEKEN ─────────────────── */
      ) : (
        <div>
          <input
            placeholder={
              question.question_type === 'player'
                ? question.team_filter
                  ? `Zoek speler ${teams.find(t => t.id === question.team_filter)?.name_nl ?? ''}...`
                  : 'Zoek speler...'
                : 'Zoek land...'
            }
            value={q}
            onChange={e => setQ(e.target.value)}
            className="w-full border border-[#e5e1d8] rounded-xl px-4 py-2.5 text-sm
                       bg-[#f6f4ef] outline-none focus:border-[#1a5c38] mb-2"
          />

          {/* Positiefilter (alleen bij spelers) */}
          {question.question_type === 'player' && (
            <div className="flex gap-1.5 mb-2 flex-wrap">
              {(['', 'FWD', 'MID', 'DEF', 'GK'] as const).map(pos => (
                <button
                  key={pos}
                  onClick={() => setPosFilter(pos)}
                  className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border-0 cursor-pointer transition-colors ${
                    posFilter === pos ? 'bg-[#eaf4ef] text-[#1a5c38]' : 'bg-[#f6f4ef] text-[#aaa]'
                  }`}
                >
                  {pos ? POSITION_LABELS[pos] : 'Alle'}
                </button>
              ))}
            </div>
          )}

          {/* Resultatenlijst — geen harde limiet, container scrollt */}
          <div className="flex flex-col gap-1 max-h-72 overflow-y-auto">
            {opts.map(opt => (
              <button
                key={opt.val}
                onClick={() => { onSave(opt.val); setQ(''); setEditing(false) }}
                className={`flex justify-between items-center px-3 py-2.5 rounded-xl text-sm
                            cursor-pointer border-0 text-left transition-colors ${
                  value === opt.val
                    ? 'bg-[#eaf4ef] text-[#1a5c38] font-semibold'
                    : 'bg-white hover:bg-[#f6f4ef] text-gray-900'
                }`}
              >
                <span>{opt.label}</span>
                <span className="text-[11px] text-[#aaa] ml-2 flex-shrink-0">{opt.sub}</span>
              </button>
            ))}
            {opts.length === 0 && q && (
              <p className="text-sm text-[#aaa] text-center py-3">Geen resultaten voor "{q}"</p>
            )}
            {opts.length === 0 && !q && question.question_type === 'player' && (
              <p className="text-sm text-[#aaa] text-center py-3">Nog geen spelers beschikbaar</p>
            )}
          </div>
        </div>
      )}

      {/* Optie 4: ieders antwoord — alleen na de deadline */}
      {deadlinePast && (
        <div className="mt-3 pt-3 border-t border-[#f6f4ef]">
          <button
            onClick={toggleAllAnswers}
            className="text-xs font-semibold text-[#1a5c38] cursor-pointer border-0 bg-transparent"
          >
            {showAll ? '▾ Verberg ieders antwoord' : '👀 Bekijk ieders antwoord'}
          </button>

          {showAll && (
            <div className="mt-2 space-y-1.5">
              {loadingAll ? (
                <p className="text-xs text-[#aaa]">Laden...</p>
              ) : !allAnswers || allAnswers.length === 0 ? (
                <p className="text-xs text-[#aaa]">Nog geen antwoorden.</p>
              ) : (
                allAnswers.map(a => {
                  const isCorrect = question.correct_answer && allAnswers
                    ? question.correct_answer.split(',').map(s => s.trim().toLowerCase()).some(c => a.answer.toLowerCase().startsWith(c))
                    : false
                  return (
                    <div key={a.answer} className={`rounded-lg px-3 py-2 ${isCorrect ? 'bg-[#eaf4ef]' : 'bg-[#f6f4ef]'}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-sm font-semibold ${isCorrect ? 'text-[#1a5c38]' : 'text-gray-800'}`}>
                          {isCorrect && '✓ '}{a.answer}
                        </span>
                        <span className="text-[11px] text-[#aaa] flex-shrink-0">{a.count}×</span>
                      </div>
                      <p className="text-[11px] text-[#888] mt-0.5">{a.names.join(', ')}</p>
                    </div>
                  )
                })
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

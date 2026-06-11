'use client'
import { useState, useEffect } from 'react'
import type { Match, MatchPrediction, GroupStandingPrediction, BonusQuestion, BonusAnswer, Team, Player, ScoringKeys } from '@/types'
import { createClient } from '@/lib/supabase/client'
import MatchPredictionCard from './MatchPredictionCard'
import GroupStandingForm from './GroupStandingForm'
import BonusQuestionItem from './BonusQuestionItem'
import { formatDateLongNL } from '@/lib/format'

const GROUPS = ['A','B','C','D','E','F','G','H','I','J','K','L']
const KO_ROUNDS = [
  { id: 'r32', label: 'R32' }, { id: 'r16', label: 'R16' },
  { id: 'qf', label: 'KF' }, { id: 'sf', label: 'HF' },
  { id: 'third', label: '3e' }, { id: 'final', label: 'Finale' },
]

export default function PredictClient({
  userId, groupMatches, koMatches, matchPredictions, groupPredictions,
  teams, bonusQuestions, bonusAnswers, players, scoring, adminActAs,
}: {
  userId: string
  groupMatches: Match[]
  koMatches: Match[]
  matchPredictions: MatchPrediction[]
  groupPredictions: GroupStandingPrediction[]
  teams: Team[]
  bonusQuestions: BonusQuestion[]
  bonusAnswers: BonusAnswer[]
  players: Player[]
  scoring: ScoringKeys
  // Als gezet: admin vult namens deze user in. Saves via /api/admin/proxy-save.
  adminActAs?: { userId: string; displayName: string }
}) {
  const supabase = createClient()

  // Vier hoofd-tabs: Groepsfase / Knockout / Toernooi / Bonusvragen (= live)
  const [mainTab, setMainTab] = useState<'group' | 'knockout' | 'tournament' | 'live'>('group')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Sub-tabs binnen groepsfase: 0=wedstrijden, 1=poulestand, 2=bonusvragen
  const [groupTab, setGroupTab] = useState(0)
  const [koRound, setKoRound] = useState('r32')
  const [activeGroup, setActiveGroup] = useState('A')

  // Lees URL bij mount: zet juiste tab + sub-tab, scroll naar hash-element
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const t = params.get('tab')
    if (t === 'knockout' || t === 'tournament' || t === 'live' || t === 'group') {
      setMainTab(t)
    }
    const sub = params.get('sub')
    if (sub === 'standing') setGroupTab(1)
    else if (sub === 'bonus') setGroupTab(2)
    else if (sub === 'matches') setGroupTab(0)

    const hash = window.location.hash
    if (!hash) return
    // KO-match? Bepaal eerst welke ronde
    const matchId = hash.startsWith('#match-') ? hash.slice('#match-'.length) : null
    if (matchId) {
      const ko = koMatches.find(m => m.id === matchId)
      if (ko) setKoRound(ko.phase)
    }
    // Wacht een frame zodat de juiste tab eerst rendert, dan scroll
    const timer = setTimeout(() => {
      const el = document.getElementById(hash.slice(1))
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 150)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // De poulestand zit op slot zodra de deadline van de allereerste
  // groepswedstrijd van het toernooi verstreken is — alle poules tegelijk,
  // zelfde regel als de RLS in de database
  function isGroupLocked(): boolean {
    const now = new Date()
    return groupMatches.some(m => new Date(m.prediction_deadline_at) <= now)
  }

  const [localMatchPreds, setLocalMatchPreds] = useState<Record<string, Partial<MatchPrediction>>>(
    Object.fromEntries(matchPredictions.map(p => [p.match_id, p]))
  )
  const [localBonusAnswers, setLocalBonusAnswers] = useState<Record<string, string>>(
    Object.fromEntries(bonusAnswers.map(a => [a.question_id, a.answer]))
  )

  const [saveError, setSaveError] = useState<string | null>(null)

  async function saveMatchPrediction(matchId: string, data: Partial<MatchPrediction>) {
    const previous = localMatchPreds[matchId]
    setLocalMatchPreds(prev => ({ ...prev, [matchId]: { ...prev[matchId], ...data } }))

    let error: { message: string } | null = null
    if (adminActAs) {
      // Save via admin proxy zodat de juiste user_id wordt gebruikt
      const res = await fetch('/api/admin/proxy-save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'match',
          user_id: adminActAs.userId,
          payload: { match_id: matchId, ...data },
        }),
      })
      if (!res.ok) error = await res.json().catch(() => ({ message: 'Save failed' }))
    } else {
      const result = await supabase
        .from('match_predictions')
        .upsert({ user_id: userId, match_id: matchId, ...data }, { onConflict: 'user_id,match_id' })
      error = result.error
    }

    if (error) {
      setLocalMatchPreds(prev => ({ ...prev, [matchId]: previous }))
      setSaveError('Voorspelling niet opgeslagen — probeer opnieuw')
      setTimeout(() => setSaveError(null), 4000)
      throw error
    }
  }

  async function saveBonusAnswer(questionId: string, answer: string) {
    const previous = localBonusAnswers[questionId]
    setLocalBonusAnswers(prev => ({ ...prev, [questionId]: answer }))

    let error: { message: string } | null = null
    if (adminActAs) {
      const res = await fetch('/api/admin/proxy-save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'bonus',
          user_id: adminActAs.userId,
          payload: { question_id: questionId, answer },
        }),
      })
      if (!res.ok) error = await res.json().catch(() => ({ message: 'Save failed' }))
    } else {
      const result = await supabase
        .from('bonus_answers')
        .upsert({ user_id: userId, question_id: questionId, answer }, { onConflict: 'user_id,question_id' })
      error = result.error
    }

    if (error) {
      setLocalBonusAnswers(prev => ({ ...prev, [questionId]: previous }))
      setSaveError('Antwoord niet opgeslagen — probeer opnieuw')
      setTimeout(() => setSaveError(null), 4000)
      throw error
    }
  }

  const groupMatchesByDay = groupMatches.reduce((acc, m) => {
    const date = new Date(m.scheduled_at).toISOString().split('T')[0]
    if (!acc[date]) acc[date] = []
    acc[date].push(m)
    return acc
  }, {} as Record<string, Match[]>)

  const koMatchesInRound = koMatches.filter(m => m.phase === koRound)
  const openKoCount = koMatches.filter(m => m.status === 'scheduled' && m.home_team_id && m.away_team_id).length
  const savedKoCount = koMatches.filter(m => localMatchPreds[m.id]?.home_ft !== undefined).length

  // Bonusvragen per type — ALLE fases behalve 'group' komen in de bonus tab
  const groupQs = bonusQuestions.filter(q => q.phase === 'group')
  const overarchingQs = bonusQuestions.filter(q => q.phase !== 'group')
  const tourQs = overarchingQs.filter(q => q.phase === 'tournament')
  const liveQs = overarchingQs.filter(q => q.phase === 'live')
  const knockoutQs = overarchingQs.filter(q => q.phase === 'knockout')

  const MAIN_TABS = [
    { id: 'group', label: '⚽ Groepsfase' },
    { id: 'knockout', label: '🏆 Knockout' },
    { id: 'tournament', label: '🎯 Toernooi' },
    { id: 'live', label: '🔴 Bonusvragen' },
  ]

  return (
    <div>
      {/* Admin-banner: jij vult namens iemand anders in */}
      {adminActAs && (
        <div className="bg-amber-100 border-b-2 border-amber-300 px-4 py-2.5 lg:px-8 flex items-center justify-between gap-3 sticky top-0 z-30">
          <p className="text-sm text-amber-900">
            ⚠ Je vult voorspellingen in namens <strong>{adminActAs.displayName}</strong>
          </p>
          <a
            href={`/admin/member/${adminActAs.userId}`}
            className="text-xs font-semibold text-amber-900 underline whitespace-nowrap"
          >
            ← Terug
          </a>
        </div>
      )}

      {/* Error toast — onder mobile header / boven content */}
      {saveError && (
        <div className="fixed top-4 inset-x-4 lg:left-auto lg:right-8 lg:w-96 z-50 bg-red-50 border border-red-200 rounded-xl px-4 py-3 shadow-lg flex items-start gap-2">
          <span className="text-red-600">⚠</span>
          <p className="text-sm text-red-700 flex-1">{saveError}</p>
          <button onClick={() => setSaveError(null)} className="text-red-400 hover:text-red-600 text-sm">×</button>
        </div>
      )}

      {/* Hoofd-tabs: dropdown op mobile, tabs naast elkaar op desktop */}
      <div className="bg-[#1a5c38] px-4 lg:px-8 pt-4 lg:pt-5 pb-4 lg:pb-0">
        <h1 className="heading text-xl font-extrabold text-white mb-4 hidden lg:block">Voorspellingen</h1>

        {/* Mobile: dropdown */}
        <div className="lg:hidden relative pb-0">
          <button
            onClick={() => setMobileMenuOpen(o => !o)}
            className="w-full flex items-center justify-between bg-white px-4 py-3 rounded-t-xl border-0 cursor-pointer"
            aria-haspopup="listbox"
            aria-expanded={mobileMenuOpen}
          >
            <span className="text-sm font-bold text-[#1a5c38]">
              {MAIN_TABS.find(t => t.id === mainTab)?.label}
            </span>
            <span className={`text-[#1a5c38] transition-transform ${mobileMenuOpen ? 'rotate-180' : ''}`}>
              ▾
            </span>
          </button>
          {mobileMenuOpen && (
            <>
              {/* Backdrop om dropdown te sluiten bij tap erbuiten */}
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="fixed inset-0 z-10 bg-transparent border-0 cursor-default"
                aria-label="Sluiten"
              />
              <div role="listbox" className="absolute z-20 top-full left-0 right-0 bg-white shadow-lg border border-[#e5e1d8] border-t-0 rounded-b-xl overflow-hidden">
                {MAIN_TABS.map(t => (
                  <button
                    key={t.id}
                    role="option"
                    aria-selected={mainTab === t.id}
                    onClick={() => { setMainTab(t.id as typeof mainTab); setMobileMenuOpen(false) }}
                    className={`w-full text-left px-4 py-3 text-sm font-semibold border-b border-[#f6f4ef] last:border-0 border-l-0 border-r-0 border-t-0 cursor-pointer transition-colors ${
                      mainTab === t.id ? 'bg-[#eaf4ef] text-[#1a5c38]' : 'bg-white text-gray-700 hover:bg-[#f6f4ef]'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Desktop: tabs naast elkaar */}
        <div className="hidden lg:flex gap-1">
          {MAIN_TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setMainTab(t.id as typeof mainTab)}
              className={`px-4 pt-3 pb-2.5 rounded-t-xl border-0 cursor-pointer text-left transition-colors whitespace-nowrap ${
                mainTab === t.id ? 'bg-white' : 'bg-transparent hover:bg-white/10'
              }`}
            >
              <span className={`block text-sm font-bold ${mainTab === t.id ? 'text-[#1a5c38]' : 'text-white/80'}`}>
                {t.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── GROEPSFASE ── */}
      {mainTab === 'group' && (
        <>
          <div className="bg-white border-b border-[#e5e1d8] flex px-4 lg:px-8">
            {['⚽ Wedstrijden', '📊 Poulestand', '🎯 Bonusvragen'].map((t, i) => (
              <button
                key={i}
                onClick={() => setGroupTab(i)}
                className={`px-3 py-3 text-sm border-b-2 -mb-px transition-colors cursor-pointer border-0 bg-transparent ${
                  groupTab === i ? 'border-[#1a5c38] text-[#1a5c38] font-semibold' : 'border-transparent text-[#aaa]'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="p-4 lg:p-8">
            {groupTab === 0 && (
              <div className="space-y-4">
                {Object.entries(groupMatchesByDay).map(([date, matches]) => (
                  <div key={date}>
                    <p className="text-[11px] font-semibold text-[#aaa] uppercase tracking-wider mb-2">
                      {formatDateLongNL(date)}
                    </p>
                    <div className="space-y-2">
                      {matches.map(m => (
                        <MatchPredictionCard
                          key={m.id}
                          match={m}
                          prediction={localMatchPreds[m.id]}
                          onSave={data => saveMatchPrediction(m.id, data)}
                          isGroup
                          scoring={scoring}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {groupTab === 1 && (
              <div>
                <div className="flex gap-1.5 flex-wrap mb-4">
                  {GROUPS.map(g => {
                    const groupPredCount = groupPredictions.filter(p => p.group_id === g).length
                    const isComplete = groupPredCount === 4
                    return (
                      <button
                        key={g}
                        onClick={() => setActiveGroup(g)}
                        title={isComplete ? `Groep ${g} — compleet` : `Groep ${g} — ${groupPredCount}/4 ingevuld`}
                        className={`relative w-10 h-10 rounded-lg text-sm font-semibold border-0 cursor-pointer transition-colors ${
                          activeGroup === g ? 'bg-[#1a5c38] text-white' : 'bg-white border border-[#e5e1d8] text-[#777]'
                        }`}
                      >
                        {g}
                        {isComplete && (
                          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-green-500 text-white text-[8px] flex items-center justify-center font-bold border border-white">
                            ✓
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
                <GroupStandingForm
                  key={activeGroup}
                  groupId={activeGroup}
                  teams={teams.filter(t => t.group_id === activeGroup)}
                  predictions={groupPredictions.filter(p => p.group_id === activeGroup)}
                  userId={userId}
                  adminActAs={adminActAs}
                  locked={isGroupLocked() && !adminActAs}
                />
              </div>
            )}

            {groupTab === 2 && (
              <div className="max-w-xl mx-auto space-y-3">
                {groupQs.length === 0 ? (
                  <div className="text-center py-12 text-[#aaa]">
                    <p className="text-3xl mb-3">🎯</p>
                    <p className="text-sm">Nog geen bonusvragen voor de groepsfase.</p>
                  </div>
                ) : (
                  <>
                    <p className="text-xs text-[#aaa] mb-1">Sluiten bij start van het toernooi</p>
                    {groupQs.map(q => (
                      <BonusQuestionItem
                        key={q.id} question={q}
                        value={localBonusAnswers[q.id] || ''}
                        teams={teams} players={players}
                        onSave={val => saveBonusAnswer(q.id, val)}
                      />
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── TOERNOOI ── (overkoepelend + knockout-fase) */}
      {mainTab === 'tournament' && (
        <div className="p-4 lg:p-8 max-w-xl mx-auto space-y-6">
          {/* Heel toernooi */}
          {tourQs.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-800 mb-1">Heel toernooi</h2>
              <p className="text-xs text-[#aaa] mb-3">Jouw grote voorspellingen — sluiten bij start van het WK</p>
              <div className="space-y-3">
                {tourQs.map(q => (
                  <BonusQuestionItem
                    key={q.id} question={q}
                    value={localBonusAnswers[q.id] || ''}
                    teams={teams} players={players}
                    onSave={val => saveBonusAnswer(q.id, val)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Knockoutfase bonusvragen */}
          {knockoutQs.length > 0 && (
            <>
              {tourQs.length > 0 && <div className="h-px bg-[#e5e1d8]" />}
              <div>
                <h2 className="text-sm font-semibold text-gray-800 mb-1">Knockoutfase</h2>
                <div className="space-y-3">
                  {knockoutQs.map(q => (
                    <BonusQuestionItem
                      key={q.id} question={q}
                      value={localBonusAnswers[q.id] || ''}
                      teams={teams} players={players}
                      onSave={val => saveBonusAnswer(q.id, val)}
                    />
                  ))}
                </div>
              </div>
            </>
          )}

          {tourQs.length === 0 && knockoutQs.length === 0 && (
            <div className="text-center py-12 text-[#aaa]">
              <p className="text-3xl mb-3">🎯</p>
              <p className="text-sm">Nog geen toernooivragen beschikbaar.</p>
            </div>
          )}
        </div>
      )}

      {/* ── BONUSVRAGEN ── (live / actuele vragen) */}
      {mainTab === 'live' && (
        <div className="p-4 lg:p-8 max-w-xl mx-auto space-y-3">
          {liveQs.length > 0 ? (
            <>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-sm font-semibold text-gray-800">Bonusvragen</h2>
                <span className="tag bg-red-50 text-red-600">🔴 Live</span>
              </div>
              <p className="text-xs text-[#aaa] mb-3">Tijdelijke vragen tijdens het toernooi — let op de deadline</p>
              <div className="space-y-3">
                {liveQs.map(q => (
                  <BonusQuestionItem
                    key={q.id} question={q}
                    value={localBonusAnswers[q.id] || ''}
                    teams={teams} players={players}
                    onSave={val => saveBonusAnswer(q.id, val)}
                  />
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-[#aaa]">
              <p className="text-3xl mb-3">🔴</p>
              <p className="text-sm font-semibold text-gray-600 mb-1">Geen actieve bonusvragen</p>
              <p className="text-sm">Tijdens het toernooi kunnen hier extra vragen verschijnen.</p>
            </div>
          )}
        </div>
      )}

      {/* ── KNOCKOUT ── */}
      {mainTab === 'knockout' && (
        <>
          {openKoCount > 0 && (
            <div className="px-4 lg:px-8 py-2.5 bg-white border-b border-[#e5e1d8]">
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex gap-2 items-center text-xs text-amber-800">
                <span>⚡</span>
                <span>{openKoCount} wedstrijden beschikbaar · {savedKoCount} van {openKoCount} ingevuld · sluit bij aftrap</span>
              </div>
            </div>
          )}
          <div className="bg-white border-b border-[#e5e1d8] flex px-4 lg:px-8 overflow-x-auto">
            {KO_ROUNDS.map(r => {
              const matches = koMatches.filter(m => m.phase === r.id)
              const hasSaved = matches.some(m => localMatchPreds[m.id]?.home_ft !== undefined)
              const hasOpen = matches.some(m => m.status === 'scheduled' && m.home_team_id)
              return (
                <button
                  key={r.id}
                  onClick={() => setKoRound(r.id)}
                  className={`flex-shrink-0 flex flex-col items-center px-4 py-3 text-xs border-b-2 -mb-px cursor-pointer border-0 bg-transparent transition-colors ${
                    koRound === r.id ? 'border-[#1a5c38] text-[#1a5c38] font-semibold' : 'border-transparent text-[#aaa]'
                  }`}
                >
                  {r.label}
                  {(hasSaved || hasOpen) && (
                    <div className={`w-1.5 h-1.5 rounded-full mt-1 ${hasSaved ? 'bg-green-500' : 'bg-amber-400'}`} />
                  )}
                </button>
              )
            })}
          </div>
          <div className="p-4 lg:p-8 space-y-3 max-w-2xl">
            {koMatchesInRound.length === 0 ? (
              <div className="text-center py-12 text-[#aaa]">
                <p className="text-3xl mb-3">🔒</p>
                <p className="text-sm font-semibold text-gray-600 mb-1">Nog niet beschikbaar</p>
                <p className="text-sm">De teams staan pas vast na de vorige ronde.</p>
              </div>
            ) : (
              koMatchesInRound.map(m => (
                <MatchPredictionCard
                  key={m.id}
                  match={m}
                  prediction={localMatchPreds[m.id]}
                  onSave={data => saveMatchPrediction(m.id, data)}
                  isGroup={false}
                  scoring={scoring}
                />
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}

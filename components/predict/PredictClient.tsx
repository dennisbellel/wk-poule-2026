'use client'
import { useState } from 'react'
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
  teams, bonusQuestions, bonusAnswers, players, scoring,
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
}) {
  const supabase = createClient()

  // Drie hoofd-tabs op het bovenste niveau
  const [mainTab, setMainTab] = useState<'group' | 'bonus' | 'knockout'>('group')

  // Sub-tabs binnen groepsfase
  const [groupTab, setGroupTab] = useState(0) // 0=wedstrijden, 1=poulestand
  const [koRound, setKoRound] = useState('r32')
  const [activeGroup, setActiveGroup] = useState('A')

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

    const { error } = await supabase
      .from('match_predictions')
      .upsert({ user_id: userId, match_id: matchId, ...data }, { onConflict: 'user_id,match_id' })

    if (error) {
      // Rollback bij fout
      setLocalMatchPreds(prev => ({ ...prev, [matchId]: previous }))
      setSaveError('Voorspelling niet opgeslagen — probeer opnieuw')
      setTimeout(() => setSaveError(null), 4000)
      throw error
    }
  }

  async function saveBonusAnswer(questionId: string, answer: string) {
    const previous = localBonusAnswers[questionId]
    setLocalBonusAnswers(prev => ({ ...prev, [questionId]: answer }))

    const { error } = await supabase
      .from('bonus_answers')
      .upsert({ user_id: userId, question_id: questionId, answer }, { onConflict: 'user_id,question_id' })

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
    { id: 'bonus', label: '🎯 Bonusvragen' },
    { id: 'knockout', label: '🏆 Knockout' },
  ]

  return (
    <div>
      {/* Error toast — onder mobile header / boven content */}
      {saveError && (
        <div className="fixed top-4 inset-x-4 lg:left-auto lg:right-8 lg:w-96 z-50 bg-red-50 border border-red-200 rounded-xl px-4 py-3 shadow-lg flex items-start gap-2">
          <span className="text-red-600">⚠</span>
          <p className="text-sm text-red-700 flex-1">{saveError}</p>
          <button onClick={() => setSaveError(null)} className="text-red-400 hover:text-red-600 text-sm">×</button>
        </div>
      )}

      {/* Header met drie hoofd-tabs */}
      <div className="bg-[#1a5c38] px-4 lg:px-8 pt-4 lg:pt-5">
        <h1 className="heading text-xl font-extrabold text-white mb-4 hidden lg:block">Voorspellingen</h1>
        <div className="flex gap-1">
          {MAIN_TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setMainTab(t.id as typeof mainTab)}
              className={`flex-1 lg:flex-none px-4 pt-3 pb-2.5 rounded-t-xl border-0 cursor-pointer text-left transition-colors ${
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
            {['⚽ Wedstrijden', '📊 Poulestand'].map((t, i) => (
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
                  {GROUPS.map(g => (
                    <button
                      key={g}
                      onClick={() => setActiveGroup(g)}
                      className={`w-9 h-9 rounded-lg text-sm font-semibold border-0 cursor-pointer transition-colors ${
                        activeGroup === g ? 'bg-[#1a5c38] text-white' : 'bg-white border border-[#e5e1d8] text-[#777]'
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
                <GroupStandingForm
                  groupId={activeGroup}
                  teams={teams.filter(t => t.group_id === activeGroup)}
                  predictions={groupPredictions.filter(p => p.group_id === activeGroup)}
                  userId={userId}
                />
              </div>
            )}
          </div>
        </>
      )}

      {/* ── BONUSVRAGEN ── */}
      {mainTab === 'bonus' && (
        <div className="p-4 lg:p-8 max-w-xl space-y-6">

          {/* Groepsfase bonusvragen */}
          {groupQs.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-800 mb-1">Groepsfase</h2>
              <p className="text-xs text-[#aaa] mb-3">Sluiten bij start van het toernooi</p>
              <div className="space-y-3">
                {groupQs.map(q => (
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

          {/* Heel toernooi */}
          {tourQs.length > 0 && (
            <>
              {groupQs.length > 0 && <div className="h-px bg-[#e5e1d8]" />}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <h2 className="text-sm font-semibold text-gray-800">Heel toernooi</h2>
                  <span className="tag bg-amber-50 text-amber-700">Aanpasbaar tot 11 jun</span>
                </div>
                <p className="text-xs text-[#aaa] mb-3">Jouw grote voorspellingen</p>
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
            </>
          )}

          {/* Knockoutfase bonusvragen */}
          {knockoutQs.length > 0 && (
            <>
              <div className="h-px bg-[#e5e1d8]" />
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

          {/* Live / actuele vragen */}
          {liveQs.length > 0 && (
            <>
              <div className="h-px bg-[#e5e1d8]" />
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-sm font-semibold text-gray-800">Actueel</h2>
                  <span className="tag bg-red-50 text-red-600">🔴 Live</span>
                </div>
                <p className="text-xs text-[#aaa] mb-3">Tijdelijke vragen — let op de deadline</p>
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
              </div>
            </>
          )}

          {overarchingQs.length === 0 && groupQs.length === 0 && (
            <div className="text-center py-12 text-[#aaa]">
              <p className="text-3xl mb-3">🎯</p>
              <p className="text-sm">Nog geen bonusvragen beschikbaar.</p>
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

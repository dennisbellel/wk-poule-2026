'use client'
import { useState, useTransition } from 'react'
import type { Match, MatchPrediction, GroupStandingPrediction, BonusQuestion, BonusAnswer, Team, Player } from '@/types'
import { createClient } from '@/lib/supabase/client'
import MatchPredictionCard from './MatchPredictionCard'
import GroupStandingForm from './GroupStandingForm'
import BonusQuestionItem from './BonusQuestionItem'

const GROUPS = ['A','B','C','D','E','F','G','H','I','J','K','L']
const KO_ROUNDS = [
  { id: 'r32', label: 'R32' }, { id: 'r16', label: 'R16' },
  { id: 'qf', label: 'KF' }, { id: 'sf', label: 'HF' },
  { id: 'third', label: '3e' }, { id: 'final', label: 'Finale' },
]

export default function PredictClient({
  userId, groupMatches, koMatches, matchPredictions, groupPredictions,
  teams, bonusQuestions, bonusAnswers, players,
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
}) {
  const supabase = createClient()
  const [phase, setPhase] = useState<'group' | 'knockout'>('group')
  const [tab, setTab] = useState(0) // 0=wedstrijden, 1=poulestand, 2=bonus
  const [koRound, setKoRound] = useState('r32')
  const [activeGroup, setActiveGroup] = useState('A')
  const [isPending, startTransition] = useTransition()

  // Local state for predictions (optimistic)
  const [localMatchPreds, setLocalMatchPreds] = useState<Record<string, Partial<MatchPrediction>>>(
    Object.fromEntries(matchPredictions.map(p => [p.match_id, p]))
  )
  const [localBonusAnswers, setLocalBonusAnswers] = useState<Record<string, string>>(
    Object.fromEntries(bonusAnswers.map(a => [a.question_id, a.answer]))
  )

  // Save match prediction
  async function saveMatchPrediction(matchId: string, data: Partial<MatchPrediction>) {
    const pred = { user_id: userId, match_id: matchId, ...data }
    setLocalMatchPreds(prev => ({ ...prev, [matchId]: { ...prev[matchId], ...data } }))

    const existing = matchPredictions.find(p => p.match_id === matchId)
    if (existing) {
      await supabase.from('match_predictions').update(pred).eq('user_id', userId).eq('match_id', matchId)
    } else {
      await supabase.from('match_predictions').insert(pred)
    }
  }

  // Save bonus answer
  async function saveBonusAnswer(questionId: string, answer: string) {
    setLocalBonusAnswers(prev => ({ ...prev, [questionId]: answer }))
    const existing = bonusAnswers.find(a => a.question_id === questionId)
    const data = { user_id: userId, question_id: questionId, answer }
    if (existing) {
      await supabase.from('bonus_answers').update(data).eq('user_id', userId).eq('question_id', questionId)
    } else {
      await supabase.from('bonus_answers').insert(data)
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

  const groupQs = bonusQuestions.filter(q => q.phase === 'group')
  const tourQs = bonusQuestions.filter(q => q.phase === 'tournament')

  return (
    <div>
      {/* Phase switcher header */}
      <div className="bg-[#1a5c38] px-4 lg:px-8 pt-4 lg:pt-5">
        <h1 className="heading text-xl font-extrabold text-white mb-4 hidden lg:block">Voorspellingen</h1>
        <div className="flex gap-2">
          {[['group', '⚽ Groepsfase', 'vóór 11 juni'], ['knockout', '🏆 Knockout', 'per ronde']].map(([id, lbl, sub]) => (
            <button key={id} onClick={() => setPhase(id as 'group' | 'knockout')}
              className={`flex-1 lg:flex-none px-4 pt-3 pb-2 rounded-t-xl border-0 cursor-pointer text-left transition-colors ${
                phase === id ? 'bg-white' : 'bg-transparent hover:bg-white/10'
              }`}>
              <span className={`block text-sm font-bold ${phase === id ? 'text-[#1a5c38]' : 'text-white/80'}`}>{lbl}</span>
              <span className={`block text-[10px] ${phase === id ? 'text-[#1a5c38]/60' : 'text-white/50'}`}>{sub}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── GROUP PHASE ── */}
      {phase === 'group' && (
        <>
          <div className="bg-white border-b border-[#e5e1d8] flex px-4 lg:px-8">
            {['⚽ Wedstrijden', '📊 Poulestand', '🎯 Bonusvragen'].map((t, i) => (
              <button key={i} onClick={() => setTab(i)}
                className={`px-3 py-3 text-sm border-b-2 -mb-px transition-colors cursor-pointer border-0 bg-transparent ${
                  tab === i ? 'border-[#1a5c38] text-[#1a5c38] font-semibold' : 'border-transparent text-[#aaa]'
                }`}>{t}</button>
            ))}
          </div>

          <div className="p-4 lg:p-8">
            {/* Wedstrijden */}
            {tab === 0 && (
              <div className="lg:grid lg:grid-cols-[320px,1fr] lg:gap-6">
                {/* Match list */}
                <div className="lg:max-h-screen lg:overflow-y-auto space-y-4">
                  {Object.entries(groupMatchesByDay).map(([date, matches]) => (
                    <div key={date}>
                      <p className="text-[11px] font-semibold text-[#aaa] uppercase tracking-wider mb-2">
                        {new Date(date).toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })}
                      </p>
                      <div className="space-y-2">
                        {matches.map(m => (
                          <MatchPredictionCard
                            key={m.id}
                            match={m}
                            prediction={localMatchPreds[m.id]}
                            onSave={data => saveMatchPrediction(m.id, data)}
                            isGroup
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                {/* Desktop: empty right panel hint */}
                <div className="hidden lg:flex items-center justify-center text-[#aaa] flex-col gap-3">
                  <span className="text-4xl">⚽</span>
                  <p className="text-sm">Klik een wedstrijd aan om te voorspellen</p>
                </div>
              </div>
            )}

            {/* Poulestand */}
            {tab === 1 && (
              <div>
                <div className="flex gap-1.5 flex-wrap mb-4">
                  {GROUPS.map(g => (
                    <button key={g} onClick={() => setActiveGroup(g)}
                      className={`w-9 h-9 rounded-lg text-sm font-semibold border-0 cursor-pointer transition-colors ${
                        activeGroup === g ? 'bg-[#1a5c38] text-white' : 'bg-white border border-[#e5e1d8] text-[#777]'
                      }`}>{g}</button>
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

            {/* Bonusvragen */}
            {tab === 2 && (
              <div className="max-w-xl space-y-4">
                <div>
                  <h2 className="text-sm font-semibold text-gray-800 mb-1">Groepsfase</h2>
                  <p className="text-xs text-[#aaa] mb-3">Sluiten op 11 juni</p>
                  <div className="space-y-3">
                    {groupQs.map(q => (
                      <BonusQuestionItem key={q.id} question={q} value={localBonusAnswers[q.id] || ''}
                        teams={teams} players={players} onSave={val => saveBonusAnswer(q.id, val)} />
                    ))}
                  </div>
                </div>
                <div className="h-px bg-[#e5e1d8] my-4" />
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <h2 className="text-sm font-semibold text-gray-800">Heel toernooi</h2>
                    <span className="tag bg-amber-50 text-amber-700">Aanpasbaar tot 11 jun</span>
                  </div>
                  <p className="text-xs text-[#aaa] mb-3">Jouw grote voorspellingen — nog te wijzigen</p>
                  <div className="space-y-3">
                    {tourQs.map(q => (
                      <BonusQuestionItem key={q.id} question={q} value={localBonusAnswers[q.id] || ''}
                        teams={teams} players={players} onSave={val => saveBonusAnswer(q.id, val)} />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── KNOCKOUT PHASE ── */}
      {phase === 'knockout' && (
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
                <button key={r.id} onClick={() => setKoRound(r.id)}
                  className={`flex-shrink-0 flex flex-col items-center px-4 py-3 text-xs border-b-2 -mb-px cursor-pointer border-0 bg-transparent transition-colors ${
                    koRound === r.id ? 'border-[#1a5c38] text-[#1a5c38] font-semibold' : 'border-transparent text-[#aaa]'
                  }`}>
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
                />
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}

'use client'
import { useState, useEffect } from 'react'
import type { BonusQuestion, Team, Player } from '@/types'
import { createClient } from '@/lib/supabase/client'
import BonusQuestionItem from './BonusQuestionItem'

export default function WizardModal({ onClose }: { onClose: () => void }) {
  const supabase = createClient()
  const [step, setStep] = useState<'intro' | number | 'done'>('intro')
  const [questions, setQuestions] = useState<BonusQuestion[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [userId, setUserId] = useState<string>('')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setUserId(user.id)

      const [{ data: qs }, { data: ts }, { data: ps }, { data: existing }] = await Promise.all([
        supabase.from('bonus_questions').select('*').eq('active', true).eq('phase', 'tournament').order('sort_order'),
        supabase.from('teams').select('*').order('group_id'),
        supabase.from('players').select('*, team:team_id(*)').order('name'),
        supabase.from('bonus_answers').select('*').eq('user_id', user?.id || ''),
      ])
      setQuestions(qs || [])
      setTeams(ts || [])
      setPlayers(ps || [])
      if (existing) {
        setAnswers(Object.fromEntries(
          existing.map((a: { question_id: string; answer: string }) => [a.question_id, a.answer])
        ))
      }
    }
    load()
  }, [])

  async function saveAnswer(questionId: string, answer: string) {
    const newAnswers = { ...answers, [questionId]: answer }
    setAnswers(newAnswers)
    const existing = Object.keys(answers).includes(questionId)
    const data = { user_id: userId, question_id: questionId, answer }
    if (existing) {
      await supabase.from('bonus_answers').update(data).eq('user_id', userId).eq('question_id', questionId)
    } else {
      await supabase.from('bonus_answers').insert(data)
    }
    goNext()
  }

  function goNext() {
    if (typeof step === 'number') {
      const next = step + 1
      setStep(next >= tourQs.length ? 'done' : next)
    }
  }

  const tourQs = questions.filter(q => q.phase === 'tournament')

  if (step === 'intro') return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
      <div className="bg-white rounded-t-3xl w-full max-w-lg h-[88vh] flex flex-col">
        <div className="w-9 h-1 bg-[#e5e1d8] rounded-full mx-auto mt-3 flex-shrink-0" />
        <div className="flex-1 overflow-y-auto p-6 text-center">
          <div className="text-5xl mb-4">🏆</div>
          <h2 className="heading text-2xl font-extrabold text-[#1a5c38] mb-2">Welkom bij Dé WK Poule!</h2>
          <p className="text-sm text-gray-600 leading-relaxed mb-1">
            Voordat het toernooi begint, stellen we je {tourQs.length} grote vragen over het hele toernooi.
          </p>
          <p className="text-xs text-[#aaa] mb-6">Sluit op 11 juni · daarna definitief · tot die tijd aanpasbaar</p>
          <div className="bg-[#f6f4ef] rounded-2xl p-4 mb-6 text-left space-y-2.5">
            {tourQs.map((q, i) => (
              <div key={q.id} className={`flex items-center gap-3 ${i < tourQs.length - 1 ? 'pb-2.5 border-b border-[#e5e1d8]' : ''}`}>
                <span className="text-base">{q.icon}</span>
                <span className="text-sm text-gray-700">{q.question_nl}</span>
              </div>
            ))}
          </div>
          <button onClick={() => setStep(0)} className="btn-primary w-full py-4">
            Start de grote vragen →
          </button>
          <button onClick={onClose}
            className="mt-3 w-full bg-transparent border-0 text-[#aaa] text-sm cursor-pointer py-2">
            Sla over — ik doe dit later
          </button>
        </div>
      </div>
    </div>
  )

  if (step === 'done') return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
      <div className="bg-white rounded-t-3xl w-full max-w-lg h-[88vh] flex flex-col">
        <div className="w-9 h-1 bg-[#e5e1d8] rounded-full mx-auto mt-3 flex-shrink-0" />
        <div className="flex-1 overflow-y-auto p-6 text-center">
          <div className="text-5xl mb-4">🎉</div>
          <h2 className="heading text-2xl font-extrabold text-[#1a5c38] mb-2">Opgeslagen!</h2>
          <p className="text-sm text-gray-600 mb-6">
            Je grote voorspellingen staan vast. Aanpassen kan nog tot 11 juni via de Bonusvragen tab.
          </p>
          <div className="space-y-2 mb-6">
            {tourQs.map(q => (
              <div key={q.id} className="flex justify-between items-center py-2.5 border-b border-[#f6f4ef]">
                <span className="text-sm text-[#888]">{q.icon} {q.question_nl}</span>
                <span className="text-sm font-semibold text-[#1a5c38] ml-3 flex-shrink-0 text-right max-w-[140px]">
                  {answers[q.id] || '—'}
                </span>
              </div>
            ))}
          </div>
          <button onClick={onClose} className="btn-primary w-full py-4">
            Naar de app →
          </button>
        </div>
      </div>
    </div>
  )

  const currentQ = tourQs[step as number]
  if (!currentQ) return null

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
      <div className="bg-white rounded-t-3xl w-full max-w-lg h-[88vh] flex flex-col">
        <div className="w-9 h-1 bg-[#e5e1d8] rounded-full mx-auto mt-3 flex-shrink-0" />
        <div className="flex-1 overflow-y-auto p-6">
          {/* Progress */}
          <div className="flex gap-1 mb-5">
            {tourQs.map((_, i) => (
              <div key={i} className={`flex-1 h-1 rounded-full transition-colors ${i <= (step as number) ? 'bg-[#1a5c38]' : 'bg-[#e5e1d8]'}`} />
            ))}
          </div>

          <div className="text-3xl mb-2">{currentQ.icon}</div>
          <h2 className="heading text-xl font-bold text-gray-900 mb-1">{currentQ.question_nl}</h2>
          <p className="text-xs text-[#aaa] mb-4">
            Vraag {(step as number) + 1} van {tourQs.length} · {currentQ.points_value} punten
          </p>

          <BonusQuestionItem
            question={currentQ}
            value={answers[currentQ.id] || ''}
            teams={teams}
            players={players as Player[]}
            onSave={val => saveAnswer(currentQ.id, val)}
          />

          <div className="mt-3 flex flex-col gap-1">
            {(step as number) > 0 && (
              <button onClick={() => setStep((step as number) - 1)}
                className="bg-transparent border-0 text-[#aaa] text-sm cursor-pointer text-left py-1">
                ← Vorige vraag
              </button>
            )}
            <button onClick={goNext}
              className="bg-transparent border-0 text-[#aaa] text-sm cursor-pointer text-left py-1">
              Deze vraag later invullen →
            </button>
            <button onClick={onClose}
              className="bg-transparent border-0 text-[#aaa] text-sm cursor-pointer text-left py-1">
              Wizard sluiten
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

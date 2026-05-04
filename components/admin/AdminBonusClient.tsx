'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { BonusQuestion } from '@/types'

const TYPE_LABELS = { team: '🌍 Land', player: '👤 Speler', number: '🔢 Getal' }
const PHASE_LABELS = { group: 'Groepsfase', tournament: 'Heel toernooi' }

export default function AdminBonusClient({ initialQuestions }: { initialQuestions: BonusQuestion[] }) {
  const supabase = createClient()
  const [questions, setQuestions] = useState(initialQuestions)
  const [editId, setEditId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Partial<BonusQuestion> | null>(null)
  const [saving, setSaving] = useState(false)

  function openEdit(q: BonusQuestion) { setDraft({ ...q }); setEditId(q.id) }
  function openNew() {
    const nq: Partial<BonusQuestion> = { question_nl: '', question_type: 'team', phase: 'group', points_value: 5, icon: '🎯', active: true, deadline_at: '2026-06-11T19:00:00Z' }
    setDraft(nq); setEditId('new')
  }

  async function handleSave() {
    if (!draft) return
    setSaving(true)
    if (editId === 'new') {
      const { data } = await supabase.from('bonus_questions').insert(draft).select().single()
      if (data) setQuestions(qs => [...qs, data])
    } else {
      await supabase.from('bonus_questions').update(draft).eq('id', editId!)
      setQuestions(qs => qs.map(q => q.id === editId ? { ...q, ...draft } as BonusQuestion : q))
    }
    setSaving(false); setEditId(null); setDraft(null)
  }

  async function toggleActive(q: BonusQuestion) {
    await supabase.from('bonus_questions').update({ active: !q.active }).eq('id', q.id)
    setQuestions(qs => qs.map(x => x.id === q.id ? { ...x, active: !x.active } : x))
  }

  async function handleDelete(id: string) {
    if (!confirm('Bonusvraag verwijderen?')) return
    await supabase.from('bonus_questions').delete().eq('id', id)
    setQuestions(qs => qs.filter(q => q.id !== id))
  }

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="heading text-2xl font-extrabold text-gray-900">Bonusvragen</h1>
        <button onClick={openNew} className="btn-primary py-2 px-4 text-sm">+ Nieuwe vraag</button>
      </div>

      {/* Edit modal */}
      {editId && draft && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4">
            <h2 className="heading text-lg font-bold">{editId === 'new' ? 'Nieuwe vraag' : 'Vraag bewerken'}</h2>
            {[['Vraag', 'question_nl'], ['Icoon (emoji)', 'icon']].map(([lbl, key]) => (
              <div key={key}>
                <label className="block text-xs font-semibold text-[#888] mb-1.5 uppercase">{lbl}</label>
                <input value={(draft as Record<string, string>)[key] || ''} onChange={e => setDraft(d => ({ ...d, [key]: e.target.value }))}
                  className="w-full border border-[#e5e1d8] rounded-xl px-4 py-2.5 text-sm bg-[#f6f4ef] outline-none focus:border-[#1a5c38]" />
              </div>
            ))}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#888] mb-1.5 uppercase">Type antwoord</label>
                <div className="flex flex-col gap-1.5">
                  {(['team', 'player', 'number'] as const).map(t => (
                    <button key={t} onClick={() => setDraft(d => ({ ...d, question_type: t }))}
                      className={`py-2 px-3 rounded-lg text-sm text-left border-0 cursor-pointer ${draft.question_type === t ? 'bg-[#eaf4ef] text-[#1a5c38] font-semibold' : 'bg-[#f6f4ef] text-[#888]'}`}>
                      {TYPE_LABELS[t]}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#888] mb-1.5 uppercase">Fase</label>
                <div className="flex flex-col gap-1.5">
                  {(['group', 'tournament'] as const).map(p => (
                    <button key={p} onClick={() => setDraft(d => ({ ...d, phase: p }))}
                      className={`py-2 px-3 rounded-lg text-sm text-left border-0 cursor-pointer ${draft.phase === p ? 'bg-[#eaf4ef] text-[#1a5c38] font-semibold' : 'bg-[#f6f4ef] text-[#888]'}`}>
                      {PHASE_LABELS[p]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#888] mb-1.5 uppercase">Punten</label>
              <input type="number" min="1" max="20" value={draft.points_value || 5}
                onChange={e => setDraft(d => ({ ...d, points_value: parseInt(e.target.value) || 5 }))}
                className="input-score text-base font-bold" style={{ width: 72, height: 40 }} />
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 py-3 disabled:opacity-50">
                {saving ? 'Opslaan...' : 'Opslaan ✓'}
              </button>
              <button onClick={() => { setEditId(null); setDraft(null) }} className="btn-secondary flex-1 py-3">
                Annuleren
              </button>
            </div>
          </div>
        </div>
      )}

      {(['group', 'tournament'] as const).map(phase => (
        <div key={phase} className="bg-white rounded-2xl border border-[#e5e1d8] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#f6f4ef]">
            <h2 className="text-sm font-semibold text-gray-800">{PHASE_LABELS[phase]}</h2>
          </div>
          {questions.filter(q => q.phase === phase).map(q => (
            <div key={q.id} className={`flex items-center gap-3 px-5 py-3.5 border-b border-[#f6f4ef] last:border-0 ${!q.active ? 'opacity-40' : ''}`}>
              <span className="text-xl flex-shrink-0">{q.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{q.question_nl}</p>
                <div className="flex gap-2 mt-0.5">
                  <span className={`tag text-[10px] ${q.question_type === 'team' ? 'bg-[#eaf4ef] text-[#1a5c38]' : q.question_type === 'player' ? 'bg-purple-100 text-purple-700' : 'bg-orange-100 text-orange-700'}`}>
                    {TYPE_LABELS[q.question_type]}
                  </span>
                  <span className="tag bg-[#f0ede6] text-[#888] text-[10px]">{q.points_value} pt</span>
                </div>
              </div>
              <div className="flex gap-1.5 flex-shrink-0">
                <button onClick={() => toggleActive(q)} title={q.active ? 'Deactiveren' : 'Activeren'}
                  className="w-8 h-8 rounded-lg border border-[#e5e1d8] bg-white cursor-pointer text-sm">
                  {q.active ? '👁' : '🚫'}
                </button>
                <button onClick={() => openEdit(q)} className="w-8 h-8 rounded-lg border border-[#e5e1d8] bg-white cursor-pointer text-sm">✏️</button>
                <button onClick={() => handleDelete(q.id)} className="w-8 h-8 rounded-lg border border-red-200 bg-white cursor-pointer text-sm">🗑</button>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

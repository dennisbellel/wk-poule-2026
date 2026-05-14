'use client'
// components/admin/AdminBonusClient.tsx

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface BonusQuestion {
  id: string
  question_nl: string
  question_type: 'team' | 'player' | 'yes_no' | 'number' | 'text'
  phase: string
  points_value: number
  icon: string
  deadline_at: string
  correct_answer: string | null
  active: boolean
  sort_order: number
  team_filter: string | null
  options: string[] | null
}

interface Team {
  id: string
  name: string
}

interface Props {
  initialQuestions: BonusQuestion[]
  teams: Team[]
}

const TYPE_OPTIONS = [
  { value: 'yes_no',  label: '✅ Ja / Nee',         desc: 'Twee knoppen: Ja of Nee' },
  { value: 'team',    label: '🌍 Land kiezen',       desc: 'Selectie uit alle deelnemende landen' },
  { value: 'player',  label: '👤 Speler kiezen',     desc: 'Speler, optioneel gefilterd op een land' },
  { value: 'number',  label: '🔢 Getal invullen',    desc: 'Numerieke invoer, bijv. aantal goals' },
  { value: 'text',    label: '✍️ Vrije tekst',       desc: 'Open antwoord' },
]

const PHASE_OPTIONS = [
  { value: 'tournament', label: '🏆 Heel toernooi' },
  { value: 'group',      label: '🔵 Groepsfase' },
  { value: 'knockout',   label: '⚡ Knockoutfase' },
  { value: 'live',       label: '🔴 Live / Actueel' },
]

function formatDeadline(utc: string): string {
  return new Date(utc).toLocaleString('nl-NL', {
    timeZone: 'Europe/Amsterdam',
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

function toDatetimeLocal(utc: string): string {
  const d = new Date(utc)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fromDatetimeLocal(local: string): string {
  return new Date(local).toISOString()
}

const EMPTY_QUESTION: Partial<BonusQuestion> = {
  question_nl: '',
  question_type: 'yes_no',
  phase: 'tournament',
  points_value: 10,
  icon: '🎯',
  active: false,
  deadline_at: '2026-06-11T19:00:00Z',
  team_filter: null,
  options: null,
}

export default function AdminBonusClient({ initialQuestions, teams }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [questions, setQuestions] = useState<BonusQuestion[]>(initialQuestions)
  const [editId, setEditId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Partial<BonusQuestion> | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [publishing, setPublishing] = useState<string | null>(null)
  const [published, setPublished] = useState<Set<string>>(new Set())

  // Gesorteerd op sort_order
  const sorted = useMemo(() => [...questions].sort((a, b) => a.sort_order - b.sort_order), [questions])

  function openNew() {
    setDraft({ ...EMPTY_QUESTION, sort_order: questions.length + 1 })
    setEditId('new')
    setSaved(false)
  }

  function openEdit(q: BonusQuestion) {
    setDraft({
      ...q,
      deadline_at: toDatetimeLocal(q.deadline_at),
    })
    setEditId(q.id)
    setSaved(false)
  }

  function closeEdit() {
    setEditId(null)
    setDraft(null)
    setSaved(false)
  }

  function updateDraft(field: string, value: unknown) {
    setDraft(prev => prev ? { ...prev, [field]: value } : prev)
  }

  async function handleSave() {
    if (!draft) return
    setSaving(true)

    const payload = {
      ...draft,
      deadline_at: fromDatetimeLocal(draft.deadline_at as string),
      // Bij ja/nee: geen team_filter of options nodig
      team_filter: draft.question_type === 'player' ? (draft.team_filter ?? null) : null,
      options: null,
    }

    if (editId === 'new') {
      const { data, error } = await supabase
        .from('bonus_questions')
        .insert(payload)
        .select()
        .single()

      if (!error && data) {
        setQuestions(prev => [...prev, data as BonusQuestion])
        setSaved(true)
        setTimeout(closeEdit, 1000)
      }
    } else {
      const { error } = await supabase
        .from('bonus_questions')
        .update(payload)
        .eq('id', editId!)

      if (!error) {
        setQuestions(prev => prev.map(q =>
          q.id === editId
            ? { ...q, ...payload, deadline_at: fromDatetimeLocal(draft.deadline_at as string) } as BonusQuestion
            : q
        ))
        setSaved(true)
        setTimeout(closeEdit, 1000)
      }
    }

    setSaving(false)
  }

  async function toggleActive(q: BonusQuestion) {
    const newVal = !q.active
    await supabase.from('bonus_questions').update({ active: newVal }).eq('id', q.id)
    setQuestions(prev => prev.map(x => x.id === q.id ? { ...x, active: newVal } : x))
  }

  // Wissel positie en hernumme ALLE vragen — robuust tegen duplicate sort_orders
  async function moveQuestion(idx: number, dir: -1 | 1) {
    const target = idx + dir
    if (target < 0 || target >= sorted.length) return

    // Swap in een nieuwe gesorteerde array
    const reordered = [...sorted]
    ;[reordered[idx], reordered[target]] = [reordered[target], reordered[idx]]

    // Geef alle vragen een opeenvolgende sort_order (1, 2, 3, …)
    const updates = reordered.map((q, i) => ({ id: q.id, sort_order: i + 1 }))

    // Optimistische update lokaal
    setQuestions(prev => prev.map(q => {
      const u = updates.find(x => x.id === q.id)
      return u ? { ...q, sort_order: u.sort_order } : q
    }))

    // Update alle gewijzigde rijen in de DB (alleen waar de waarde echt anders is)
    const changed = updates.filter(u => {
      const old = sorted.find(q => q.id === u.id)
      return old && old.sort_order !== u.sort_order
    })
    await Promise.all(
      changed.map(u =>
        supabase.from('bonus_questions').update({ sort_order: u.sort_order }).eq('id', u.id)
      )
    )
  }

  async function handleDelete(id: string) {
    await supabase.from('bonus_questions').delete().eq('id', id)
    setQuestions(prev => prev.filter(q => q.id !== id))
    setConfirmDelete(null)
  }

  async function setCorrectAnswer(q: BonusQuestion, answer: string) {
    // Sla lokaal op — nog niet naar database
    setQuestions(prev => prev.map(x => x.id === q.id ? { ...x, correct_answer: answer } : x))
  }

  async function publishAnswer(q: BonusQuestion) {
    if (!q.correct_answer) return
    setPublishing(q.id)
    // Server route: schrijft correct_answer + berekent punten voor alle ingestuurde antwoorden
    const res = await fetch('/api/admin/publish-bonus-answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question_id: q.id, correct_answer: q.correct_answer }),
    })
    setPublishing(null)
    if (!res.ok) {
      alert('Publiceren mislukt — probeer opnieuw')
      return
    }
    setPublished(prev => new Set(prev).add(q.id))
    setTimeout(() => setPublished(prev => { const s = new Set(prev); s.delete(q.id); return s }), 2000)
    router.refresh()
  }

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="heading text-2xl font-extrabold text-gray-900">Bonusvragen</h1>
          <p className="text-sm text-gray-400 mt-0.5">{questions.length} vragen · Klik op een vraag om het juiste antwoord in te vullen</p>
        </div>
        <button
          onClick={openNew}
          className="px-4 py-2.5 bg-[#1a5c38] text-white text-sm font-semibold rounded-xl
                     hover:bg-[#164d2f] transition-colors cursor-pointer"
        >
          + Nieuwe vraag
        </button>
      </div>

      {/* Vragenlijst */}
      <div className="space-y-3">
        {sorted.map((q, idx) => (
          <div key={q.id} className={`bg-white rounded-2xl border transition-all ${
            q.active ? 'border-[#e5e1d8]' : 'border-[#f0ede6] opacity-60'
          }`}>
            <div className="px-5 py-4">
              <div className="flex items-start gap-3">
                {/* Sorteer-pijltjes links */}
                <div className="flex flex-col gap-0.5 flex-shrink-0">
                  <button
                    onClick={() => moveQuestion(idx, -1)}
                    disabled={idx === 0}
                    title="Omhoog"
                    className="w-6 h-6 flex items-center justify-center rounded-md border border-[#e5e1d8] bg-white text-xs text-gray-500 hover:bg-[#f6f4ef] disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => moveQuestion(idx, 1)}
                    disabled={idx === sorted.length - 1}
                    title="Omlaag"
                    className="w-6 h-6 flex items-center justify-center rounded-md border border-[#e5e1d8] bg-white text-xs text-gray-500 hover:bg-[#f6f4ef] disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer"
                  >
                    ↓
                  </button>
                </div>

                {/* Icoon */}
                <span className="text-2xl flex-shrink-0 mt-0.5">{q.icon}</span>

                {/* Vraag info */}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-[#1a1a1a] text-sm leading-snug">{q.question_nl}</div>
                  <div className="flex flex-wrap gap-2 mt-1.5">
                    {/* Type badge */}
                    <span className="text-xs px-2 py-0.5 rounded-full bg-[#f0ede6] text-gray-500 font-medium">
                      {TYPE_OPTIONS.find(t => t.value === q.question_type)?.label ?? q.question_type}
                    </span>
                    {/* Als speler + team filter */}
                    {q.question_type === 'player' && q.team_filter && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium">
                        🔍 {teams.find(t => t.id === q.team_filter)?.name ?? q.team_filter}
                      </span>
                    )}
                    {/* Punten */}
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 font-medium">
                      {q.points_value} pt
                    </span>
                    {/* Deadline */}
                    <span className="text-xs text-gray-400">
                      ⏰ deadline {formatDeadline(q.deadline_at)}
                    </span>
                  </div>

                  {/* Juist antwoord invullen + publiceren */}
                  <div className="mt-3 space-y-2">
                    {q.question_type === 'yes_no' ? (
                      <div className="flex gap-2 flex-wrap items-center">
                        <span className="text-xs text-gray-400 self-center">Juist antwoord:</span>
                        {['Ja', 'Nee'].map(opt => (
                          <button
                            key={opt}
                            onClick={() => setCorrectAnswer(q, opt)}
                            className={`px-3 py-1 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                              q.correct_answer === opt
                                ? 'bg-[#1a5c38] text-white border-[#1a5c38]'
                                : 'bg-white text-gray-500 border-[#e5e1d8] hover:border-[#1a5c38]'
                            }`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div>
                        <div className="flex gap-2 items-center">
                          <span className="text-xs text-gray-400 flex-shrink-0">Juist antwoord:</span>
                          <input
                            type={q.question_type === 'number' ? 'number' : 'text'}
                            value={q.correct_answer ?? ''}
                            onChange={e => setCorrectAnswer(q, e.target.value)}
                            placeholder={
                              q.question_type === 'number' ? 'bijv. 4' :
                              q.question_type === 'team' ? 'bijv. NED' :
                              q.question_type === 'player' ? 'bijv. Gakpo' :
                              'antwoord...'
                            }
                            className="flex-1 max-w-md bg-[#f6f4ef] border border-[#e5e1d8] rounded-lg px-3 py-1
                                       text-sm focus:outline-none focus:border-[#1a5c38]"
                          />
                        </div>
                        {/* Multi-answer hint en preview */}
                        {q.question_type !== 'number' && q.question_type !== 'yes_no' && (
                          <div className="mt-1.5 pl-[88px]">
                            <p className="text-[10px] text-gray-400">
                              💡 Meerdere antwoorden mogelijk? Scheid met komma&apos;s (bv. <em>Memphis, Gakpo, Bergwijn</em>)
                            </p>
                            {q.correct_answer && q.correct_answer.includes(',') && (
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {q.correct_answer.split(',').map(a => a.trim()).filter(Boolean).map((a, i) => (
                                  <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#eaf4ef] text-[#1a5c38] text-[10px] font-semibold">
                                    {a}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    {/* Publiceer knop */}
                    <button
                      onClick={() => publishAnswer(q)}
                      disabled={!q.correct_answer || publishing === q.id}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg border-0 transition-colors cursor-pointer disabled:opacity-40 ${
                        published.has(q.id)
                          ? 'bg-green-500 text-white'
                          : q.correct_answer
                          ? 'bg-[#1a5c38] text-white hover:bg-[#164d2f]'
                          : 'bg-[#f0ede6] text-[#aaa] cursor-not-allowed'
                      }`}
                    >
                      {publishing === q.id ? 'Publiceren...' : published.has(q.id) ? '✓ Gepubliceerd' : '▶ Publiceer antwoord'}
                    </button>
                  </div>
                </div>

                {/* Acties rechts */}
                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  {/* Actief toggle */}
                  <button
                    onClick={() => toggleActive(q)}
                    className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer ${
                      q.active ? 'bg-[#1a5c38]' : 'bg-gray-200'
                    }`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                      q.active ? 'translate-x-5' : 'translate-x-0.5'
                    }`} />
                  </button>
                  <span className="text-xs text-gray-400">{q.active ? 'Actief' : 'Verborgen'}</span>

                  {/* Bewerk & verwijder */}
                  <div className="flex gap-1.5 mt-1">
                    <button
                      onClick={() => openEdit(q)}
                      className="px-2.5 py-1 text-xs font-semibold text-[#1a5c38] bg-[#eaf4ef]
                                 rounded-lg border border-[#c8e6d4] hover:bg-[#d4f0e0] transition-colors cursor-pointer"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => setConfirmDelete(q.id)}
                      className="px-2.5 py-1 text-xs font-semibold text-red-500 bg-red-50
                                 rounded-lg border border-red-100 hover:bg-red-100 transition-colors cursor-pointer"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Verwijder bevestiging */}
            {confirmDelete === q.id && (
              <div className="px-5 py-3 bg-red-50 border-t border-red-100 flex items-center gap-3 rounded-b-2xl">
                <span className="text-sm text-red-600 flex-1">Zeker weten? Dit verwijdert ook alle antwoorden van deelnemers.</span>
                <button onClick={() => handleDelete(q.id)}
                  className="px-3 py-1.5 text-xs font-semibold bg-red-500 text-white rounded-lg cursor-pointer hover:bg-red-600">
                  Ja, verwijder
                </button>
                <button onClick={() => setConfirmDelete(null)}
                  className="px-3 py-1.5 text-xs font-semibold bg-white text-gray-500 border border-gray-200 rounded-lg cursor-pointer">
                  Annuleer
                </button>
              </div>
            )}
          </div>
        ))}

        {questions.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <div className="text-4xl mb-3">🎯</div>
            <div className="text-sm">Nog geen bonusvragen. Maak er een aan!</div>
          </div>
        )}
      </div>

      {/* Edit / Nieuw modal */}
      {editId && draft && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-5 border-b border-[#f0ede6] flex items-center justify-between sticky top-0 bg-white">
              <h2 className="heading text-lg font-bold">
                {editId === 'new' ? '➕ Nieuwe vraag' : '✏️ Vraag bewerken'}
              </h2>
              <button onClick={closeEdit} className="text-gray-400 hover:text-gray-600 text-xl cursor-pointer">✕</button>
            </div>

            <div className="px-6 py-5 space-y-5">
              {/* Vraag tekst */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Vraag</label>
                <input
                  type="text"
                  value={draft.question_nl ?? ''}
                  onChange={e => updateDraft('question_nl', e.target.value)}
                  placeholder="bijv. Wie wordt topscorer van Nederland?"
                  className="w-full border border-[#e5e1d8] rounded-xl px-4 py-2.5 text-sm
                             focus:outline-none focus:border-[#1a5c38] bg-[#fafaf9]"
                />
              </div>

              {/* Type antwoord */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Type antwoord</label>
                <div className="space-y-2">
                  {TYPE_OPTIONS.map(opt => (
                    <label key={opt.value} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                      draft.question_type === opt.value
                        ? 'border-[#1a5c38] bg-[#eaf4ef]'
                        : 'border-[#e5e1d8] hover:border-[#c8e6d4]'
                    }`}>
                      <input
                        type="radio"
                        name="question_type"
                        value={opt.value}
                        checked={draft.question_type === opt.value}
                        onChange={() => updateDraft('question_type', opt.value)}
                        className="mt-0.5 accent-[#1a5c38]"
                      />
                      <div>
                        <div className="text-sm font-semibold text-[#1a1a1a]">{opt.label}</div>
                        <div className="text-xs text-gray-400">{opt.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Team filter (alleen bij 'player') */}
              {draft.question_type === 'player' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                    Filter op land <span className="text-gray-400 normal-case font-normal">(optioneel)</span>
                  </label>
                  <select
                    value={draft.team_filter ?? ''}
                    onChange={e => updateDraft('team_filter', e.target.value || null)}
                    className="w-full border border-[#e5e1d8] rounded-xl px-4 py-2.5 text-sm
                               focus:outline-none focus:border-[#1a5c38] bg-[#fafaf9] cursor-pointer"
                  >
                    <option value="">— Alle landen (geen filter) —</option>
                    {teams.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-400 mt-1">
                    Kies een land als deelnemers alleen uit spelers van dat land mogen kiezen (bijv. topscorer Nederland).
                  </p>
                </div>
              )}

              {/* Icoon + Punten */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Icoon (emoji)</label>
                  <input
                    type="text"
                    value={draft.icon ?? ''}
                    onChange={e => updateDraft('icon', e.target.value)}
                    className="w-full border border-[#e5e1d8] rounded-xl px-4 py-2.5 text-sm
                               focus:outline-none focus:border-[#1a5c38] bg-[#fafaf9] text-center text-2xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Punten</label>
                  <input
                    type="number"
                    value={draft.points_value ?? 10}
                    onChange={e => updateDraft('points_value', parseInt(e.target.value))}
                    min={1} max={100}
                    className="w-full border border-[#e5e1d8] rounded-xl px-4 py-2.5 text-sm
                               focus:outline-none focus:border-[#1a5c38] bg-[#fafaf9]"
                  />
                </div>
              </div>

              {/* Fase */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Fase</label>
                <select
                  value={draft.phase ?? 'tournament'}
                  onChange={e => updateDraft('phase', e.target.value)}
                  className="w-full border border-[#e5e1d8] rounded-xl px-4 py-2.5 text-sm
                             focus:outline-none focus:border-[#1a5c38] bg-[#fafaf9] cursor-pointer"
                >
                  {PHASE_OPTIONS.map(p => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>

              {/* Deadline */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Deadline voorspelling</label>
                <input
                  type="datetime-local"
                  value={draft.deadline_at as string ?? ''}
                  onChange={e => updateDraft('deadline_at', e.target.value)}
                  className="w-full border border-[#e5e1d8] rounded-xl px-4 py-2.5 text-sm
                             focus:outline-none focus:border-[#1a5c38] bg-[#fafaf9]"
                />
                <p className="text-xs text-gray-400 mt-1">Na deze tijd kunnen deelnemers de vraag niet meer beantwoorden.</p>
              </div>

              {/* Direct actief? */}
              <label className="flex items-center gap-3 cursor-pointer">
                <div
                  onClick={() => updateDraft('active', !draft.active)}
                  className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer ${draft.active ? 'bg-[#1a5c38]' : 'bg-gray-200'}`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${draft.active ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </div>
                <div>
                  <div className="text-sm font-semibold text-[#1a1a1a]">Direct zichtbaar voor deelnemers</div>
                  <div className="text-xs text-gray-400">Zet uit om de vraag alvast klaar te zetten maar nog niet te tonen.</div>
                </div>
              </label>
            </div>

            {/* Footer knoppen */}
            <div className="px-6 py-4 border-t border-[#f0ede6] flex gap-3 sticky bottom-0 bg-white">
              <button
                onClick={handleSave}
                disabled={saving || !draft.question_nl}
                className={`flex-1 py-2.5 text-sm font-semibold rounded-xl transition-colors cursor-pointer ${
                  saved
                    ? 'bg-green-500 text-white'
                    : 'bg-[#1a5c38] text-white hover:bg-[#164d2f]'
                } disabled:opacity-40`}
              >
                {saving ? 'Opslaan...' : saved ? '✓ Opgeslagen!' : 'Opslaan'}
              </button>
              <button
                onClick={closeEdit}
                className="px-5 py-2.5 text-sm font-semibold rounded-xl bg-white border border-[#e5e1d8]
                           text-gray-600 hover:bg-[#f6f4ef] transition-colors cursor-pointer"
              >
                Annuleer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

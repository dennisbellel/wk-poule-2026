'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface MatchWithTeams {
  id: string
  scheduled_at: string
  status: string
  group_id: string | null
  phase: string
  home_ft: number | null
  away_ft: number | null
  home_ht: number | null
  away_ht: number | null
  home_yellow: number | null
  away_yellow: number | null
  home_red: number | null
  away_red: number | null
  penalties: boolean
  home_team: { name_nl: string; flag: string } | null
  away_team: { name_nl: string; flag: string } | null
}

function YellowCard() {
  return <span style={{ display: 'inline-block', width: 9, height: 12, background: '#F5A623', borderRadius: 2 }} />
}
function RedCard() {
  return <span style={{ display: 'inline-block', width: 9, height: 12, background: '#E2231A', borderRadius: 2 }} />
}

function ScoreInput({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  return (
    <input
      type="number" min="0" max="99"
      value={value ?? ''}
      onChange={e => onChange(e.target.value === '' ? null : parseInt(e.target.value))}
      className="input-score w-11 h-11 text-lg"
    />
  )
}

export default function AdminResultForm({ match }: { match: MatchWithTeams }) {
  const supabase = createClient()
  const [v, setV] = useState({
    home_ft: match.home_ft, away_ft: match.away_ft,
    home_ht: match.home_ht, away_ht: match.away_ht,
    home_yellow: match.home_yellow, away_yellow: match.away_yellow,
    home_red: match.home_red, away_red: match.away_red,
  })
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [saved, setSaved] = useState(false)
  const [published, setPublished] = useState(false)
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; message: string } | null>(null)

  const s = (k: keyof typeof v, val: number | null) => setV(p => ({ ...p, [k]: val }))

  // Alle verplichte velden ingevuld?
  const isComplete = v.home_ft !== null && v.away_ft !== null &&
    v.home_ht !== null && v.away_ht !== null &&
    v.home_yellow !== null && v.away_yellow !== null &&
    v.home_red !== null && v.away_red !== null

  // Sla op als concept in pending_results (niet direct in matches)
  async function handleSave() {
    setSaving(true)
    const { error } = await supabase.from('pending_results').upsert({
      match_id: match.id,
      ...v,
      penalties: false,
      status: 'pending',
      synced_at: new Date().toISOString(),
    }, { onConflict: 'match_id' })

    setSaving(false)
    if (error) {
      setFeedback({ kind: 'error', message: 'Concept opslaan mislukt — probeer opnieuw' })
      setTimeout(() => setFeedback(null), 5000)
      return
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  // Publiceer: roept server route aan die uitslag schrijft én alle voorspellingen herberekent
  async function handlePublish() {
    if (!isComplete) return
    setPublishing(true)
    setFeedback(null)

    try {
      const res = await fetch('/api/admin/publish-result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ match_id: match.id, ...v }),
      })
      const json = await res.json()

      if (!res.ok) {
        setFeedback({ kind: 'error', message: json.error || 'Publiceren mislukt' })
        setTimeout(() => setFeedback(null), 5000)
        return
      }

      setPublished(true)
      setFeedback({
        kind: 'success',
        message: `Uitslag gepubliceerd · ${json.recalculated} voorspellingen herberekend`,
      })
      setTimeout(() => setFeedback(null), 5000)
    } catch {
      setFeedback({ kind: 'error', message: 'Netwerkfout — probeer opnieuw' })
      setTimeout(() => setFeedback(null), 5000)
    } finally {
      setPublishing(false)
    }
  }

  const isFinished = match.status === 'finished'

  const ROWS = [
    { label: 'Eindstand', icon: null, hk: 'home_ft' as const, ak: 'away_ft' as const },
    { label: 'Ruststand', icon: null, hk: 'home_ht' as const, ak: 'away_ht' as const },
    { label: 'Geel', icon: <YellowCard />, hk: 'home_yellow' as const, ak: 'away_yellow' as const },
    { label: 'Rood', icon: <RedCard />, hk: 'home_red' as const, ak: 'away_red' as const },
  ]

  return (
    <div className={`bg-white rounded-2xl border overflow-hidden ${isFinished || published ? 'border-[#c8e6d4]' : 'border-[#e5e1d8]'}`}>
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-[#f6f4ef] flex justify-between items-center">
        <div className="flex gap-2 items-center">
          <span className="tag bg-[#f0ede6] text-[#888]">
            {match.group_id ? `Gr.${match.group_id}` : match.phase}
          </span>
          <span className="text-xs text-[#aaa]">
            {new Date(match.scheduled_at).toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' })}
          </span>
        </div>
        <span className={`tag ${
          published || isFinished ? 'bg-[#eaf4ef] text-[#1a5c38]' : 'bg-[#f0ede6] text-[#888]'
        }`}>
          {published || isFinished ? '✓ Gepubliceerd' : 'Concept'}
        </span>
      </div>

      {/* Teams */}
      <div className="px-4 py-3 border-b border-[#f6f4ef] flex items-center gap-2">
        <span className="flex-1 text-sm font-semibold">
          {match.home_team?.flag} {match.home_team?.name_nl ?? '?'}
        </span>
        <span className="text-xs text-[#ccc]">vs</span>
        <span className="flex-1 text-sm font-semibold text-right">
          {match.away_team?.name_nl ?? '?'} {match.away_team?.flag}
        </span>
      </div>

      {/* Input rijen */}
      <div className="bg-[#f6f4ef]">
        {ROWS.map(row => (
          <div key={row.label} className="flex items-center gap-2 px-4 py-2.5 border-b border-[#edeae3] last:border-0">
            <span className="flex items-center gap-1.5 text-xs text-[#888] w-24 flex-shrink-0">
              {row.icon}{row.label}
            </span>
            <div className="flex items-center gap-1 flex-1 justify-center">
              <ScoreInput value={v[row.hk]} onChange={val => s(row.hk, val)} />
              <span className="text-xs text-[#ccc] px-1">–</span>
              <ScoreInput value={v[row.ak]} onChange={val => s(row.ak, val)} />
            </div>
          </div>
        ))}
      </div>

      {/* Feedback banner */}
      {feedback && (
        <div className={`px-4 py-2.5 text-xs font-semibold border-b ${
          feedback.kind === 'success'
            ? 'bg-[#eaf4ef] text-[#1a5c38] border-[#c8e6d4]'
            : 'bg-red-50 text-red-700 border-red-200'
        }`}>
          {feedback.kind === 'success' ? '✓ ' : '⚠ '}{feedback.message}
        </div>
      )}

      {/* Knoppen */}
      <div className="px-4 py-3 flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 py-2 text-sm font-semibold rounded-xl border border-[#e5e1d8] bg-white text-gray-600 hover:bg-[#f6f4ef] transition-colors cursor-pointer disabled:opacity-40"
        >
          {saving ? 'Opslaan...' : saved ? '✓ Concept opgeslagen' : 'Opslaan als concept'}
        </button>
        <button
          onClick={handlePublish}
          disabled={!isComplete || publishing || published}
          className={`flex-1 py-2 text-sm font-semibold rounded-xl transition-colors cursor-pointer disabled:opacity-40 border-0 ${
            published
              ? 'bg-green-500 text-white'
              : isComplete
              ? 'bg-[#1a5c38] text-white hover:bg-[#164d2f]'
              : 'bg-[#e5e1d8] text-[#aaa] cursor-not-allowed'
          }`}
        >
          {publishing ? 'Publiceren...' : published ? '✓ Gepubliceerd' : isComplete ? '▶ Publiceer uitslag' : 'Vul alles in'}
        </button>
      </div>
    </div>
  )
}

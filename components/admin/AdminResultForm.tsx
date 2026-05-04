'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface MatchWithTeams {
  id: string; scheduled_at: string; status: string; group_id: string | null; phase: string
  home_ft: number | null; away_ft: number | null; home_ht: number | null; away_ht: number | null
  home_yellow: number | null; away_yellow: number | null; home_red: number | null; away_red: number | null
  penalties: boolean
  home_team: { name_nl: string; flag: string } | null
  away_team: { name_nl: string; flag: string } | null
}

function N({ value, onChange, w = 44 }: { value: number | null; onChange: (v: number | null) => void; w?: number }) {
  return (
    <input type="number" min="0" max="99" value={value ?? ''} onChange={e => onChange(e.target.value === '' ? null : parseInt(e.target.value))} placeholder="–"
      className="input-score text-sm font-bold" style={{ width: w, height: 36 }} />
  )
}

export default function AdminResultForm({ match }: { match: MatchWithTeams }) {
  const supabase = createClient()
  const [v, setV] = useState({ home_ft: match.home_ft, away_ft: match.away_ft, home_ht: match.home_ht, away_ht: match.away_ht, home_yellow: match.home_yellow, away_yellow: match.away_yellow, home_red: match.home_red, away_red: match.away_red })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const s = (k: keyof typeof v, val: number | null) => setV(p => ({ ...p, [k]: val }))

  async function handleSave() {
    setSaving(true)
    const status = v.home_ft !== null && v.away_ft !== null ? 'finished' : match.status
    await supabase.from('matches').update({ ...v, status }).eq('id', match.id)
    // Trigger recalculation
    await fetch('/api/sync', { method: 'POST', headers: { authorization: `Bearer ${process.env.NEXT_PUBLIC_SYNC_SECRET || ''}` } })
    setSaved(true); setSaving(false)
    setTimeout(() => setSaved(false), 2000)
  }

  const home = match.home_team?.name_nl || '?'
  const away = match.away_team?.name_nl || '?'

  return (
    <div className={`bg-white rounded-2xl border p-4 ${match.status === 'finished' ? 'border-[#e5e1d8]' : 'border-[#e5e1d8]'}`}>
      <div className="flex justify-between items-center mb-3">
        <div className="flex gap-2 items-center">
          <span className="tag bg-[#f0ede6] text-[#888]">{match.group_id ? `Gr.${match.group_id}` : match.phase}</span>
          <span className="text-xs text-[#aaa]">
            {new Date(match.scheduled_at).toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' })}
          </span>
        </div>
        <span className={`tag ${match.status === 'finished' ? 'bg-green-100 text-green-700' : 'bg-[#f0ede6] text-[#888]'}`}>
          {match.status === 'finished' ? '✓ Gespeeld' : 'Gepland'}
        </span>
      </div>
      <div className="flex items-center gap-3 mb-3">
        <span className="flex-1 text-sm font-semibold">{match.home_team?.flag} {home}</span>
        <span className="text-xs text-[#ccc]">vs</span>
        <span className="flex-1 text-sm font-semibold text-right">{away} {match.away_team?.flag}</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[['Eindstand', 'home_ft', 'away_ft'], ['Ruststand', 'home_ht', 'away_ht'], ['🟨 Geel', 'home_yellow', 'away_yellow'], ['🟥 Rood', 'home_red', 'away_red']].map(([lbl, hk, ak]) => (
          <div key={lbl} className="bg-[#f6f4ef] rounded-xl p-3">
            <p className="text-xs font-semibold text-[#888] mb-2">{lbl}</p>
            <div className="flex items-center gap-2">
              <N value={v[hk as keyof typeof v] as number | null} onChange={val => s(hk as keyof typeof v, val)} />
              <span className="text-[#ccc] text-sm">–</span>
              <N value={v[ak as keyof typeof v] as number | null} onChange={val => s(ak as keyof typeof v, val)} />
            </div>
          </div>
        ))}
      </div>
      <button onClick={handleSave} disabled={saving}
        className={`mt-3 w-full py-2.5 text-sm font-semibold rounded-xl border-0 cursor-pointer transition-colors ${saved ? 'bg-green-100 text-green-700' : 'btn-secondary'}`}>
        {saving ? 'Opslaan...' : saved ? '✓ Opgeslagen & herberekend' : match.status === 'finished' ? 'Corrigeren & herberekenen' : 'Uitslag invoeren'}
      </button>
    </div>
  )
}

'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ScoringConfig } from '@/types'

export default function AdminScoringClient({ initialScoring }: { initialScoring: ScoringConfig[] }) {
  const supabase = createClient()
  const [scoring, setScoring] = useState(initialScoring)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const categories = [...new Set(scoring.map(s => s.category))]

  function updateValue(key: string, value: number) {
    setScoring(s => s.map(r => r.key === key ? { ...r, value } : r))
    setSaved(false)
  }

  async function handleSave() {
    setSaving(true)
    for (const row of scoring) {
      await supabase.from('scoring_config').update({ value: row.value }).eq('key', row.key)
    }
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const maxPts = scoring.filter(s => ['Wedstrijd', 'Knockout extra'].includes(s.category)).reduce((a, r) => a + r.value, 0)

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="heading text-2xl font-extrabold text-gray-900">Puntensysteem</h1>
        <button onClick={handleSave} disabled={saving}
          className={`py-2 px-5 text-sm font-semibold rounded-xl border-0 cursor-pointer transition-colors ${saved ? 'bg-green-100 text-green-700' : 'btn-primary'}`}>
          {saving ? 'Opslaan...' : saved ? '✓ Opgeslagen' : 'Opslaan'}
        </button>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800">
        ℹ️ Wijzigingen gelden voor nieuwe berekeningen. Bestaande punten worden herberekend bij de eerstvolgende sync.
      </div>

      <div className="bg-[#eaf4ef] rounded-xl px-4 py-3 text-sm font-semibold text-[#1a5c38]">
        Max per wedstrijd (incl. knockout): {maxPts} punten
      </div>

      {categories.map(cat => (
        <div key={cat} className="bg-white rounded-2xl border border-[#e5e1d8] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#f6f4ef]">
            <h2 className="text-sm font-semibold text-gray-800">{cat}</h2>
          </div>
          {scoring.filter(s => s.category === cat).map((row, i, arr) => (
            <div key={row.key} className={`flex items-center justify-between px-5 py-3.5 ${i < arr.length - 1 ? 'border-b border-[#f6f4ef]' : ''}`}>
              <span className="text-sm text-gray-700">{row.label_nl}</span>
              <div className="flex items-center gap-2">
                <input
                  type="number" min="0" max="20"
                  value={row.value}
                  onChange={e => updateValue(row.key, parseInt(e.target.value) || 0)}
                  className="input-score text-base font-bold text-[#1a5c38]"
                  style={{ width: 60, height: 38, background: '#eaf4ef' }}
                />
                <span className="text-sm text-[#aaa]">pt</span>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

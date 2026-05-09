'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { ScoringConfig } from '@/types'

export default function AdminScoringClient({ initialScoring }: { initialScoring: ScoringConfig[] }) {
  const supabase = createClient()
  const router = useRouter()
  const [scoring, setScoring] = useState(initialScoring)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [recalculating, setRecalculating] = useState(false)
  const [recalcResult, setRecalcResult] = useState<string | null>(null)

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

  async function handleRecalculate() {
    if (!confirm('Alle bestaande punten worden opnieuw berekend volgens de huidige scoring. Doorgaan?')) return
    setRecalculating(true)
    setRecalcResult(null)
    try {
      const res = await fetch('/api/admin/recalculate-all', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) {
        setRecalcResult(`Fout: ${json.error || 'onbekend'}`)
      } else {
        setRecalcResult(
          `✓ Klaar — ${json.match_predictions_updated} wedstrijdvoorspellingen, ${json.bonus_answers_updated} bonusantwoorden, ${json.group_predictions_updated} poule-voorspellingen herberekend.`
        )
        router.refresh()
      }
    } catch {
      setRecalcResult('Netwerkfout — probeer opnieuw')
    } finally {
      setRecalculating(false)
      setTimeout(() => setRecalcResult(null), 8000)
    }
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
        ℹ️ Wijzigingen gelden voor nieuwe berekeningen. Klik hieronder op &ldquo;Alle punten herberekenen&rdquo; om bestaande punten ook bij te werken.
      </div>

      <div className="bg-white border border-[#e5e1d8] rounded-2xl px-5 py-4 flex items-center justify-between flex-wrap gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-800">Alle punten herberekenen</p>
          <p className="text-xs text-[#888] mt-0.5">Past de scoring toe op alle bestaande voorspellingen en antwoorden. Veilig om vaker te draaien.</p>
        </div>
        <button
          onClick={handleRecalculate}
          disabled={recalculating}
          className="py-2 px-4 text-sm font-semibold rounded-xl bg-[#1a5c38] text-white border-0 hover:bg-[#154a2d] disabled:opacity-50 cursor-pointer"
        >
          {recalculating ? 'Bezig...' : '↻ Herbereken'}
        </button>
      </div>
      {recalcResult && (
        <div className={`rounded-xl px-4 py-3 text-xs ${recalcResult.startsWith('✓') ? 'bg-[#eaf4ef] text-[#1a5c38] border border-[#c8e6d4]' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {recalcResult}
        </div>
      )}

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

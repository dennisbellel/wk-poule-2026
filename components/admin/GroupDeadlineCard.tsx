'use client'
import { useState } from 'react'
import { formatDateTimeNL } from '@/lib/format'

// Datum naar de waarde die <input type="datetime-local"> verwacht (lokale tijd)
function toLocalInput(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function GroupDeadlineCard({ current }: { current: string | null }) {
  const [value, setValue] = useState(current ? toLocalInput(current) : '')
  const [savedDeadline, setSavedDeadline] = useState<string | null>(current)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isOpen = savedDeadline ? new Date(savedDeadline) > new Date() : false

  async function handleSave() {
    if (!value) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/group-deadline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deadline_at: new Date(value).toISOString() }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.error || 'Opslaan mislukt')
      } else {
        setSavedDeadline(json.deadline_at)
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      }
    } catch {
      setError('Netwerkfout — probeer opnieuw')
    }
    setSaving(false)
  }

  return (
    <div className="bg-white rounded-2xl border border-[#e5e1d8] p-5">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
        <h2 className="text-sm font-semibold text-gray-800">📊 Poulestand-deadline</h2>
        <span className={`tag ${isOpen ? 'bg-[#eaf4ef] text-[#1a5c38]' : 'bg-red-50 text-red-700'}`}>
          {isOpen ? '✏️ open voor deelnemers' : '🔒 op slot'}
        </span>
      </div>
      <p className="text-xs text-[#aaa] mb-3">
        Tot dit moment kunnen deelnemers hun poulestand invullen of aanpassen.
        {savedDeadline && <> Nu: <span className="font-semibold text-[#888]">{formatDateTimeNL(savedDeadline)}</span></>}
      </p>
      <div className="flex gap-2 flex-wrap">
        <input
          type="datetime-local"
          value={value}
          onChange={e => setValue(e.target.value)}
          className="border border-[#e5e1d8] rounded-lg px-3 py-2 text-sm bg-[#f6f4ef]"
        />
        <button
          onClick={handleSave}
          disabled={saving || !value}
          className={`btn-primary px-4 py-2 text-sm disabled:opacity-50 ${saved ? 'bg-green-600' : ''}`}
        >
          {saving ? 'Opslaan...' : saved ? '✓ Opgeslagen' : 'Deadline instellen'}
        </button>
      </div>
      {error && <p className="text-xs text-red-600 mt-2">⚠ {error}</p>}
    </div>
  )
}

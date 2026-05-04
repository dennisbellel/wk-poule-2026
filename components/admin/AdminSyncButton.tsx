'use client'
import { useState } from 'react'

export default function AdminSyncButton() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ matchesUpdated?: number; error?: string } | null>(null)

  async function handleSync() {
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { authorization: `Bearer ${process.env.NEXT_PUBLIC_SYNC_SECRET || ''}` },
      })
      const data = await res.json()
      setResult(data)
    } catch (e) {
      setResult({ error: String(e) })
    }
    setLoading(false)
  }

  return (
    <div className="flex items-center gap-3">
      <button onClick={handleSync} disabled={loading}
        className="btn-secondary py-2 px-4 text-sm disabled:opacity-50">
        {loading ? '⟳ Synchroniseren...' : '🔄 Handmatig synchroniseren'}
      </button>
      {result && (
        <span className={`text-sm font-semibold ${result.error ? 'text-red-500' : 'text-green-600'}`}>
          {result.error ? `✗ ${result.error}` : `✓ ${result.matchesUpdated} bijgewerkt`}
        </span>
      )}
    </div>
  )
}

'use client'
import { useState } from 'react'

export default function ResendInviteButton({ email }: { email: string }) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    if (status === 'loading' || status === 'sent') return
    if (!confirm(`Een nieuwe uitnodigingsmail sturen naar ${email}?`)) return
    setStatus('loading')
    setError(null)
    try {
      const res = await fetch('/api/admin/resend-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const json = await res.json()
      if (!res.ok) {
        setStatus('error')
        setError(json.error || 'Versturen mislukt')
        return
      }
      setStatus('sent')
      setTimeout(() => setStatus('idle'), 4000)
    } catch {
      setStatus('error')
      setError('Netwerkfout')
    }
  }

  return (
    <div className="flex flex-col items-end gap-0.5">
      <button
        onClick={handleClick}
        disabled={status === 'loading' || status === 'sent'}
        className={`px-2.5 py-1 text-xs font-semibold rounded-lg border cursor-pointer transition-colors flex-shrink-0 disabled:cursor-default ${
          status === 'sent'
            ? 'bg-[#eaf4ef] text-[#1a5c38] border-[#c8e6d4]'
            : 'bg-white text-[#1a5c38] border-[#c8e6d4] hover:bg-[#eaf4ef] disabled:opacity-60'
        }`}
      >
        {status === 'loading' ? 'Versturen...' : status === 'sent' ? '✓ Verstuurd' : '↻ Opnieuw versturen'}
      </button>
      {status === 'error' && error && (
        <span className="text-[10px] text-red-600">{error}</span>
      )}
    </div>
  )
}

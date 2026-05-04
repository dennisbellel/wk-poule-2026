'use client'
import { useState } from 'react'

export default function AdminInviteForm() {
  const [open, setOpen] = useState(false)
  const [emails, setEmails] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<Array<{ email: string; status: string }>>([])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const emailList = emails.split(/[\n,;]+/).map(e => e.trim()).filter(Boolean)
    const res = await fetch('/api/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emails: emailList }),
    })
    const data = await res.json()
    setResults(data.results || [])
    setLoading(false)
    setEmails('')
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-primary py-2 px-4 text-sm">
        + Uitnodigen
      </button>
      {open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="heading text-lg font-bold">Deelnemers uitnodigen</h2>
              <button onClick={() => { setOpen(false); setResults([]) }} className="text-[#aaa] text-xl border-0 bg-transparent cursor-pointer">×</button>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4 text-xs text-amber-800">
              🔒 Alleen uitgenodigde e-mailadressen kunnen een account aanmaken.
            </div>
            {results.length > 0 ? (
              <div className="space-y-2 mb-4">
                {results.map(r => (
                  <div key={r.email} className={`flex justify-between text-sm px-3 py-2 rounded-lg ${r.status === 'invited' ? 'bg-green-50 text-green-700' : r.status === 'already_registered' ? 'bg-blue-50 text-blue-700' : 'bg-red-50 text-red-700'}`}>
                    <span>{r.email}</span>
                    <span>{r.status === 'invited' ? '✓ Verstuurd' : r.status === 'already_registered' ? 'Al geregistreerd' : '✗ Fout'}</span>
                  </div>
                ))}
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <label className="block text-xs font-semibold text-[#888] uppercase tracking-wide mb-1.5">
                  E-mailadressen (komma, puntkomma of enter)
                </label>
                <textarea
                  value={emails}
                  onChange={e => setEmails(e.target.value)}
                  rows={5}
                  placeholder={"jan@gmail.com\npiet@hotmail.com\nsara@icloud.com"}
                  className="w-full border border-[#e5e1d8] rounded-xl p-3 text-sm bg-[#f6f4ef] outline-none focus:border-[#1a5c38] resize-none font-sans mb-3"
                />
                <button type="submit" disabled={loading || !emails.trim()} className="btn-primary w-full py-3 disabled:opacity-50">
                  {loading ? 'Versturen...' : 'Uitnodigingen versturen →'}
                </button>
              </form>
            )}
            {results.length > 0 && (
              <button onClick={() => { setOpen(false); setResults([]) }} className="btn-secondary w-full py-3 mt-2">
                Sluiten
              </button>
            )}
          </div>
        </div>
      )}
    </>
  )
}

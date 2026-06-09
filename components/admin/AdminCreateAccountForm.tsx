'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

type CreateResult = {
  ok?: boolean
  email?: string
  display_name?: string
  temporary_password?: string
  error?: string
}

export default function AdminCreateAccountForm() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<CreateResult | null>(null)
  const [copied, setCopied] = useState(false)

  function reset() {
    setEmail('')
    setName('')
    setPassword('')
    setResult(null)
    setCopied(false)
  }

  function close() {
    setOpen(false)
    setTimeout(reset, 200)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/admin/create-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, displayName: name, password: password || undefined }),
      })
      const json = await res.json() as CreateResult
      setResult(json)
      if (res.ok) router.refresh()
    } catch {
      setResult({ error: 'Netwerkfout' })
    } finally {
      setLoading(false)
    }
  }

  async function copyAll() {
    if (!result?.email || !result.temporary_password) return
    const text = `Inloggegevens Dé WK Poule 2026

E-mail: ${result.email}
Tijdelijk wachtwoord: ${result.temporary_password}

Log in op de site en kies daarna direct je eigen wachtwoord.`
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="px-3 py-2 text-sm font-semibold rounded-xl border border-[#c8e6d4] bg-white text-[#1a5c38] hover:bg-[#eaf4ef] cursor-pointer"
      >
        + Direct aanmaken
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-[#f6f4ef] flex items-center justify-between">
              <h2 className="heading text-lg font-bold">Direct account aanmaken</h2>
              <button onClick={close} className="text-gray-400 hover:text-gray-600 text-xl cursor-pointer">✕</button>
            </div>

            {!result?.ok ? (
              <form onSubmit={submit} className="px-6 py-5 space-y-4">
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800">
                  Voor gebruikers waarbij de uitnodigingslink niet werkt. Je krijgt na aanmaken een tijdelijk wachtwoord om door te sturen.
                </div>

                {result?.error && (
                  <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
                    {result.error}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-[#888] mb-1.5 uppercase tracking-wide">E-mailadres</label>
                  <input
                    type="email" required value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="naam@voorbeeld.nl"
                    className="w-full border border-[#e5e1d8] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#1a5c38] bg-[#f6f4ef]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#888] mb-1.5 uppercase tracking-wide">Naam (zichtbaar in de app)</label>
                  <input
                    type="text" required maxLength={30} value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Opa Marinus"
                    className="w-full border border-[#e5e1d8] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#1a5c38] bg-[#f6f4ef]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#888] mb-1.5 uppercase tracking-wide">Tijdelijk wachtwoord (optioneel)</label>
                  <input
                    type="text" value={password} minLength={password ? 8 : undefined}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Laat leeg om automatisch te genereren"
                    className="w-full border border-[#e5e1d8] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#1a5c38] bg-[#f6f4ef] font-mono"
                  />
                  <p className="text-[11px] text-[#aaa] mt-1.5">Minimaal 8 tekens. Leeg = systeem genereert iets uitspreekbaars.</p>
                </div>

                <div className="flex gap-2 pt-1">
                  <button type="button" onClick={close}
                    className="flex-1 py-2.5 text-sm font-semibold bg-white border border-[#e5e1d8] text-gray-600 rounded-xl hover:bg-[#f6f4ef] cursor-pointer">
                    Annuleren
                  </button>
                  <button type="submit" disabled={loading}
                    className="flex-1 py-2.5 text-sm font-semibold bg-[#1a5c38] text-white rounded-xl hover:bg-[#164d2f] border-0 cursor-pointer disabled:opacity-50">
                    {loading ? 'Aanmaken...' : 'Account aanmaken'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="px-6 py-5 space-y-4">
                <div className="bg-[#eaf4ef] border border-[#c8e6d4] rounded-xl px-4 py-3 text-sm">
                  <p className="font-semibold text-[#1a5c38] mb-1">✓ Account aangemaakt</p>
                  <p className="text-xs text-[#1a4a2e]">Stuur deze gegevens veilig naar de gebruiker (WhatsApp, SMS, of mondeling). Hij kan direct inloggen en kiest daarna zelf zijn wachtwoord.</p>
                </div>

                <div className="bg-[#f6f4ef] rounded-xl p-4 space-y-2">
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-[#888] font-semibold">E-mail</p>
                    <p className="text-sm font-medium text-gray-900 break-all">{result.email}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-[#888] font-semibold">Tijdelijk wachtwoord</p>
                    <p className="text-base font-mono font-bold text-[#1a5c38]">{result.temporary_password}</p>
                  </div>
                </div>

                <button onClick={copyAll}
                  className={`w-full py-2.5 text-sm font-semibold rounded-xl border cursor-pointer transition-colors ${
                    copied
                      ? 'bg-[#eaf4ef] text-[#1a5c38] border-[#c8e6d4]'
                      : 'bg-white text-[#1a5c38] border-[#c8e6d4] hover:bg-[#eaf4ef]'
                  }`}>
                  {copied ? '✓ Gekopieerd' : '📋 Kopieer inloggegevens'}
                </button>

                <button onClick={close}
                  className="w-full py-2.5 text-sm font-semibold bg-white border border-[#e5e1d8] text-gray-600 rounded-xl cursor-pointer">
                  Sluiten
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

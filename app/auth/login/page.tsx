'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Wachtwoord-reset modal
  const [showReset, setShowReset] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const [resetMessage, setResetMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  const supabase = createClient()
  const router = useRouter()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('Ongeldig e-mailadres of wachtwoord')
      setLoading(false)
    } else {
      router.push('/')
      router.refresh()
    }
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    if (!resetEmail) return
    setResetLoading(true)
    setResetMessage(null)
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/auth/callback?next=/auth/register`,
    })
    setResetLoading(false)
    if (error) {
      setResetMessage({ kind: 'error', text: 'Versturen mislukt — probeer opnieuw' })
    } else {
      setResetMessage({ kind: 'success', text: 'Reset-link verstuurd. Check je inbox.' })
    }
  }

  return (
    <div className="min-h-screen bg-[#f6f4ef] flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="heading text-3xl font-extrabold text-[#1a5c38] mb-1">Dé WK Poule</h1>
          <p className="text-sm text-[#aaa]">FIFA World Cup 2026</p>
        </div>

        <div className="bg-white rounded-2xl border border-[#e5e1d8] p-6">
          <h2 className="heading text-xl font-bold text-gray-900 mb-5">Inloggen</h2>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#888] mb-1.5 uppercase tracking-wide">
                E-mailadres
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="jij@email.com"
                className="w-full border border-[#e5e1d8] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#1a5c38] transition-colors bg-[#f6f4ef]"
              />
            </div>
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-xs font-semibold text-[#888] uppercase tracking-wide">
                  Wachtwoord
                </label>
                <button
                  type="button"
                  onClick={() => { setResetEmail(email); setShowReset(true); setResetMessage(null) }}
                  className="text-xs text-[#1a5c38] hover:underline cursor-pointer border-0 bg-transparent"
                >
                  Vergeten?
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full border border-[#e5e1d8] rounded-xl px-4 py-3 pr-11 text-sm outline-none focus:border-[#1a5c38] transition-colors bg-[#f6f4ef]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(s => !s)}
                  aria-label={showPassword ? 'Verberg wachtwoord' : 'Toon wachtwoord'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#888] hover:text-gray-700 cursor-pointer border-0 bg-transparent text-base"
                >
                  {showPassword ? '🙈' : '👁'}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary py-3.5 text-sm disabled:opacity-50"
            >
              {loading ? 'Bezig...' : 'Inloggen →'}
            </button>
          </form>

          <p className="text-xs text-[#aaa] text-center mt-4">
            Nog geen account? Je hebt een uitnodiging nodig — vraag de organisator van de poule om je toe te voegen.
          </p>
        </div>
      </div>

      {/* Wachtwoord reset modal */}
      {showReset && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <h3 className="heading text-lg font-extrabold text-gray-900 mb-1">Wachtwoord vergeten</h3>
            <p className="text-sm text-[#888] mb-4">Vul je e-mail in en we sturen een reset-link.</p>

            {resetMessage && (
              <div className={`rounded-xl p-3 mb-3 text-sm ${
                resetMessage.kind === 'success' ? 'bg-[#eaf4ef] text-[#1a5c38]' : 'bg-red-50 text-red-700'
              }`}>
                {resetMessage.text}
              </div>
            )}

            <form onSubmit={handleReset} className="space-y-3">
              <input
                type="email"
                value={resetEmail}
                onChange={e => setResetEmail(e.target.value)}
                required
                placeholder="jij@email.com"
                className="w-full border border-[#e5e1d8] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#1a5c38] bg-[#f6f4ef]"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowReset(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-[#e5e1d8] bg-white text-gray-600 hover:bg-[#f6f4ef] cursor-pointer"
                >
                  Annuleren
                </button>
                <button
                  type="submit"
                  disabled={resetLoading}
                  className="flex-1 btn-primary py-2.5 text-sm disabled:opacity-50"
                >
                  {resetLoading ? 'Versturen...' : 'Verstuur'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

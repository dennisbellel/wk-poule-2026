'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
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

  return (
    <div className="min-h-screen bg-[#f6f4ef] flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
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
              <label className="block text-xs font-semibold text-[#888] mb-1.5 uppercase tracking-wide">
                Wachtwoord
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full border border-[#e5e1d8] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#1a5c38] transition-colors bg-[#f6f4ef]"
              />
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
            Nog geen account? Je hebt een uitnodiging nodig.
          </p>
        </div>
      </div>
    </div>
  )
}

'use client'
import { useState, useEffect, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

function RegisterForm() {
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [email, setEmail] = useState('')
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user.email) setEmail(data.session.user.email)
    })
  }, [])

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    if (password !== password2) {
      setError('Wachtwoorden komen niet overeen')
      return
    }
    if (password.length < 8) {
      setError('Wachtwoord moet minimaal 8 tekens zijn')
      return
    }
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.updateUser({
      password,
      data: { display_name: displayName },
    })

    if (error) {
      setError(
        error.message === 'New password should be different from the old password'
          ? 'Kies een wachtwoord dat je nog niet eerder gebruikt hebt'
          : error.message
      )
      setLoading(false)
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('profiles').upsert(
        { id: user.id, email: user.email!, display_name: displayName, is_admin: false },
        { onConflict: 'id' }
      )
    }

    router.push('/')
    router.refresh()
  }

  return (
    <div className="bg-white rounded-2xl border border-[#e5e1d8] p-6">
      <h2 className="heading text-xl font-bold text-gray-900 mb-2">Welkom!</h2>
      {email && (
        <p className="text-sm text-[#888] mb-5">
          Je registreert als <strong>{email}</strong>
        </p>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 text-sm text-red-700">
          {error}
        </div>
      )}
      <form onSubmit={handleRegister} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-[#888] mb-1.5 uppercase tracking-wide">
            Naam (zichtbaar voor anderen)
          </label>
          <input
            type="text"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            required
            maxLength={30}
            placeholder="Bijv. Sander"
            className="w-full border border-[#e5e1d8] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#1a5c38] bg-[#f6f4ef]"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#888] mb-1.5 uppercase tracking-wide">
            Wachtwoord kiezen
          </label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={8}
            placeholder="Minimaal 8 tekens"
            className="w-full border border-[#e5e1d8] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#1a5c38] bg-[#f6f4ef]"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#888] mb-1.5 uppercase tracking-wide">
            Herhaal wachtwoord
          </label>
          <input
            type="password"
            value={password2}
            onChange={e => setPassword2(e.target.value)}
            required
            placeholder="••••••••"
            className="w-full border border-[#e5e1d8] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#1a5c38] bg-[#f6f4ef]"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full btn-primary py-3.5 disabled:opacity-50"
        >
          {loading ? 'Account aanmaken...' : 'Account aanmaken →'}
        </button>
      </form>
    </div>
  )
}

export default function RegisterPage() {
  return (
    <div className="min-h-screen bg-[#f6f4ef] flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="heading text-3xl font-extrabold text-[#1a5c38] mb-1">
            Dé WK Poule
          </h1>
          <p className="text-sm text-[#aaa]">Maak je account aan</p>
        </div>
        <Suspense
          fallback={
            <div className="text-center text-sm text-[#aaa]">Laden...</div>
          }
        >
          <RegisterForm />
        </Suspense>
      </div>
    </div>
  )
}

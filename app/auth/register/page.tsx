'use client'
import { useState, useEffect, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

function RegisterForm() {
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [email, setEmail] = useState('')
  const supabase = createClient()
  const router = useRouter()
  const [sessionChecked, setSessionChecked] = useState(false)
  const [alreadyOnboarded, setAlreadyOnboarded] = useState(false)

  useEffect(() => {
    async function checkSession() {
      const { data } = await supabase.auth.getSession()
      const session = data.session
      if (!session?.user) {
        // Geen sessie — invite-link niet correct geopend
        setSessionChecked(true)
        return
      }
      const userEmail = session.user.email ?? ''
      setEmail(userEmail)

      // Detecteer of dit een gewone (al volledig geregistreerde) gebruiker is
      // ipv een verse uitnodiging. Bij een uitnodiging is recovery-flow actief en heeft
      // de user nog geen aangemaakte profiel-rij.
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', session.user.id)
        .maybeSingle()

      if (existingProfile?.display_name) {
        // Deze gebruiker is al volledig geregistreerd — register-flow zou zijn wachtwoord
        // overschrijven. Stuur naar de app of forceer eerst logout.
        setAlreadyOnboarded(true)
      }
      setSessionChecked(true)
    }
    checkSession()
  }, [])

  async function handleSignOutAndReturn() {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

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
      // Check of er al een profiel bestaat — zo ja, alleen displayName updaten en is_admin niet aanraken
      const { data: existing } = await supabase
        .from('profiles').select('id').eq('id', user.id).maybeSingle()

      if (existing) {
        await supabase.from('profiles')
          .update({ display_name: displayName, email: user.email! })
          .eq('id', user.id)
      } else {
        await supabase.from('profiles').insert({
          id: user.id, email: user.email!, display_name: displayName, is_admin: false,
        })
      }
    }

    router.push('/')
    router.refresh()
  }

  // Wachten tot we weten of de sessie geldig is voor registratie
  if (!sessionChecked) {
    return (
      <div className="bg-white rounded-2xl border border-[#e5e1d8] p-6 text-center text-sm text-[#aaa]">
        Laden...
      </div>
    )
  }

  // Als de huidige sessie al een volledig geregistreerd account is: blokkeer het formulier
  if (alreadyOnboarded) {
    return (
      <div className="bg-white rounded-2xl border border-[#e5e1d8] p-6">
        <h2 className="heading text-xl font-bold text-gray-900 mb-2">Eerst uitloggen</h2>
        <p className="text-sm text-gray-700 mb-3">
          Je bent al ingelogd als <strong>{email}</strong>.
        </p>
        <p className="text-sm text-gray-700 mb-5">
          Om een nieuw account aan te maken via een uitnodigingslink moet je eerst uitloggen. Klik daarna opnieuw op de link in je uitnodigingsmail.
        </p>
        <button
          onClick={handleSignOutAndReturn}
          className="w-full btn-primary py-3"
        >
          Uitloggen →
        </button>
      </div>
    )
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
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={8}
              placeholder="••••••••"
              className="w-full border border-[#e5e1d8] rounded-xl px-4 py-3 pr-11 text-sm outline-none focus:border-[#1a5c38] bg-[#f6f4ef]"
            />
            <button
              type="button"
              onClick={() => setShowPassword(s => !s)}
              aria-label={showPassword ? 'Verberg wachtwoord' : 'Toon wachtwoord'}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#888] cursor-pointer border-0 bg-transparent text-base"
            >
              {showPassword ? '🙈' : '👁'}
            </button>
          </div>
          <p className="text-[11px] text-[#aaa] mt-1.5">Minimaal 8 tekens.</p>
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#888] mb-1.5 uppercase tracking-wide">
            Herhaal wachtwoord
          </label>
          <input
            type={showPassword ? 'text' : 'password'}
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

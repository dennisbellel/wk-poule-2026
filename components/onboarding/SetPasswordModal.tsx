'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// Verplichte modal die verschijnt zodra een gebruiker is ingelogd maar nog geen
// wachtwoord heeft ingesteld (password_set = false). Niet weg te klikken: de
// gebruiker MOET een naam + wachtwoord kiezen voordat hij de app kan gebruiken.
export default function SetPasswordModal({
  email, currentName, onDone,
}: {
  email: string
  currentName: string
  onDone: () => void
}) {
  const supabase = createClient()
  // Begin altijd met een leeg naamveld; de "currentName" is meestal het e-mail-deel
  // (uit de DB-trigger / fallback), wat we niet als echte voornaam willen voorvullen.
  void currentName
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!displayName.trim()) { setError('Vul je naam in'); return }
    if (password.length < 8) { setError('Wachtwoord moet minimaal 8 tekens zijn'); return }
    if (password !== password2) { setError('Wachtwoorden komen niet overeen'); return }

    setLoading(true)
    setError('')

    const { error: updErr } = await supabase.auth.updateUser({
      password,
      data: { display_name: displayName },
    })
    if (updErr) {
      setError(
        updErr.message === 'New password should be different from the old password'
          ? 'Kies een wachtwoord dat je nog niet eerder gebruikt hebt'
          : updErr.message
      )
      setLoading(false)
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('profiles')
        .update({ display_name: displayName, password_set: true })
        .eq('id', user.id)
    }

    onDone()
    // Hard refresh zodat alle server components de nieuwe naam/state oppikken
    window.location.href = '/'
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-[80] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="bg-[#1a5c38] px-6 py-5">
          <div className="text-3xl mb-1">👋</div>
          <h2 className="heading text-xl font-extrabold text-white">Welkom! Maak je account af</h2>
          <p className="text-white/70 text-sm mt-1">
            Kies een naam en wachtwoord, dan kun je meedoen aan de poule.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <p className="text-xs text-[#888]">
            Je doet mee met <strong className="text-gray-700">{email}</strong>
          </p>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
              {error}
            </div>
          )}

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
            {loading ? 'Bezig...' : 'Account afmaken →'}
          </button>
        </form>
      </div>
    </div>
  )
}

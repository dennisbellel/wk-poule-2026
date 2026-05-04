'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { Profile } from '@/types'

export default function ProfileClient({
  profile, lbEntry, totalUsers, predCount, totalMatches,
}: {
  profile: Profile | null
  lbEntry: { total_points: number; match_points: number; group_points: number; bonus_points: number; rank: number } | null
  totalUsers: number
  predCount: number
  totalMatches: number
}) {
  const supabase = createClient()
  const router = useRouter()
  const [displayName, setDisplayName] = useState(profile?.display_name || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  async function handleSaveName(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await supabase.from('profiles').update({ display_name: displayName }).eq('id', profile!.id)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const pct = predCount && lbEntry ? Math.round((lbEntry.match_points / Math.max(predCount * 5, 1)) * 100) : 0

  return (
    <div>
      <div className="hidden lg:block px-8 py-5 bg-white border-b border-[#e5e1d8]">
        <h1 className="heading text-xl font-extrabold text-[#1a5c38]">Profiel</h1>
      </div>

      <div className="p-4 lg:p-8 max-w-lg space-y-4">
        {/* Profile card */}
        <div className="card p-6 text-center">
          <div className="w-16 h-16 rounded-full bg-[#1a5c38] flex items-center justify-center mx-auto mb-3">
            <span className="heading text-2xl font-extrabold text-white">
              {profile?.display_name?.[0] || '?'}
            </span>
          </div>
          <h2 className="heading text-xl font-extrabold text-gray-900 mb-1">{profile?.display_name}</h2>
          <p className="text-sm text-[#aaa] mb-5">{profile?.email}</p>
          <div className="grid grid-cols-3 gap-3">
            {[
              [String(lbEntry?.total_points ?? 0), 'punten'],
              [lbEntry ? `${lbEntry.rank}/${totalUsers}` : '—', 'positie'],
              [`${pct}%`, 'goed'],
            ].map(([val, lbl]) => (
              <div key={lbl} className="bg-[#eaf4ef] rounded-xl py-3">
                <p className="heading text-xl font-extrabold text-[#1a5c38]">{val}</p>
                <p className="text-xs text-[#aaa]">{lbl}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Points breakdown */}
        {lbEntry && (
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-[#f6f4ef]">
              <p className="text-sm font-semibold">Punten breakdown</p>
            </div>
            {[['⚽ Wedstrijden', lbEntry.match_points], ['📊 Poulestand', lbEntry.group_points], ['🎯 Bonusvragen', lbEntry.bonus_points]].map(([lbl, val]) => (
              <div key={String(lbl)} className="flex justify-between px-4 py-3 border-b border-[#f6f4ef] last:border-0">
                <span className="text-sm text-gray-600">{lbl}</span>
                <span className="text-sm font-semibold">{val} pt</span>
              </div>
            ))}
          </div>
        )}

        {/* Edit name */}
        <div className="card p-4">
          <p className="text-sm font-semibold mb-3">Weergavenaam</p>
          <form onSubmit={handleSaveName} className="flex gap-2">
            <input
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              maxLength={30}
              className="flex-1 border border-[#e5e1d8] rounded-xl px-4 py-2.5 text-sm bg-[#f6f4ef] outline-none focus:border-[#1a5c38]"
            />
            <button type="submit" disabled={saving || saved}
              className={`px-4 py-2.5 rounded-xl text-sm font-semibold border-0 cursor-pointer transition-colors ${
                saved ? 'bg-green-100 text-green-700' : 'btn-primary'
              }`}>
              {saving ? '...' : saved ? '✓' : 'Opslaan'}
            </button>
          </form>
        </div>

        {/* Logout */}
        <button onClick={handleLogout}
          className="w-full bg-white border border-red-200 rounded-2xl py-3.5 text-sm font-semibold text-red-500 flex items-center justify-center gap-2 cursor-pointer hover:bg-red-50 transition-colors">
          🚪 Uitloggen
        </button>
      </div>
    </div>
  )
}

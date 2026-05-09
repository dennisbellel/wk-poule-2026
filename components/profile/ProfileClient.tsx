'use client'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { Profile } from '@/types'

export default function ProfileClient({
  profile, lbEntry, totalUsers, predCount, totalMatches, correctInputs, totalInputs,
}: {
  profile: Profile | null
  lbEntry: { total_points: number; match_points: number; group_points: number; bonus_points: number; rank: number } | null
  totalUsers: number
  predCount: number
  totalMatches: number
  correctInputs: number
  totalInputs: number
}) {
  const supabase = createClient()
  const router = useRouter()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const correctPct = totalInputs > 0 ? Math.round((correctInputs / totalInputs) * 100) : 0

  return (
    <div>
      <div className="hidden lg:block px-8 py-5 bg-white border-b border-[#e5e1d8]">
        <h1 className="heading text-xl font-extrabold text-[#1a5c38]">Profiel</h1>
      </div>

      <div className="p-4 lg:p-8">
        <div className="max-w-lg mx-auto space-y-4">
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
                [String(lbEntry?.total_points ?? 0), 'punten', null],
                [lbEntry?.rank ? `${lbEntry.rank}/${totalUsers}` : '—', 'positie', null],
                [String(correctInputs), 'goed', `${correctPct}%`],
              ].map(([val, lbl, sub]) => (
                <div key={lbl} className="bg-[#eaf4ef] rounded-xl py-3 px-2">
                  <p className="heading text-xl font-extrabold text-[#1a5c38]">{val}</p>
                  <p className="text-xs text-[#aaa]">{lbl}</p>
                  {sub && <p className="text-[10px] text-[#aaa] mt-0.5">{sub}</p>}
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
              {[
                ['⚽ Wedstrijden', lbEntry.match_points],
                ['📊 Poulestand', lbEntry.group_points],
                ['🎯 Bonusvragen', lbEntry.bonus_points],
              ].map(([lbl, val]) => (
                <div key={String(lbl)} className="flex justify-between px-4 py-3 border-b border-[#f6f4ef] last:border-0">
                  <span className="text-sm text-gray-600">{lbl}</span>
                  <span className="text-sm font-semibold">{val} pt</span>
                </div>
              ))}
            </div>
          )}

          {/* Account info */}
          <div className="card p-4">
            <p className="text-sm font-semibold mb-1">Accountgegevens</p>
            <p className="text-xs text-[#aaa] mb-3">Je weergavenaam is ingesteld bij registratie en kan niet worden gewijzigd.</p>
            <div className="space-y-2">
              <div className="flex justify-between items-center py-2 border-b border-[#f6f4ef]">
                <span className="text-sm text-gray-500">Naam</span>
                <span className="text-sm font-semibold text-gray-900">{profile?.display_name}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-sm text-gray-500">E-mail</span>
                <span className="text-sm text-gray-600">{profile?.email}</span>
              </div>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="w-full bg-white border border-red-200 rounded-2xl py-3.5 text-sm font-semibold text-red-500 flex items-center justify-center gap-2 cursor-pointer hover:bg-red-50 transition-colors"
          >
            🚪 Uitloggen
          </button>
        </div>
      </div>
    </div>
  )
}

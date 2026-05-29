'use client'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { Profile } from '@/types'

export default function ProfileClient({ profile }: { profile: Profile | null }) {
  const supabase = createClient()
  const router = useRouter()

  async function handleLogout() {
    if (!confirm('Weet je zeker dat je wilt uitloggen?')) return
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  return (
    <div>
      <div className="hidden lg:block px-8 py-5 bg-white border-b border-[#e5e1d8]">
        <h1 className="heading text-xl font-extrabold text-[#1a5c38]">Profiel</h1>
      </div>

      <div className="p-4 lg:p-8">
        <div className="max-w-lg mx-auto space-y-4">
          {/* Profile header */}
          <div className="card p-6 text-center">
            <div className="w-16 h-16 rounded-full bg-[#1a5c38] flex items-center justify-center mx-auto mb-3">
              <span className="heading text-2xl font-extrabold text-white">
                {profile?.display_name?.[0] || '?'}
              </span>
            </div>
            <h2 className="heading text-xl font-extrabold text-gray-900 mb-1">{profile?.display_name}</h2>
            <p className="text-sm text-[#aaa]">{profile?.email}</p>
          </div>

          {/* Help / rondleiding — vooral voor mobile, waar de help-knop niet in de header staat */}
          <button
            onClick={() => window.dispatchEvent(new Event('open-help'))}
            className="w-full bg-white border border-[#e5e1d8] rounded-2xl py-3.5 text-sm font-semibold text-gray-700 flex items-center justify-center gap-2 cursor-pointer hover:bg-[#f6f4ef] transition-colors"
          >
            ❓ Bekijk de rondleiding
          </button>

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

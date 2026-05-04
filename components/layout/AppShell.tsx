'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { Profile } from '@/types'
import WizardModal from '@/components/predict/WizardModal'
import { createClient } from '@/lib/supabase/client'

const NAV_ITEMS = [
  { href: '/', icon: '⚡', label: 'Home', mobileLabel: 'Home' },
  { href: '/predict', icon: '✏️', label: 'Voorspellingen', mobileLabel: 'Voorspel' },
  { href: '/stand', icon: '🏆', label: 'Tussenstand', mobileLabel: 'Stand' },
  { href: '/stats', icon: '📈', label: 'Statistieken', mobileLabel: 'Stats' },
  { href: '/profile', icon: '👤', label: 'Profiel', mobileLabel: 'Profiel' },
]

export default function AppShell({ profile, children }: { profile: Profile | null; children: React.ReactNode }) {
  const pathname = usePathname()
  const [showWizard, setShowWizard] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    async function checkWizard() {
      if (!profile) return
      // Show wizard if user has no bonus answers yet
      const { count } = await supabase
        .from('bonus_answers')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', profile.id)
      if (count === 0) setShowWizard(true)
    }
    checkWizard()
  }, [profile])

  return (
    <div className="flex min-h-screen bg-[#f6f4ef]">
      <aside className="hidden lg:flex w-60 flex-col bg-white border-r border-[#e5e1d8] sticky top-0 h-screen">
        <div className="px-6 py-6 border-b border-[#e5e1d8]">
          <span className="heading block text-lg font-extrabold text-[#1a5c38]">Dé WK Poule</span>
          <span className="text-xs text-[#aaa]">FIFA World Cup 2026</span>
        </div>
        <nav className="flex-1 p-3 space-y-0.5">
          {NAV_ITEMS.map(item => {
            const active = pathname === item.href
            return (
              <Link key={item.href} href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  active ? 'bg-[#eaf4ef] text-[#1a5c38] font-semibold' : 'text-gray-500 hover:bg-[#f6f4ef]'
                }`}>
                <span className="text-base w-5 text-center">{item.icon}</span>
                {item.label}
              </Link>
            )
          })}
        </nav>
        {profile && (
          <div className="p-4 border-t border-[#e5e1d8] flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#1a5c38] flex items-center justify-center flex-shrink-0">
              <span className="heading text-xs font-bold text-white">{profile.display_name[0]}</span>
            </div>
            <div className="min-w-0">
              <span className="block text-sm font-semibold truncate">{profile.display_name}</span>
              <span className="block text-xs text-[#aaa] truncate">{profile.email}</span>
            </div>
          </div>
        )}
      </aside>

      <main className="flex-1 min-w-0 pb-20 lg:pb-0">
        {children}
      </main>

      <nav className="lg:hidden fixed bottom-0 inset-x-0 bg-white border-t border-[#e5e1d8] flex z-50 pb-safe">
        {NAV_ITEMS.map(item => {
          const active = pathname === item.href
          return (
            <Link key={item.href} href={item.href}
              className="flex-1 flex flex-col items-center pt-2.5 pb-1 gap-0.5">
              <span className="text-[18px]">{item.icon}</span>
              <span className={`text-[9px] ${active ? 'font-semibold text-[#1a5c38]' : 'font-normal text-[#ccc]'}`}>
                {item.mobileLabel}
              </span>
              {active && <div className="w-1 h-1 rounded-full bg-[#1a5c38]" />}
            </Link>
          )
        })}
      </nav>

      {showWizard && <WizardModal onClose={() => setShowWizard(false)} />}
    </div>
  )
}
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

const ADMIN_NAV = [
  { href: '/admin', label: '📊 Overzicht' },
  { href: '/admin/members', label: '👥 Deelnemers' },
  { href: '/admin/results', label: '⚽ Uitslagen' },
  { href: '/admin/bonus', label: '🎯 Bonusvragen' },
  { href: '/admin/scoring', label: '⚙️ Puntensysteem' },
]

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin) redirect('/')

  return (
    <div className="min-h-screen bg-[#f6f4ef] font-sans">
      <div className="bg-[#1a1a1a] px-6 py-4 flex items-center justify-between">
        <div>
          <span className="heading text-lg font-extrabold text-white">Admin</span>
          <span className="text-sm text-[#666] ml-2">Dé WK Poule 2026</span>
        </div>
        <Link href="/" className="text-sm font-semibold text-[#888] hover:text-white transition-colors">
          → Naar de app
        </Link>
      </div>
      <div className="bg-[#111] border-b border-[#222] px-4 flex overflow-x-auto">
        {ADMIN_NAV.map(item => (
          <Link key={item.href} href={item.href}
            className="flex-shrink-0 px-4 py-3 text-sm font-medium text-[#888] hover:text-white transition-colors border-b-2 border-transparent hover:border-[#1a5c38]">
            {item.label}
          </Link>
        ))}
      </div>
      <main className="p-6 lg:p-8">{children}</main>
    </div>
  )
}
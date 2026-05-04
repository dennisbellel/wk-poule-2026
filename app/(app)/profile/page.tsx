import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ProfileClient from '@/components/profile/ProfileClient'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  const { data: lbEntry } = await supabase.from('leaderboard').select('*').eq('user_id', user.id).single()
  const { count: totalUsers } = await supabase.from('profiles').select('*', { count: 'exact', head: true })
  const { count: predCount } = await supabase.from('match_predictions').select('*', { count: 'exact', head: true }).eq('user_id', user.id)
  const { count: totalMatches } = await supabase.from('matches').select('*', { count: 'exact', head: true }).eq('phase', 'group')

  return (
    <ProfileClient
      profile={profile}
      lbEntry={lbEntry}
      totalUsers={totalUsers || 0}
      predCount={predCount || 0}
      totalMatches={totalMatches || 48}
    />
  )
}

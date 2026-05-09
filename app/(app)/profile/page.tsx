import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ProfileClient from '@/components/profile/ProfileClient'
import { sortLeaderboard } from '@/lib/points/calculate'

export const dynamic = 'force-dynamic'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()

  // Rank via sortLeaderboard — zelfde als dashboard
  const { data: lbRaw } = await supabase.from('leaderboard').select('*').order('total_points', { ascending: false })
  const leaderboard = sortLeaderboard(lbRaw || [])
  const lbEntry = leaderboard.find(e => e.user_id === user.id) ?? null

  const { count: totalUsers } = await supabase.from('profiles').select('*', { count: 'exact', head: true })
  const { count: predCount } = await supabase.from('match_predictions').select('*', { count: 'exact', head: true }).eq('user_id', user.id)
  const { count: totalMatches } = await supabase.from('matches').select('*', { count: 'exact', head: true }).eq('phase', 'group')

  // Granulaire correcte inputs — zelfde logica als dashboard
  const { data: myPredictions } = await supabase
    .from('match_predictions')
    .select('home_ft, away_ft, home_ht, away_ht, home_yellow, away_yellow, home_red, away_red, match:match_id(home_ft, away_ft, home_ht, away_ht, home_yellow, away_yellow, home_red, away_red, status)')
    .eq('user_id', user.id)

  const { data: myBonusAnswers } = await supabase
    .from('bonus_answers')
    .select('answer, question:question_id(correct_answer)')
    .eq('user_id', user.id)

  let correctInputs = 0
  let totalInputs = 0

  for (const pred of myPredictions || []) {
    const matchData = Array.isArray(pred.match) ? pred.match[0] : pred.match
    const m = matchData as { home_ft: number | null; away_ft: number | null; home_ht: number | null; away_ht: number | null; home_yellow: number | null; away_yellow: number | null; home_red: number | null; away_red: number | null; status: string } | null
    if (!m || m.status !== 'finished') continue
    const fields: Array<[unknown, unknown]> = [
      [pred.home_ft, m.home_ft], [pred.away_ft, m.away_ft],
      [pred.home_ht, m.home_ht], [pred.away_ht, m.away_ht],
      [pred.home_yellow, m.home_yellow], [pred.away_yellow, m.away_yellow],
      [pred.home_red, m.home_red], [pred.away_red, m.away_red],
    ]
    for (const [p, a] of fields) {
      if (p !== null && p !== undefined && a !== null && a !== undefined) {
        totalInputs++
        if (p === a) correctInputs++
      }
    }
  }

  for (const ans of myBonusAnswers || []) {
    const questionData = Array.isArray(ans.question) ? ans.question[0] : ans.question
    const q = questionData as { correct_answer: string | null } | null
    if (!q?.correct_answer) continue
    totalInputs++
    if (ans.answer?.trim().toLowerCase() === q.correct_answer.trim().toLowerCase()) correctInputs++
  }

  return (
    <ProfileClient
      profile={profile}
      lbEntry={lbEntry ? {
        total_points: lbEntry.total_points,
        match_points: lbEntry.match_points,
        group_points: lbEntry.group_points,
        bonus_points: lbEntry.bonus_points,
        rank: lbEntry.rank,
      } : null}
      totalUsers={totalUsers || 0}
      predCount={predCount || 0}
      totalMatches={totalMatches || 48}
      correctInputs={correctInputs}
      totalInputs={totalInputs}
    />
  )
}

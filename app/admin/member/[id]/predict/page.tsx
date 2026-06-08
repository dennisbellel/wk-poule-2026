import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import PredictClient from '@/components/predict/PredictClient'
import { DEFAULT_SCORING, type ScoringKeys, type Player } from '@/types'

export const dynamic = 'force-dynamic'

type PageProps = { params: Promise<{ id: string }> }

export default async function AdminPredictForMemberPage({ params }: PageProps) {
  const { id: memberId } = await params
  const supabase = await createClient()

  // Admin-check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data: callerProfile } = await supabase
    .from('profiles').select('is_admin').eq('id', user.id).single()
  if (!callerProfile?.is_admin) redirect('/')

  // Target deelnemer
  const { data: member } = await supabase.from('profiles').select('*').eq('id', memberId).single()
  if (!member) notFound()

  // Alle data voor PredictClient — net als app/(app)/predict/page.tsx maar dan voor memberId
  const [
    { data: groupMatches },
    { data: koMatches },
    { data: matchPredictions },
    { data: groupPredictions },
    { data: teams },
    { data: bonusQuestions },
    { data: bonusAnswers },
  ] = await Promise.all([
    supabase.from('matches')
      .select('*, home_team:home_team_id(*), away_team:away_team_id(*)')
      .eq('phase', 'group').order('scheduled_at', { ascending: true }),
    supabase.from('matches')
      .select('*, home_team:home_team_id(*), away_team:away_team_id(*)')
      .neq('phase', 'group').order('scheduled_at', { ascending: true }),
    supabase.from('match_predictions').select('*').eq('user_id', memberId),
    supabase.from('group_standing_predictions').select('*').eq('user_id', memberId),
    supabase.from('teams').select('*').order('group_id').order('name_nl'),
    supabase.from('bonus_questions').select('*').eq('active', true).order('sort_order'),
    supabase.from('bonus_answers').select('*').eq('user_id', memberId),
  ])

  // Spelers in batches
  const allPlayers: Player[] = []
  const PAGE = 500
  let from = 0
  while (true) {
    const { data: batch } = await supabase
      .from('players')
      .select('*, team:team_id(*)')
      .order('name', { ascending: true })
      .range(from, from + PAGE - 1)
    if (!batch || batch.length === 0) break
    allPlayers.push(...(batch as unknown as Player[]))
    if (batch.length < PAGE) break
    from += PAGE
    if (from > 10000) break
  }

  // Scoring config
  const { data: scoringRows } = await supabase.from('scoring_config').select('key, value')
  const scoring = { ...DEFAULT_SCORING } as ScoringKeys
  for (const row of scoringRows || []) {
    if (row.key in scoring) (scoring as unknown as Record<string, number>)[row.key] = row.value
  }

  return (
    <PredictClient
      userId={memberId}
      groupMatches={groupMatches || []}
      koMatches={koMatches || []}
      matchPredictions={matchPredictions || []}
      groupPredictions={groupPredictions || []}
      teams={teams || []}
      bonusQuestions={bonusQuestions || []}
      bonusAnswers={bonusAnswers || []}
      players={allPlayers}
      scoring={scoring}
      adminActAs={{ userId: memberId, displayName: member.display_name }}
    />
  )
}

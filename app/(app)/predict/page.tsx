import { createClient } from '@/lib/supabase/server'
import PredictClient from '@/components/predict/PredictClient'

export default async function PredictPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // All group matches
  const { data: groupMatches } = await supabase
    .from('matches')
    .select('*, home_team:home_team_id(*), away_team:away_team_id(*)')
    .eq('phase', 'group')
    .order('scheduled_at', { ascending: true })

  // Knockout matches
  const { data: koMatches } = await supabase
    .from('matches')
    .select('*, home_team:home_team_id(*), away_team:away_team_id(*)')
    .neq('phase', 'group')
    .order('scheduled_at', { ascending: true })

  // User's match predictions
  const { data: matchPredictions } = await supabase
    .from('match_predictions')
    .select('*')
    .eq('user_id', user!.id)

  // User's group standing predictions
  const { data: groupPredictions } = await supabase
    .from('group_standing_predictions')
    .select('*, team:team_id(*)')
    .eq('user_id', user!.id)
    .order('position', { ascending: true })

  // All teams (for group standing picker)
  const { data: teams } = await supabase
    .from('teams')
    .select('*')
    .order('group_id', { ascending: true })

  // Bonus questions
  const { data: bonusQuestions } = await supabase
    .from('bonus_questions')
    .select('*')
    .eq('active', true)
    .order('sort_order', { ascending: true })

  // User's bonus answers
  const { data: bonusAnswers } = await supabase
    .from('bonus_answers')
    .select('*')
    .eq('user_id', user!.id)

  // All players
  const { data: players } = await supabase
    .from('players')
    .select('*, team:team_id(*)')
    .order('name', { ascending: true })

  return (
    <PredictClient
      userId={user!.id}
      groupMatches={groupMatches || []}
      koMatches={koMatches || []}
      matchPredictions={matchPredictions || []}
      groupPredictions={groupPredictions || []}
      teams={teams || []}
      bonusQuestions={bonusQuestions || []}
      bonusAnswers={bonusAnswers || []}
      players={players || []}
    />
  )
}

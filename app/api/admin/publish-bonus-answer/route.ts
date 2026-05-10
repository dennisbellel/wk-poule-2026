import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { calculateBonusPoints, sortLeaderboard } from '@/lib/points/calculate'
import { DEFAULT_SCORING, type ScoringKeys, type BonusAnswer, type LeaderboardEntry } from '@/types'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { question_id, correct_answer } = await request.json() as { question_id: string; correct_answer: string }
  if (!question_id || !correct_answer) {
    return NextResponse.json({ error: 'question_id en correct_answer verplicht' }, { status: 400 })
  }

  const admin = await createAdminClient()

  // Snapshot huidige ranks → previous_rank
  const { data: lbBefore } = await admin.from('leaderboard').select('*')
  if (lbBefore) {
    const ranked = sortLeaderboard(lbBefore as LeaderboardEntry[])
    await Promise.all(
      ranked.map(r =>
        admin.from('profiles').update({ previous_rank: r.rank }).eq('id', r.user_id)
      )
    )
  }

  // Update vraag
  const { data: question, error: qErr } = await admin
    .from('bonus_questions')
    .update({ correct_answer })
    .eq('id', question_id)
    .select('points_value')
    .single()
  if (qErr || !question) return NextResponse.json({ error: qErr?.message || 'Vraag niet gevonden' }, { status: 500 })

  // Scoring config (voor fallback)
  const { data: scoringRows } = await admin.from('scoring_config').select('key, value')
  const scoring = { ...DEFAULT_SCORING } as ScoringKeys
  for (const row of scoringRows || []) {
    if (row.key in scoring) (scoring as unknown as Record<string, number>)[row.key] = row.value
  }
  const pointsValue = question.points_value || scoring.bonus_default

  // Herbereken alle antwoorden voor deze vraag
  const { data: answers } = await admin
    .from('bonus_answers').select('*').eq('question_id', question_id)

  let updated = 0
  if (answers && answers.length > 0) {
    await Promise.all(
      answers.map((ans: BonusAnswer) => {
        const points = calculateBonusPoints(ans.answer, correct_answer, pointsValue)
        return admin.from('bonus_answers').update({ points }).eq('id', ans.id)
      })
    )
    updated = answers.length
  }

  return NextResponse.json({ ok: true, recalculated: updated })
}

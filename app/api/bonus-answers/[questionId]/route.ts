import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// Geeft ieders antwoord op een bonusvraag — ALLEEN als de deadline verstreken is.
// Vóór de deadline geheim (anti-afkijken).
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ questionId: string }> },
) {
  const { questionId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: question } = await supabase
    .from('bonus_questions')
    .select('deadline_at, correct_answer')
    .eq('id', questionId)
    .single()
  if (!question) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Deadline-check: vóór de deadline geen inzage (anti-afkijken)
  if (new Date(question.deadline_at) > new Date()) {
    return NextResponse.json({ error: 'locked', open: false }, { status: 403 })
  }

  // Na de deadline: alle antwoorden ophalen via admin client. RLS op bonus_answers
  // staat alleen eigen antwoorden toe, maar de deadline-check hierboven beschermt
  // al tegen te vroeg inzien.
  const admin = await createAdminClient()
  const { data: answers } = await admin
    .from('bonus_answers')
    .select('answer, profile:user_id(display_name)')
    .eq('question_id', questionId)

  // Groepeer per antwoord met namen
  const grouped = new Map<string, string[]>()
  for (const a of answers || []) {
    const profile = Array.isArray(a.profile) ? a.profile[0] : a.profile
    const name = (profile as { display_name?: string } | null)?.display_name ?? 'Onbekend'
    const ans = (a.answer ?? '').trim()
    if (!ans) continue
    if (!grouped.has(ans)) grouped.set(ans, [])
    grouped.get(ans)!.push(name)
  }

  const result = [...grouped.entries()]
    .map(([answer, names]) => ({ answer, names, count: names.length }))
    .sort((a, b) => b.count - a.count)

  return NextResponse.json({
    open: true,
    correct_answer: question.correct_answer,
    answers: result,
  })
}

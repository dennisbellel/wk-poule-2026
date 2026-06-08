import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { formatDateTimeNL } from '@/lib/format'

export const dynamic = 'force-dynamic'

type PageProps = { params: Promise<{ id: string }> }

export default async function AdminMemberPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  const { data: member } = await supabase
    .from('profiles').select('*').eq('id', id).single()
  if (!member) notFound()

  // Alle wedstrijden + voorspellingen van deze user
  const [{ data: matches }, { data: matchPreds }, { data: bonusQs }, { data: bonusAns }, { data: groupPreds }, { data: teams }] = await Promise.all([
    supabase.from('matches')
      .select('*, home_team:home_team_id(name_nl, flag), away_team:away_team_id(name_nl, flag)')
      .order('scheduled_at', { ascending: true }),
    supabase.from('match_predictions').select('*').eq('user_id', id),
    supabase.from('bonus_questions').select('*').eq('active', true).order('sort_order'),
    supabase.from('bonus_answers').select('*').eq('user_id', id),
    supabase.from('group_standing_predictions').select('*').eq('user_id', id),
    supabase.from('teams').select('id, name_nl, flag, group_id'),
  ])

  const matchPredByMatch = new Map((matchPreds ?? []).map(p => [p.match_id, p]))
  const bonusAnsByQ = new Map((bonusAns ?? []).map(a => [a.question_id, a]))

  type Match = NonNullable<typeof matches>[number]
  const upcomingMatches = (matches ?? []).filter((m: Match) => m.status === 'scheduled')
  const finishedMatches = (matches ?? []).filter((m: Match) => m.status === 'finished')

  const matchesPredicted = matchPreds?.length ?? 0
  const matchesOpen = (matches ?? []).filter(m => m.status === 'scheduled').length
  const bonusAnswered = bonusAns?.length ?? 0
  const bonusOpen = bonusQs?.length ?? 0

  // Groep aantallen per groep (4 nodig voor compleet)
  const groupCounts = new Map<string, number>()
  for (const g of groupPreds ?? []) groupCounts.set(g.group_id, (groupCounts.get(g.group_id) ?? 0) + 1)
  const completedGroups = Array.from(groupCounts.values()).filter(n => n === 4).length

  return (
    <div className="max-w-3xl space-y-6">
      <Link href="/admin/members" className="text-sm text-[#1a5c38] font-semibold inline-block">← Terug naar deelnemers</Link>

      {/* Header */}
      <div className="bg-white rounded-2xl border border-[#e5e1d8] p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-[#1a5c38] flex items-center justify-center flex-shrink-0">
            <span className="heading text-lg font-bold text-white">{member.display_name?.[0] ?? '?'}</span>
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="heading text-xl font-extrabold text-gray-900">{member.display_name}</h1>
            <p className="text-xs text-[#aaa] truncate">{member.email}</p>
          </div>
          <Link
            href={`/admin/member/${id}/predict`}
            className="bg-[#1a5c38] text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-[#164d2f] cursor-pointer"
          >
            ✏ Voorspel namens →
          </Link>
        </div>

        {/* Voortgang */}
        <div className="grid grid-cols-3 gap-3 pt-4 border-t border-[#f6f4ef]">
          <div className="text-center">
            <p className="heading text-2xl font-extrabold text-[#1a5c38]">{matchesPredicted}/{matchesOpen + (matches?.filter(m => m.status === 'finished').length ?? 0)}</p>
            <p className="text-[11px] text-[#888] uppercase tracking-wide mt-0.5">Wedstrijden</p>
          </div>
          <div className="text-center">
            <p className="heading text-2xl font-extrabold text-[#1a5c38]">{completedGroups}/12</p>
            <p className="text-[11px] text-[#888] uppercase tracking-wide mt-0.5">Groepen</p>
          </div>
          <div className="text-center">
            <p className="heading text-2xl font-extrabold text-[#1a5c38]">{bonusAnswered}/{bonusOpen}</p>
            <p className="text-[11px] text-[#888] uppercase tracking-wide mt-0.5">Bonusvragen</p>
          </div>
        </div>
      </div>

      {/* Open wedstrijden */}
      <div className="bg-white rounded-2xl border border-[#e5e1d8] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#f6f4ef]">
          <h2 className="text-sm font-semibold text-gray-800">Aankomende wedstrijden ({upcomingMatches.length})</h2>
        </div>
        {upcomingMatches.length === 0 ? (
          <div className="px-5 py-4 text-sm text-[#aaa] text-center">Geen aankomende wedstrijden</div>
        ) : upcomingMatches.slice(0, 30).map((m: Match) => {
          const home = Array.isArray(m.home_team) ? m.home_team[0] : m.home_team
          const away = Array.isArray(m.away_team) ? m.away_team[0] : m.away_team
          const pred = matchPredByMatch.get(m.id)
          const hasPred = !!pred && (pred.home_ft != null || pred.home_yellow != null)
          return (
            <div key={m.id} className="flex items-center gap-3 px-5 py-3 border-b border-[#f6f4ef] last:border-0">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {(home as { flag?: string } | null)?.flag} {(home as { name_nl?: string } | null)?.name_nl ?? m.home_team_placeholder ?? '?'}
                  {' — '}
                  {(away as { name_nl?: string } | null)?.name_nl ?? m.away_team_placeholder ?? '?'} {(away as { flag?: string } | null)?.flag}
                </p>
                <p className="text-[11px] text-[#aaa] mt-0.5">{formatDateTimeNL(m.scheduled_at)}</p>
              </div>
              {hasPred ? (
                <div className="text-right flex-shrink-0">
                  <span className="text-sm font-bold text-[#1a5c38]">{pred?.home_ft ?? '–'} – {pred?.away_ft ?? '–'}</span>
                  <p className="text-[10px] text-[#888]">rust {pred?.home_ht ?? '–'}-{pred?.away_ht ?? '–'} · 🟨 {pred?.home_yellow ?? 0}/{pred?.away_yellow ?? 0}</p>
                </div>
              ) : (
                <span className="text-xs text-red-500 flex-shrink-0">niet ingevuld</span>
              )}
            </div>
          )
        })}
      </div>

      {/* Gespeelde wedstrijden */}
      {finishedMatches.length > 0 && (
        <div className="bg-white rounded-2xl border border-[#e5e1d8] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#f6f4ef]">
            <h2 className="text-sm font-semibold text-gray-800">Gespeelde wedstrijden ({finishedMatches.length})</h2>
          </div>
          {finishedMatches.map((m: Match) => {
            const home = Array.isArray(m.home_team) ? m.home_team[0] : m.home_team
            const away = Array.isArray(m.away_team) ? m.away_team[0] : m.away_team
            const pred = matchPredByMatch.get(m.id)
            return (
              <div key={m.id} className="flex items-center gap-3 px-5 py-3 border-b border-[#f6f4ef] last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {(home as { flag?: string } | null)?.flag} {(home as { name_nl?: string } | null)?.name_nl} — {(away as { name_nl?: string } | null)?.name_nl} {(away as { flag?: string } | null)?.flag}
                  </p>
                  <p className="text-[11px] text-[#aaa] mt-0.5">
                    Werkelijk: {m.home_ft}–{m.away_ft}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  {pred ? (
                    <>
                      <p className="text-sm font-bold text-gray-700">{pred.home_ft ?? '–'}-{pred.away_ft ?? '–'}</p>
                      <p className="text-xs font-bold text-[#1a5c38]">+{pred.points ?? 0} pt</p>
                    </>
                  ) : (
                    <span className="text-xs text-[#aaa]">niet ingevuld</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Bonusvragen */}
      <div className="bg-white rounded-2xl border border-[#e5e1d8] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#f6f4ef]">
          <h2 className="text-sm font-semibold text-gray-800">Bonusvragen ({bonusQs?.length ?? 0})</h2>
        </div>
        {(bonusQs ?? []).map(q => {
          const ans = bonusAnsByQ.get(q.id)
          return (
            <div key={q.id} className="flex items-start gap-3 px-5 py-3 border-b border-[#f6f4ef] last:border-0">
              <span className="text-lg flex-shrink-0">{q.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{q.question_nl}</p>
                <p className="text-[11px] text-[#aaa] mt-0.5">{q.phase} · {q.points_value} pt</p>
              </div>
              <div className="text-right flex-shrink-0">
                {ans?.answer ? (
                  <>
                    <p className="text-sm font-semibold text-[#1a5c38]">{ans.answer}</p>
                    {q.correct_answer && (
                      <p className="text-[10px] text-[#888]">+{ans.points ?? 0} pt</p>
                    )}
                  </>
                ) : (
                  <span className="text-xs text-red-500">niet ingevuld</span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Poulestand */}
      <div className="bg-white rounded-2xl border border-[#e5e1d8] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#f6f4ef]">
          <h2 className="text-sm font-semibold text-gray-800">Poulestand-voorspellingen ({completedGroups}/12 groepen compleet)</h2>
        </div>
        {(['A','B','C','D','E','F','G','H','I','J','K','L']).map(gid => {
          const teamsInGroup = (teams ?? []).filter(t => t.group_id === gid)
          const predsInGroup = (groupPreds ?? []).filter(g => g.group_id === gid).sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
          const isEmpty = predsInGroup.length === 0
          return (
            <div key={gid} className="px-5 py-3 border-b border-[#f6f4ef] last:border-0">
              <p className="text-sm font-semibold text-gray-800 mb-1.5">Groep {gid}</p>
              {isEmpty ? (
                <p className="text-xs text-red-500">niet ingevuld</p>
              ) : (
                <ol className="text-xs text-gray-700 space-y-0.5">
                  {predsInGroup.map(p => {
                    const team = teamsInGroup.find(t => t.id === p.team_id)
                    return (
                      <li key={p.team_id}>
                        {p.position}. {team?.flag} {team?.name_nl ?? p.team_id} · {p.predicted_points ?? 0} pt · {p.goals_for ?? 0}-{p.goals_against ?? 0}
                      </li>
                    )
                  })}
                </ol>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

import { createClient } from '@/lib/supabase/server'
import AdminScoringClient from '@/components/admin/AdminScoringClient'
import { DEFAULT_SCORING, SCORING_LABELS, type ScoringKeys } from '@/types'

export const dynamic = 'force-dynamic'

export default async function AdminScoringPage() {
  const supabase = await createClient()
  const { data: scoringRows } = await supabase.from('scoring_config').select('*').order('category')

  // Houd de lijst in sync met de code: nieuwe keys (zoals match_toto) krijgen
  // hun default, vervallen keys (zoals het oude match_ft_team) verdwijnen.
  // Zo kan de admin alles direct beheren zonder eerst "Herbereken alles".
  const known = new Set(Object.keys(SCORING_LABELS))
  const existing = new Set((scoringRows || []).map(r => r.key))
  const missing = (Object.keys(SCORING_LABELS) as (keyof ScoringKeys)[]).filter(k => !existing.has(k))
  const obsolete = (scoringRows || []).filter(r => !known.has(r.key)).map(r => r.key)

  if (missing.length > 0 || obsolete.length > 0) {
    if (missing.length > 0) {
      await supabase.from('scoring_config').insert(
        missing.map(k => ({
          key: k,
          value: DEFAULT_SCORING[k],
          label_nl: SCORING_LABELS[k].label,
          category: SCORING_LABELS[k].category,
        }))
      )
    }
    if (obsolete.length > 0) {
      await supabase.from('scoring_config').delete().in('key', obsolete)
    }
    const { data: refreshed } = await supabase.from('scoring_config').select('*').order('category')
    return <AdminScoringClient initialScoring={refreshed || []} />
  }

  return <AdminScoringClient initialScoring={scoringRows || []} />
}

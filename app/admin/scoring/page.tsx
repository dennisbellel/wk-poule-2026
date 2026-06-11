import { createClient } from '@/lib/supabase/server'
import AdminScoringClient from '@/components/admin/AdminScoringClient'
import { DEFAULT_SCORING, SCORING_LABELS, type ScoringKeys } from '@/types'

export const dynamic = 'force-dynamic'

export default async function AdminScoringPage() {
  const supabase = await createClient()
  const { data: scoringRows } = await supabase.from('scoring_config').select('*').order('category')

  // Nieuwe scoring-keys (zoals match_toto) automatisch aanvullen met hun
  // default, zodat ze meteen op deze pagina te beheren zijn — zonder eerst
  // op "Herbereken alles" te hoeven klikken
  const existing = new Set((scoringRows || []).map(r => r.key))
  const missing = (Object.keys(SCORING_LABELS) as (keyof ScoringKeys)[]).filter(k => !existing.has(k))
  if (missing.length > 0) {
    await supabase.from('scoring_config').insert(
      missing.map(k => ({
        key: k,
        value: DEFAULT_SCORING[k],
        label_nl: SCORING_LABELS[k].label,
        category: SCORING_LABELS[k].category,
      }))
    )
    const { data: refreshed } = await supabase.from('scoring_config').select('*').order('category')
    return <AdminScoringClient initialScoring={refreshed || []} />
  }

  return <AdminScoringClient initialScoring={scoringRows || []} />
}

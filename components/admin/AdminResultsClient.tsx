'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface PendingResult {
  id: string
  match_id: string
  home_ft: number | null
  away_ft: number | null
  home_ht: number | null
  away_ht: number | null
  home_yellow: number | null
  away_yellow: number | null
  home_red: number | null
  away_red: number | null
  penalties: boolean
  synced_at: string
  status: string
  match: {
    id: string
    group_id: string | null
    scheduled_at: string
    home_team: { name: string; flag?: string } | null
    away_team: { name: string; flag?: string } | null
  }
}

export default function AdminResultsClient({
  pending, published,
}: {
  pending: PendingResult[]
  published: PendingResult[]
}) {
  const supabase = createClient()
  const [items, setItems] = useState(pending)
  const [publishedItems, setPublishedItems] = useState(published)
  const [publishing, setPublishing] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState<string | null>(null)

  async function handlePublish(item: PendingResult) {
    setPublishing(item.id)

    // 1. Update de wedstrijd met de uitslag
    await supabase
      .from('matches')
      .update({
        home_ft: item.home_ft,
        away_ft: item.away_ft,
        home_ht: item.home_ht,
        away_ht: item.away_ht,
        home_yellow: item.home_yellow,
        away_yellow: item.away_yellow,
        home_red: item.home_red,
        away_red: item.away_red,
        penalties: item.penalties,
        status: 'finished',
        updated_at: new Date().toISOString(),
      })
      .eq('id', item.match_id)

    // 2. Markeer als gepubliceerd
    await supabase
      .from('pending_results')
      .update({
        status: 'published',
        published_at: new Date().toISOString(),
      })
      .eq('id', item.id)

    // 3. Update lokale state
    setItems(prev => prev.filter(i => i.id !== item.id))
    setPublishedItems(prev => [{ ...item, status: 'published' }, ...prev].slice(0, 10))
    setPublishing(null)
  }

  async function handleReject(item: PendingResult) {
    setRejecting(item.id)
    await supabase
      .from('pending_results')
      .update({ status: 'rejected' })
      .eq('id', item.id)
    setItems(prev => prev.filter(i => i.id !== item.id))
    setRejecting(null)
  }

  function formatScore(item: PendingResult) {
    return `${item.home_ft ?? '?'} – ${item.away_ft ?? '?'}`
  }

  function formatHT(item: PendingResult) {
    return `rust ${item.home_ht ?? '?'} – ${item.away_ht ?? '?'}`
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="heading text-2xl font-extrabold text-gray-900">Uitslagen publiceren</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Uitslagen worden eerst opgeslagen als concept. Jij publiceert ze handmatig.
        </p>
      </div>

      {/* Wachtende uitslagen */}
      <div className="bg-white rounded-2xl border border-[#e5e1d8] overflow-hidden">
        <div className="px-5 py-3 bg-amber-50 border-b border-amber-100 flex items-center justify-between">
          <span className="font-bold text-sm text-amber-800">⏳ Wacht op publicatie</span>
          <span className="text-xs text-amber-600">{items.length} uitslag{items.length !== 1 ? 'en' : ''}</span>
        </div>

        {items.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-gray-400">
            Geen uitslagen klaar voor publicatie.
          </div>
        ) : (
          <div className="divide-y divide-[#f0ede6]">
            {items.map(item => (
              <div key={item.id} className="px-5 py-4">
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    {/* Wedstrijd */}
                    <div className="flex items-center gap-2 mb-1">
                      {item.match.group_id && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#f0ede6] text-gray-500">
                          Gr. {item.match.group_id}
                        </span>
                      )}
                      <span className="text-xs text-gray-400">
                        {new Date(item.match.scheduled_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                    <div className="text-sm font-semibold text-gray-900 mb-1">
                      {item.match.home_team?.name ?? '?'} — {item.match.away_team?.name ?? '?'}
                    </div>

                    {/* Uitslag */}
                    <div className="flex items-center gap-3">
                      <span className="text-xl font-bold text-[#1a5c38]">{formatScore(item)}</span>
                      <span className="text-xs text-gray-400">{formatHT(item)}</span>
                      {item.penalties && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 font-medium">na strafschoppen</span>
                      )}
                    </div>

                    {/* Kaarten */}
                    <div className="flex gap-4 mt-1 text-xs text-gray-400">
                      <span>🟨 {item.home_yellow ?? 0} – {item.away_yellow ?? 0}</span>
                      <span>🟥 {item.home_red ?? 0} – {item.away_red ?? 0}</span>
                    </div>

                    <p className="text-[11px] text-gray-300 mt-1">
                      Gesynchroniseerd {new Date(item.synced_at).toLocaleString('nl-NL', {
                        timeZone: 'Europe/Amsterdam',
                        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                      })}
                    </p>
                  </div>

                  {/* Actieknoppen */}
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    <button
                      onClick={() => handlePublish(item)}
                      disabled={publishing === item.id}
                      className="px-4 py-2 text-xs font-bold bg-[#1a5c38] text-white rounded-xl
                                 hover:bg-[#164d2f] transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {publishing === item.id ? 'Publiceren...' : '✓ Publiceer'}
                    </button>
                    <button
                      onClick={() => handleReject(item)}
                      disabled={rejecting === item.id}
                      className="px-4 py-2 text-xs font-semibold text-red-500 bg-red-50 rounded-xl
                                 hover:bg-red-100 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      Afwijzen
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent gepubliceerd */}
      {publishedItems.length > 0 && (
        <div className="bg-white rounded-2xl border border-[#e5e1d8] overflow-hidden">
          <div className="px-5 py-3 bg-[#f6f9f7] border-b border-[#e5e1d8]">
            <span className="font-bold text-sm text-[#1a5c38]">✓ Recent gepubliceerd</span>
          </div>
          <div className="divide-y divide-[#f0ede6]">
            {publishedItems.map(item => (
              <div key={item.id} className="px-5 py-3 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-700">
                    {item.match.home_team?.name ?? '?'} — {item.match.away_team?.name ?? '?'}
                  </div>
                  <div className="text-xs text-gray-400">{formatScore(item)} · {formatHT(item)}</div>
                </div>
                <span className="text-xs font-semibold text-[#1a5c38] bg-[#eaf4ef] px-2 py-0.5 rounded-full">
                  ✓ Gepubliceerd
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

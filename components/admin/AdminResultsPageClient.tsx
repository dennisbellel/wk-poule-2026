'use client'
import { useState } from 'react'
import AdminMatchesClient from './AdminMatchesClient'
import AdminResultForm from './AdminResultForm'
import type { Match } from '@/types'

export default function AdminResultsPageClient({ matches }: { matches: Match[] }) {
  const [tab, setTab] = useState<'matches' | 'results'>('results')

  // AdminMatchesClient verwacht teams apart — haal unieke teams op uit wedstrijden
  const teamMap = new Map<string, { id: string; name: string }>()
  for (const m of matches) {
    if (m.home_team) teamMap.set(m.home_team.id, { id: m.home_team.id, name: m.home_team.name })
    if (m.away_team) teamMap.set(m.away_team.id, { id: m.away_team.id, name: m.away_team.name })
  }
  const teams = Array.from(teamMap.values()).sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div className="max-w-3xl">
      {/* Header */}
      <div className="mb-4">
        <h1 className="heading text-2xl font-extrabold text-gray-900">Wedstrijden & Uitslagen</h1>
        <p className="text-sm text-gray-400 mt-0.5">Beheer wedstrijden en voer uitslagen in.</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#e5e1d8] mb-6">
        {[
          { id: 'results', label: '⚽ Uitslagen invoeren' },
          { id: 'matches', label: '📅 Wedstrijden beheren' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as 'matches' | 'results')}
            className={`px-4 py-3 text-sm border-b-2 -mb-px transition-colors cursor-pointer border-0 bg-transparent ${
              tab === t.id ? 'border-[#1a5c38] text-[#1a5c38] font-semibold' : 'border-transparent text-[#aaa]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Uitslagen tab */}
      {tab === 'results' && (() => {
        const toFormMatch = (m: Match) => ({
          id: m.id,
          scheduled_at: m.scheduled_at,
          status: m.status,
          group_id: m.group_id,
          phase: m.phase,
          home_ft: m.home_ft,
          away_ft: m.away_ft,
          home_ht: m.home_ht,
          away_ht: m.away_ht,
          home_yellow: m.home_yellow,
          away_yellow: m.away_yellow,
          home_red: m.home_red,
          away_red: m.away_red,
          penalties: m.penalties,
          home_et: m.home_et,
          away_et: m.away_et,
          winner_team_id: m.winner_team_id,
          home_team_id: m.home_team_id,
          away_team_id: m.away_team_id,
          home_team: m.home_team ? { name_nl: m.home_team.name_nl ?? m.home_team.name, flag: m.home_team.flag } : null,
          away_team: m.away_team ? { name_nl: m.away_team.name_nl ?? m.away_team.name, flag: m.away_team.flag } : null,
        })
        // Nog te publiceren bovenaan, al gepubliceerde onderaan — minder scrollen
        const todo = matches.filter(m => m.status !== 'finished')
        const done = matches.filter(m => m.status === 'finished')
        return (
          <div className="space-y-3">
            <p className="text-xs text-gray-400 mb-4">
              Vul alle velden in en klik Publiceer — pas dan wordt de uitslag zichtbaar voor deelnemers.
            </p>
            {todo.map(m => (
              <AdminResultForm key={m.id} match={toFormMatch(m)} />
            ))}

            {done.length > 0 && (
              <div className="pt-2">
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex-1 h-px bg-[#e5e1d8]" />
                  <span className="text-[11px] font-semibold text-[#aaa] uppercase tracking-wider">
                    Gepubliceerd ({done.length})
                  </span>
                  <div className="flex-1 h-px bg-[#e5e1d8]" />
                </div>
                <div className="space-y-3">
                  {done.map(m => (
                    <AdminResultForm key={m.id} match={toFormMatch(m)} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      })()}

      {/* Wedstrijden tab */}
      {tab === 'matches' && (
        <AdminMatchesClient
          initialMatches={matches.map(m => ({
            id: m.id,
            match_number: m.match_number,
            group_id: m.group_id,
            phase: m.phase,
            scheduled_at: m.scheduled_at,
            prediction_deadline_at: m.prediction_deadline_at,
            venue: m.venue,
            city: m.city,
            status: m.status,
            home_team_id: m.home_team_id,
            away_team_id: m.away_team_id,
            home_team: m.home_team ? { id: m.home_team.id, name: m.home_team.name } : null,
            away_team: m.away_team ? { id: m.away_team.id, name: m.away_team.name } : null,
          }))}
          teams={teams}
        />
      )}
    </div>
  )
}

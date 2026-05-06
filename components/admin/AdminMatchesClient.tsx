'use client'
// components/admin/AdminMatchesClient.tsx

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Team {
  id: string
  name: string
}

interface Match {
  id: string
  match_number: number
  group_id: string | null
  phase: string
  scheduled_at: string
  prediction_deadline_at: string
  venue: string | null
  city: string | null
  status: string | null
  home_team_id: string | null
  away_team_id: string | null
  home_team: Team | null
  away_team: Team | null
}

interface Props {
  initialMatches: Match[]
  teams: Team[]
}

// Zet UTC timestamp om naar lokale datetime-local input waarde
function toDatetimeLocal(utc: string): string {
  const d = new Date(utc)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// Zet datetime-local waarde om naar ISO UTC string
function fromDatetimeLocal(local: string): string {
  return new Date(local).toISOString()
}

// Formatteer UTC timestamp naar leesbare NL-weergave
function formatNL(utc: string): string {
  return new Date(utc).toLocaleString('nl-NL', {
    timeZone: 'Europe/Amsterdam',
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit',
  })
}

const GROUP_LABELS: Record<string, string> = {
  A: 'Poule A', B: 'Poule B', C: 'Poule C', D: 'Poule D',
  E: 'Poule E', F: 'Poule F', G: 'Poule G', H: 'Poule H',
  I: 'Poule I', J: 'Poule J', K: 'Poule K', L: 'Poule L',
}

export default function AdminMatchesClient({ initialMatches, teams }: Props) {
  const supabase = createClient()
  const [matches, setMatches] = useState<Match[]>(initialMatches)
  const [editId, setEditId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Partial<Match> | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [search, setSearch] = useState('')
  const [filterGroup, setFilterGroup] = useState<string>('all')

  // Groepen voor filter
  const groups = useMemo(() => {
    const g = [...new Set(matches.map(m => m.group_id).filter(Boolean))] as string[]
    return g.sort()
  }, [matches])

  // Gefilterde wedstrijden
  const filtered = useMemo(() => {
    return matches.filter(m => {
      const teamMatch =
        (m.home_team?.name ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (m.away_team?.name ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (m.venue ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (m.city ?? '').toLowerCase().includes(search.toLowerCase())
      const groupMatch = filterGroup === 'all' || m.group_id === filterGroup
      return teamMatch && groupMatch
    })
  }, [matches, search, filterGroup])

  function openEdit(match: Match) {
    setDraft({
      ...match,
      scheduled_at: toDatetimeLocal(match.scheduled_at),
      prediction_deadline_at: toDatetimeLocal(match.prediction_deadline_at),
    })
    setEditId(match.id)
    setSaved(false)
  }

  function closeEdit() {
    setEditId(null)
    setDraft(null)
  }

  function updateDraft(field: string, value: string) {
    setDraft(prev => prev ? { ...prev, [field]: value } : prev)
  }

  async function handleSave() {
    if (!draft || !editId) return
    setSaving(true)

    const updateData: Partial<Match> = {
      home_team_id: draft.home_team_id ?? null,
      away_team_id: draft.away_team_id ?? null,
      scheduled_at: fromDatetimeLocal(draft.scheduled_at as string),
      prediction_deadline_at: fromDatetimeLocal(draft.scheduled_at as string),
      venue: draft.venue ?? null,
      city: draft.city ?? null,
      group_id: draft.group_id ?? null,
    }

    const { error } = await supabase
      .from('matches')
      .update(updateData)
      .eq('id', editId)

    if (!error) {
      // Update lokale state
      const homeTeam = teams.find(t => t.id === draft.home_team_id) ?? null
      const awayTeam = teams.find(t => t.id === draft.away_team_id) ?? null

      setMatches(prev => prev.map(m =>
        m.id === editId
          ? {
              ...m,
              ...updateData,
              home_team: homeTeam,
              away_team: awayTeam,
            }
          : m
      ))
      setSaved(true)
      setTimeout(() => {
        closeEdit()
        setSaved(false)
      }, 1200)
    }

    setSaving(false)
  }

  // Groepeer gefilterde wedstrijden per poule
  const grouped = useMemo(() => {
    const g: Record<string, Match[]> = {}
    for (const m of filtered) {
      const key = m.group_id ?? '?'
      if (!g[key]) g[key] = []
      g[key].push(m)
    }
    return g
  }, [filtered])

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="heading text-2xl font-extrabold text-gray-900">Wedstrijden beheren</h1>
        <p className="text-sm text-gray-500 mt-1">
          Pas teams, datum/tijd, stadion of poule aan. De voorspellingsdeadline wordt automatisch gelijk gezet aan de aftrap.
        </p>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <input
          type="text"
          placeholder="Zoek op team, stad of stadion..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 min-w-48 bg-white border border-[#e5e1d8] rounded-xl px-4 py-2.5 text-sm
                     focus:outline-none focus:border-[#1a5c38] focus:ring-1 focus:ring-[#1a5c38]"
        />
        <select
          value={filterGroup}
          onChange={e => setFilterGroup(e.target.value)}
          className="bg-white border border-[#e5e1d8] rounded-xl px-4 py-2.5 text-sm
                     focus:outline-none focus:border-[#1a5c38] cursor-pointer"
        >
          <option value="all">Alle poules</option>
          {groups.map(g => (
            <option key={g} value={g}>Poule {g}</option>
          ))}
        </select>
        <span className="text-sm text-gray-400 self-center">{filtered.length} wedstrijden</span>
      </div>

      {/* Wedstrijden per poule */}
      {Object.entries(grouped).sort().map(([group, groupMatches]) => (
        <div key={group} className="bg-white rounded-2xl border border-[#e5e1d8] overflow-hidden">
          {/* Poule header */}
          <div className="px-5 py-3 bg-[#f6f4ef] border-b border-[#e5e1d8] flex items-center justify-between">
            <span className="font-bold text-sm text-[#1a5c38]">{GROUP_LABELS[group] ?? `Poule ${group}`}</span>
            <span className="text-xs text-gray-400">{groupMatches.length} wedstrijden</span>
          </div>

          {/* Wedstrijden */}
          <div className="divide-y divide-[#f0ede6]">
            {groupMatches.map((match, idx) => (
              <div key={match.id}>
                {/* Wedstrijd rij */}
                {editId !== match.id && (
                  <div className="px-5 py-3.5 flex items-center gap-4 hover:bg-[#fafaf9] transition-colors">
                    {/* Wedstrijdnummer */}
                    <span className="text-xs text-gray-300 font-mono w-6 flex-shrink-0">
                      {idx + 1}
                    </span>

                    {/* Teams */}
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm text-[#1a1a1a]">
                        {match.home_team?.name ?? '—'} <span className="text-gray-300 font-normal">vs</span> {match.away_team?.name ?? '—'}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5 flex gap-2">
                        <span>{formatNL(match.scheduled_at)}</span>
                        {match.venue && <span>· {match.venue}</span>}
                        {match.city && <span>· {match.city}</span>}
                      </div>
                    </div>

                    {/* Status badge */}
                    <span className={`tag text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${
                      match.status === 'finished'
                        ? 'bg-green-100 text-green-700'
                        : match.status === 'live'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-[#f0ede6] text-gray-500'
                    }`}>
                      {match.status === 'finished' ? '✓ Gespeeld' : match.status === 'live' ? '● Live' : 'Gepland'}
                    </span>

                    {/* Bewerk knop */}
                    <button
                      onClick={() => openEdit(match)}
                      className="flex-shrink-0 px-3 py-1.5 text-xs font-semibold text-[#1a5c38] bg-[#eaf4ef]
                                 rounded-lg border border-[#c8e6d4] hover:bg-[#d4f0e0] transition-colors cursor-pointer"
                    >
                      ✏️ Bewerken
                    </button>
                  </div>
                )}

                {/* Bewerkformulier (inline) */}
                {editId === match.id && draft && (
                  <div className="px-5 py-4 bg-[#f6f9f7] border-l-4 border-[#1a5c38]">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                      {/* Thuisteam */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                          Thuisteam
                        </label>
                        <select
                          value={draft.home_team_id ?? ''}
                          onChange={e => updateDraft('home_team_id', e.target.value)}
                          className="w-full bg-white border border-[#e5e1d8] rounded-xl px-3 py-2 text-sm
                                     focus:outline-none focus:border-[#1a5c38] cursor-pointer"
                        >
                          <option value="">— Kies team —</option>
                          {teams.map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </select>
                      </div>

                      {/* Uitteam */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                          Uitteam
                        </label>
                        <select
                          value={draft.away_team_id ?? ''}
                          onChange={e => updateDraft('away_team_id', e.target.value)}
                          className="w-full bg-white border border-[#e5e1d8] rounded-xl px-3 py-2 text-sm
                                     focus:outline-none focus:border-[#1a5c38] cursor-pointer"
                        >
                          <option value="">— Kies team —</option>
                          {teams.map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </select>
                      </div>

                      {/* Datum & tijd */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                          Datum & tijd (jouw lokale tijd)
                        </label>
                        <input
                          type="datetime-local"
                          value={draft.scheduled_at as string ?? ''}
                          onChange={e => {
                            updateDraft('scheduled_at', e.target.value)
                            updateDraft('prediction_deadline_at', e.target.value)
                          }}
                          className="w-full bg-white border border-[#e5e1d8] rounded-xl px-3 py-2 text-sm
                                     focus:outline-none focus:border-[#1a5c38]"
                        />
                        <p className="text-xs text-gray-400 mt-1">Deadline voorspellingen wordt automatisch gelijk gezet</p>
                      </div>

                      {/* Poule */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                          Poule
                        </label>
                        <select
                          value={draft.group_id ?? ''}
                          onChange={e => updateDraft('group_id', e.target.value)}
                          className="w-full bg-white border border-[#e5e1d8] rounded-xl px-3 py-2 text-sm
                                     focus:outline-none focus:border-[#1a5c38] cursor-pointer"
                        >
                          {['A','B','C','D','E','F','G','H','I','J','K','L'].map(g => (
                            <option key={g} value={g}>Poule {g}</option>
                          ))}
                        </select>
                      </div>

                      {/* Stadion */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                          Stadion
                        </label>
                        <input
                          type="text"
                          value={draft.venue ?? ''}
                          onChange={e => updateDraft('venue', e.target.value)}
                          placeholder="bijv. AT&T Stadion"
                          className="w-full bg-white border border-[#e5e1d8] rounded-xl px-3 py-2 text-sm
                                     focus:outline-none focus:border-[#1a5c38]"
                        />
                      </div>

                      {/* Stad */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                          Stad
                        </label>
                        <input
                          type="text"
                          value={draft.city ?? ''}
                          onChange={e => updateDraft('city', e.target.value)}
                          placeholder="bijv. Dallas"
                          className="w-full bg-white border border-[#e5e1d8] rounded-xl px-3 py-2 text-sm
                                     focus:outline-none focus:border-[#1a5c38]"
                        />
                      </div>
                    </div>

                    {/* Actieknoppen */}
                    <div className="flex gap-3 mt-4">
                      <button
                        onClick={handleSave}
                        disabled={saving}
                        className={`px-5 py-2 text-sm font-semibold rounded-xl transition-colors cursor-pointer ${
                          saved
                            ? 'bg-green-500 text-white'
                            : 'bg-[#1a5c38] text-white hover:bg-[#164d2f]'
                        } disabled:opacity-50`}
                      >
                        {saving ? 'Opslaan...' : saved ? '✓ Opgeslagen!' : 'Opslaan'}
                      </button>
                      <button
                        onClick={closeEdit}
                        disabled={saving}
                        className="px-5 py-2 text-sm font-semibold rounded-xl bg-white border border-[#e5e1d8]
                                   text-gray-600 hover:bg-[#f6f4ef] transition-colors cursor-pointer"
                      >
                        Annuleren
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {filtered.length === 0 && (
        <div className="text-center py-12 text-gray-400 text-sm">
          Geen wedstrijden gevonden voor deze filter.
        </div>
      )}
    </div>
  )
}

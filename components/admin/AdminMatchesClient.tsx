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
  home_team_placeholder?: string | null
  away_team_placeholder?: string | null
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

const GROUPS = ['A','B','C','D','E','F','G','H','I','J','K','L']

// Fase-keuzes voor het toevoegen/bewerken van wedstrijden
const PHASE_OPTIONS: { value: string; label: string }[] = [
  { value: 'group', label: 'Groepsfase (poule)' },
  { value: 'r32', label: 'Laatste 32' },
  { value: 'r16', label: 'Achtste finales' },
  { value: 'qf', label: 'Kwartfinales' },
  { value: 'sf', label: 'Halve finales' },
  { value: 'third', label: 'Troostfinale (3e/4e plaats)' },
  { value: 'final', label: 'Finale' },
]

const ROUND_LABELS: Record<string, string> = {
  r32: '⚔️ Laatste 32', r16: '⚔️ Achtste finales', qf: '⚔️ Kwartfinales',
  sf: '⚔️ Halve finales', third: '🥉 Troostfinale', final: '🏆 Finale',
}
const ROUND_ORDER = ['r32', 'r16', 'qf', 'sf', 'third', 'final']

// Sectiesleutel + sorteervolgorde: eerst poules A-L, daarna knockout-rondes
function sectionKey(m: Match): string {
  return m.phase === 'group' ? `group:${m.group_id ?? '?'}` : `round:${m.phase}`
}
function sectionLabel(key: string): string {
  if (key.startsWith('group:')) return `Poule ${key.slice('group:'.length)}`
  return ROUND_LABELS[key.slice('round:'.length)] ?? key
}
function sectionSortIndex(key: string): number {
  if (key.startsWith('group:')) {
    const g = key.slice('group:'.length)
    const i = GROUPS.indexOf(g)
    return i === -1 ? 99 : i
  }
  return 100 + ROUND_ORDER.indexOf(key.slice('round:'.length))
}

function teamName(team: Team | null, placeholder: string | null | undefined): string {
  return team?.name ?? placeholder ?? '—'
}

const EMPTY_NEW = {
  phase: 'r32',
  group_id: 'A',
  home_team_id: '',
  away_team_id: '',
  home_team_placeholder: '',
  away_team_placeholder: '',
  scheduled_at: '',
  venue: '',
  city: '',
}

export default function AdminMatchesClient({ initialMatches, teams }: Props) {
  const supabase = createClient()
  const [matches, setMatches] = useState<Match[]>(initialMatches)
  const [editId, setEditId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Partial<Match> | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [search, setSearch] = useState('')
  const [filterSection, setFilterSection] = useState<string>('all')

  // Nieuwe-wedstrijd formulier
  const [adding, setAdding] = useState(false)
  const [newDraft, setNewDraft] = useState({ ...EMPTY_NEW })
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  // Beschikbare secties voor het filter (poules + aanwezige rondes)
  const sections = useMemo(() => {
    const keys = [...new Set(matches.map(sectionKey))]
    return keys.sort((a, b) => sectionSortIndex(a) - sectionSortIndex(b))
  }, [matches])

  // Gefilterde wedstrijden
  const filtered = useMemo(() => {
    return matches.filter(m => {
      const q = search.toLowerCase()
      const textMatch =
        (m.home_team?.name ?? m.home_team_placeholder ?? '').toLowerCase().includes(q) ||
        (m.away_team?.name ?? m.away_team_placeholder ?? '').toLowerCase().includes(q) ||
        (m.venue ?? '').toLowerCase().includes(q) ||
        (m.city ?? '').toLowerCase().includes(q)
      const sectionMatch = filterSection === 'all' || sectionKey(m) === filterSection
      return textMatch && sectionMatch
    })
  }, [matches, search, filterSection])

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

    const isGroup = draft.phase === 'group'
    const updateData: Partial<Match> = {
      home_team_id: draft.home_team_id || null,
      away_team_id: draft.away_team_id || null,
      home_team_placeholder: isGroup ? null : (draft.home_team_placeholder?.trim() || null),
      away_team_placeholder: isGroup ? null : (draft.away_team_placeholder?.trim() || null),
      scheduled_at: fromDatetimeLocal(draft.scheduled_at as string),
      prediction_deadline_at: fromDatetimeLocal(draft.scheduled_at as string),
      venue: draft.venue ?? null,
      city: draft.city ?? null,
      group_id: isGroup ? (draft.group_id ?? null) : null,
    }

    const { error } = await supabase
      .from('matches')
      .update(updateData)
      .eq('id', editId)

    if (!error) {
      const homeTeam = teams.find(t => t.id === draft.home_team_id) ?? null
      const awayTeam = teams.find(t => t.id === draft.away_team_id) ?? null

      setMatches(prev => prev.map(m =>
        m.id === editId
          ? { ...m, ...updateData, home_team: homeTeam, away_team: awayTeam }
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

  async function handleCreate() {
    setCreating(true)
    setCreateError(null)
    if (!newDraft.scheduled_at) {
      setCreateError('Vul datum & tijd in')
      setCreating(false)
      return
    }
    try {
      const res = await fetch('/api/admin/create-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phase: newDraft.phase,
          group_id: newDraft.phase === 'group' ? newDraft.group_id : null,
          home_team_id: newDraft.home_team_id || null,
          away_team_id: newDraft.away_team_id || null,
          home_team_placeholder: newDraft.home_team_placeholder,
          away_team_placeholder: newDraft.away_team_placeholder,
          scheduled_at: fromDatetimeLocal(newDraft.scheduled_at),
          venue: newDraft.venue,
          city: newDraft.city,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setCreateError(json.error || 'Toevoegen mislukt')
      } else {
        setMatches(prev => [...prev, json.match as Match])
        setNewDraft({ ...EMPTY_NEW, phase: newDraft.phase }) // fase onthouden voor de volgende
        setAdding(false)
      }
    } catch {
      setCreateError('Netwerkfout — probeer opnieuw')
    }
    setCreating(false)
  }

  // Groepeer gefilterde wedstrijden per sectie (poule of ronde)
  const grouped = useMemo(() => {
    const g: Record<string, Match[]> = {}
    for (const m of filtered) {
      const key = sectionKey(m)
      if (!g[key]) g[key] = []
      g[key].push(m)
    }
    return g
  }, [filtered])

  const isNewKnockout = newDraft.phase !== 'group'

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="heading text-2xl font-extrabold text-gray-900">Wedstrijden beheren</h1>
          <p className="text-sm text-gray-500 mt-1">
            Voeg knockout-wedstrijden toe of pas teams, datum/tijd en stadion aan. De voorspellingsdeadline is altijd gelijk aan de aftrap.
          </p>
        </div>
        <button
          onClick={() => { setAdding(a => !a); setCreateError(null) }}
          className="flex-shrink-0 px-4 py-2 text-sm font-semibold rounded-xl bg-[#1a5c38] text-white hover:bg-[#164d2f] transition-colors cursor-pointer"
        >
          {adding ? '✕ Sluiten' : '➕ Nieuwe wedstrijd'}
        </button>
      </div>

      {/* Nieuwe-wedstrijd formulier */}
      {adding && (
        <div className="bg-white rounded-2xl border border-[#c8e6d4] overflow-hidden">
          <div className="px-5 py-3 bg-[#eaf4ef] border-b border-[#c8e6d4]">
            <span className="font-bold text-sm text-[#1a5c38]">Nieuwe wedstrijd toevoegen</span>
          </div>
          <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Fase */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Fase</label>
              <select
                value={newDraft.phase}
                onChange={e => setNewDraft(d => ({ ...d, phase: e.target.value }))}
                className="w-full bg-white border border-[#e5e1d8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#1a5c38] cursor-pointer"
              >
                {PHASE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            {/* Poule (alleen groepsfase) */}
            {!isNewKnockout && (
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Poule</label>
                <select
                  value={newDraft.group_id}
                  onChange={e => setNewDraft(d => ({ ...d, group_id: e.target.value }))}
                  className="w-full bg-white border border-[#e5e1d8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#1a5c38] cursor-pointer"
                >
                  {GROUPS.map(g => <option key={g} value={g}>Poule {g}</option>)}
                </select>
              </div>
            )}

            {/* Knockout: omschrijving van de tegenstanders (placeholder) */}
            {isNewKnockout && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Thuis — omschrijving</label>
                  <input
                    type="text"
                    value={newDraft.home_team_placeholder}
                    onChange={e => setNewDraft(d => ({ ...d, home_team_placeholder: e.target.value }))}
                    placeholder="bijv. Winnaar Groep A"
                    className="w-full bg-white border border-[#e5e1d8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#1a5c38]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Uit — omschrijving</label>
                  <input
                    type="text"
                    value={newDraft.away_team_placeholder}
                    onChange={e => setNewDraft(d => ({ ...d, away_team_placeholder: e.target.value }))}
                    placeholder="bijv. Nr. 2 Groep B"
                    className="w-full bg-white border border-[#e5e1d8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#1a5c38]"
                  />
                </div>
              </>
            )}

            {/* Teams (optioneel — invullen zodra bekend) */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                Thuisteam {isNewKnockout && <span className="text-gray-400 normal-case font-normal">(optioneel)</span>}
              </label>
              <select
                value={newDraft.home_team_id}
                onChange={e => setNewDraft(d => ({ ...d, home_team_id: e.target.value }))}
                className="w-full bg-white border border-[#e5e1d8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#1a5c38] cursor-pointer"
              >
                <option value="">{isNewKnockout ? '— Nog onbekend —' : '— Kies team —'}</option>
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                Uitteam {isNewKnockout && <span className="text-gray-400 normal-case font-normal">(optioneel)</span>}
              </label>
              <select
                value={newDraft.away_team_id}
                onChange={e => setNewDraft(d => ({ ...d, away_team_id: e.target.value }))}
                className="w-full bg-white border border-[#e5e1d8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#1a5c38] cursor-pointer"
              >
                <option value="">{isNewKnockout ? '— Nog onbekend —' : '— Kies team —'}</option>
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>

            {/* Datum & tijd */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Datum & tijd (jouw lokale tijd)</label>
              <input
                type="datetime-local"
                value={newDraft.scheduled_at}
                onChange={e => setNewDraft(d => ({ ...d, scheduled_at: e.target.value }))}
                className="w-full bg-white border border-[#e5e1d8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#1a5c38]"
              />
              <p className="text-xs text-gray-400 mt-1">Deadline voorspellingen = aftrap</p>
            </div>

            {/* Stadion */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Stadion</label>
              <input
                type="text"
                value={newDraft.venue}
                onChange={e => setNewDraft(d => ({ ...d, venue: e.target.value }))}
                placeholder="bijv. MetLife Stadium"
                className="w-full bg-white border border-[#e5e1d8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#1a5c38]"
              />
            </div>
            {/* Stad */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Stad</label>
              <input
                type="text"
                value={newDraft.city}
                onChange={e => setNewDraft(d => ({ ...d, city: e.target.value }))}
                placeholder="bijv. New York"
                className="w-full bg-white border border-[#e5e1d8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#1a5c38]"
              />
            </div>
          </div>

          {createError && (
            <div className="px-5 pb-2 text-xs text-red-600">⚠ {createError}</div>
          )}

          <div className="px-5 py-3 border-t border-[#f0ede6] flex gap-3">
            <button
              onClick={handleCreate}
              disabled={creating}
              className="px-5 py-2 text-sm font-semibold rounded-xl bg-[#1a5c38] text-white hover:bg-[#164d2f] transition-colors cursor-pointer disabled:opacity-50"
            >
              {creating ? 'Toevoegen...' : '➕ Wedstrijd toevoegen'}
            </button>
            <button
              onClick={() => setAdding(false)}
              className="px-5 py-2 text-sm font-semibold rounded-xl bg-white border border-[#e5e1d8] text-gray-600 hover:bg-[#f6f4ef] transition-colors cursor-pointer"
            >
              Annuleren
            </button>
          </div>
        </div>
      )}

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
          value={filterSection}
          onChange={e => setFilterSection(e.target.value)}
          className="bg-white border border-[#e5e1d8] rounded-xl px-4 py-2.5 text-sm
                     focus:outline-none focus:border-[#1a5c38] cursor-pointer"
        >
          <option value="all">Alle fases</option>
          {sections.map(s => (
            <option key={s} value={s}>{sectionLabel(s)}</option>
          ))}
        </select>
        <span className="text-sm text-gray-400 self-center">{filtered.length} wedstrijden</span>
      </div>

      {/* Wedstrijden per sectie */}
      {Object.entries(grouped)
        .sort(([a], [b]) => sectionSortIndex(a) - sectionSortIndex(b))
        .map(([section, sectionMatches]) => (
        <div key={section} className="bg-white rounded-2xl border border-[#e5e1d8] overflow-hidden">
          {/* Sectie header */}
          <div className="px-5 py-3 bg-[#f6f4ef] border-b border-[#e5e1d8] flex items-center justify-between">
            <span className="font-bold text-sm text-[#1a5c38]">{sectionLabel(section)}</span>
            <span className="text-xs text-gray-400">{sectionMatches.length} wedstrijden</span>
          </div>

          {/* Wedstrijden */}
          <div className="divide-y divide-[#f0ede6]">
            {sectionMatches.map((match, idx) => (
              <div key={match.id}>
                {/* Wedstrijd rij */}
                {editId !== match.id && (
                  <div className="px-5 py-3.5 flex items-center gap-4 hover:bg-[#fafaf9] transition-colors">
                    <span className="text-xs text-gray-300 font-mono w-6 flex-shrink-0">
                      {idx + 1}
                    </span>

                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm text-[#1a1a1a]">
                        {teamName(match.home_team, match.home_team_placeholder)} <span className="text-gray-300 font-normal">vs</span> {teamName(match.away_team, match.away_team_placeholder)}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5 flex gap-2">
                        <span>{formatNL(match.scheduled_at)}</span>
                        {match.venue && <span>· {match.venue}</span>}
                        {match.city && <span>· {match.city}</span>}
                      </div>
                    </div>

                    <span className={`tag text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${
                      match.status === 'finished'
                        ? 'bg-green-100 text-green-700'
                        : match.status === 'live'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-[#f0ede6] text-gray-500'
                    }`}>
                      {match.status === 'finished' ? '✓ Gespeeld' : match.status === 'live' ? '● Live' : 'Gepland'}
                    </span>

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

                      {/* Knockout: placeholder-omschrijvingen */}
                      {draft.phase !== 'group' && (
                        <>
                          <div>
                            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Thuis — omschrijving</label>
                            <input
                              type="text"
                              value={draft.home_team_placeholder ?? ''}
                              onChange={e => updateDraft('home_team_placeholder', e.target.value)}
                              placeholder="bijv. Winnaar Groep A"
                              className="w-full bg-white border border-[#e5e1d8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#1a5c38]"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Uit — omschrijving</label>
                            <input
                              type="text"
                              value={draft.away_team_placeholder ?? ''}
                              onChange={e => updateDraft('away_team_placeholder', e.target.value)}
                              placeholder="bijv. Nr. 2 Groep B"
                              className="w-full bg-white border border-[#e5e1d8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#1a5c38]"
                            />
                          </div>
                        </>
                      )}

                      {/* Thuisteam */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                          Thuisteam {draft.phase !== 'group' && <span className="text-gray-400 normal-case font-normal">(zodra bekend)</span>}
                        </label>
                        <select
                          value={draft.home_team_id ?? ''}
                          onChange={e => updateDraft('home_team_id', e.target.value)}
                          className="w-full bg-white border border-[#e5e1d8] rounded-xl px-3 py-2 text-sm
                                     focus:outline-none focus:border-[#1a5c38] cursor-pointer"
                        >
                          <option value="">{draft.phase !== 'group' ? '— Nog onbekend —' : '— Kies team —'}</option>
                          {teams.map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </select>
                      </div>

                      {/* Uitteam */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                          Uitteam {draft.phase !== 'group' && <span className="text-gray-400 normal-case font-normal">(zodra bekend)</span>}
                        </label>
                        <select
                          value={draft.away_team_id ?? ''}
                          onChange={e => updateDraft('away_team_id', e.target.value)}
                          className="w-full bg-white border border-[#e5e1d8] rounded-xl px-3 py-2 text-sm
                                     focus:outline-none focus:border-[#1a5c38] cursor-pointer"
                        >
                          <option value="">{draft.phase !== 'group' ? '— Nog onbekend —' : '— Kies team —'}</option>
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

                      {/* Poule (alleen groepsfase) */}
                      {draft.phase === 'group' && (
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
                            {GROUPS.map(g => (
                              <option key={g} value={g}>Poule {g}</option>
                            ))}
                          </select>
                        </div>
                      )}

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

'use client'
import { useState } from 'react'
import type { Team, GroupStandingPrediction } from '@/types'
import { createClient } from '@/lib/supabase/client'

const STATS = [
  { key: 'predicted_points', label: 'Pnt', max: 9 },
  { key: 'goals_for', label: 'GV', max: 99 },
  { key: 'goals_against', label: 'GT', max: 99 },
  { key: 'yellow_cards', label: '🟨', max: 20 },
  { key: 'red_cards', label: '🟥', max: 10 },
] as const

type StatKey = typeof STATS[number]['key']

export default function GroupStandingForm({
  groupId, teams, predictions, userId,
}: {
  groupId: string
  teams: Team[]
  predictions: GroupStandingPrediction[]
  userId: string
}) {
  const supabase = createClient()

  // Build initial order from existing predictions or default team order
  const initOrder = predictions.length === teams.length
    ? [...predictions].sort((a, b) => a.position - b.position).map(p => p.team_id)
    : teams.map(t => t.id)

  const [order, setOrder] = useState<string[]>(initOrder)
  const [stats, setStats] = useState<Record<string, Record<StatKey, number>>>(
    Object.fromEntries(
      teams.map(t => {
        const pred = predictions.find(p => p.team_id === t.id)
        return [t.id, {
          predicted_points: pred?.predicted_points ?? 0,
          goals_for: pred?.goals_for ?? 0,
          goals_against: pred?.goals_against ?? 0,
          yellow_cards: pred?.yellow_cards ?? 0,
          red_cards: pred?.red_cards ?? 0,
        }]
      })
    )
  )
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  function move(idx: number, dir: -1 | 1) {
    const next = idx + dir
    if (next < 0 || next >= order.length) return
    const newOrder = [...order]
    ;[newOrder[idx], newOrder[next]] = [newOrder[next], newOrder[idx]]
    setOrder(newOrder)
    setSaved(false)
  }

  function setStat(teamId: string, key: StatKey, val: number) {
    setStats(s => ({ ...s, [teamId]: { ...s[teamId], [key]: val } }))
    setSaved(false)
  }

  async function handleSave() {
    setSaving(true)
    const rows = order.map((teamId, i) => ({
      user_id: userId,
      group_id: groupId,
      position: i + 1,
      team_id: teamId,
      ...stats[teamId],
    }))

    await supabase
      .from('group_standing_predictions')
      .upsert(rows, { onConflict: 'user_id,group_id,position' })

    setSaving(false)
    setSaved(true)
  }

  return (
    <div className="max-w-xl space-y-3">
      {/* Ranking */}
      <div className="card overflow-hidden">
        <div className="px-4 py-2.5 bg-[#1a5c38] flex justify-between items-center">
          <span className="heading text-sm font-bold text-white">Groep {groupId}</span>
          <span className="text-xs text-white/60">↑↓ sorteren</span>
        </div>
        {order.map((teamId, i) => {
          const team = teams.find(t => t.id === teamId)
          if (!team) return null
          return (
            <div key={teamId}
              className={`flex items-center gap-3 px-4 py-3 border-b border-[#f6f4ef] last:border-0 ${i < 2 ? 'bg-[#eaf4ef]' : 'bg-white'}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${i < 2 ? 'bg-[#1a5c38]' : 'bg-[#e5e1d8]'}`}>
                <span className={`heading text-[11px] font-bold ${i < 2 ? 'text-white' : 'text-[#999]'}`}>{i + 1}</span>
              </div>
              <span className="flex-1 text-sm font-medium">{team.flag} {team.name_nl}</span>
              {i < 2 && <span className="tag bg-[#1a5c38] text-white text-[9px]">door</span>}
              <div className="flex gap-1">
                {([-1, 1] as const).map(dir => (
                  <button key={dir} onClick={() => move(i, dir)}
                    disabled={(dir === -1 && i === 0) || (dir === 1 && i === order.length - 1)}
                    className="w-6 h-6 rounded-md border border-[#e5e1d8] bg-[#f6f4ef] text-xs disabled:opacity-20 cursor-pointer">
                    {dir === -1 ? '↑' : '↓'}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Stats */}
      <div className="card p-4">
        <p className="text-sm font-semibold text-gray-700 mb-3">Statistieken voorspellen</p>
        <div className="flex gap-1.5 mb-2 pl-24">
          {STATS.map(s => (
            <span key={s.key} className="text-[10px] text-[#aaa] text-center flex-1 min-w-[44px]">{s.label}</span>
          ))}
        </div>
        {order.map(teamId => {
          const team = teams.find(t => t.id === teamId)
          if (!team) return null
          return (
            <div key={teamId} className="flex items-center gap-1.5 mb-2.5">
              <span className="text-sm w-24 flex-shrink-0 truncate">{team.flag} {team.name_nl.split(' ')[0]}</span>
              {STATS.map(s => (
                <input
                  key={s.key}
                  type="number" min="0" max={s.max}
                  value={stats[teamId]?.[s.key] ?? 0}
                  onChange={e => setStat(teamId, s.key, parseInt(e.target.value) || 0)}
                  className="input-score text-sm font-bold flex-1 min-w-[44px] h-11"
                />
              ))}
            </div>
          )
        })}
      </div>

      <button onClick={handleSave} disabled={saving}
        className={`btn-primary w-full py-3 text-sm disabled:opacity-50 ${saved ? 'bg-green-600' : ''}`}>
        {saving ? 'Opslaan...' : saved ? `✓ Groep ${groupId} opgeslagen` : `Groep ${groupId} opslaan`}
      </button>
    </div>
  )
}

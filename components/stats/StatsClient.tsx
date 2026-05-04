'use client'
import { useState } from 'react'
import type { Match, LeaderboardEntry } from '@/types'
import { createClient } from '@/lib/supabase/client'

const EMOJIS = ['🔥','😭','😤','🎉','🤯','😂','👏','💀']

function EmojiReactions({
  matchId, reactions, currentUserId,
}: {
  matchId: string
  reactions: Array<{ id: string; user_id: string; match_id: string; emoji: string }>
  currentUserId: string
}) {
  const supabase = createClient()
  const [localReactions, setLocalReactions] = useState(reactions.filter(r => r.match_id === matchId))

  const counts = EMOJIS.reduce((acc, e) => {
    acc[e] = localReactions.filter(r => r.emoji === e).length
    return acc
  }, {} as Record<string, number>)

  const myReactions = new Set(localReactions.filter(r => r.user_id === currentUserId).map(r => r.emoji))

  async function toggleReaction(emoji: string) {
    if (myReactions.has(emoji)) {
      // Remove
      setLocalReactions(prev => prev.filter(r => !(r.user_id === currentUserId && r.emoji === emoji)))
      await supabase.from('match_reactions')
        .delete()
        .eq('user_id', currentUserId)
        .eq('match_id', matchId)
        .eq('emoji', emoji)
    } else {
      // Add
      const newR = { id: crypto.randomUUID(), user_id: currentUserId, match_id: matchId, emoji }
      setLocalReactions(prev => [...prev, newR])
      await supabase.from('match_reactions').insert({ user_id: currentUserId, match_id: matchId, emoji })
    }
  }

  const activeEmojis = EMOJIS.filter(e => counts[e] > 0 || myReactions.has(e))
  const inactiveEmojis = EMOJIS.filter(e => counts[e] === 0 && !myReactions.has(e))
  const [showAll, setShowAll] = useState(false)

  return (
    <div className="flex flex-wrap gap-1.5 mt-3">
      {(showAll ? EMOJIS : activeEmojis).map(emoji => (
        <button key={emoji} onClick={() => toggleReaction(emoji)}
          className={`flex items-center gap-1 px-2 py-1 rounded-full text-sm border transition-all cursor-pointer ${
            myReactions.has(emoji)
              ? 'bg-[#eaf4ef] border-[#1a5c38] text-[#1a5c38]'
              : 'bg-white border-[#e5e1d8] text-gray-600 hover:border-[#1a5c38]'
          }`}>
          <span>{emoji}</span>
          {counts[emoji] > 0 && <span className="text-xs font-semibold">{counts[emoji]}</span>}
        </button>
      ))}
      {!showAll && inactiveEmojis.length > 0 && (
        <button onClick={() => setShowAll(true)}
          className="flex items-center gap-1 px-2.5 py-1 rounded-full text-sm border border-dashed border-[#e5e1d8] text-[#aaa] cursor-pointer hover:border-[#1a5c38] bg-white">
          <span>+</span>
        </button>
      )}
    </div>
  )
}

export default function StatsClient({
  leaderboard, finishedMatches, reactions, activityFeed, currentUserId,
}: {
  leaderboard: (LeaderboardEntry & { rank: number })[]
  finishedMatches: (Match & { home_team: { name_nl: string; flag: string } | null; away_team: { name_nl: string; flag: string } | null })[]
  reactions: Array<{ id: string; user_id: string; match_id: string; emoji: string }>
  activityFeed: Array<{ id: string; type: string; user_id: string | null; match_id: string | null; title: string; body: string | null; emoji: string | null; created_at: string }>
  currentUserId: string
}) {
  const [tab, setTab] = useState<'feed' | 'stats'>('feed')

  // Heatmap data
  const maxPts = Math.max(...leaderboard.map(p => p.total_points), 1)

  // Bump chart data (use total_points as proxy, in real app per-day data)
  const TRACKED_COLORS: Record<string, string> = {}
  const PALETTE = ['#1a5c38', '#c9930a', '#3b82f6', '#9333ea']
  leaderboard.slice(0, 4).forEach((p, i) => { TRACKED_COLORS[p.user_id] = PALETTE[i] })

  return (
    <div>
      <div className="hidden lg:flex items-center justify-between px-8 py-5 bg-white border-b border-[#e5e1d8]">
        <div>
          <h1 className="heading text-xl font-extrabold text-[#1a5c38]">Statistieken</h1>
          <p className="text-sm text-[#aaa] mt-0.5">De strijd in beeld</p>
        </div>
        <div className="flex gap-1 bg-[#f6f4ef] rounded-xl p-1">
          {[['feed', '📰 Feed'], ['stats', '📊 Statistieken']].map(([v, l]) => (
            <button key={v} onClick={() => setTab(v as 'feed' | 'stats')}
              className={`px-4 py-1.5 rounded-lg text-sm font-semibold border-0 cursor-pointer transition-colors ${tab === v ? 'bg-white text-[#1a5c38] shadow-sm' : 'bg-transparent text-[#aaa]'}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Mobile tabs */}
      <div className="lg:hidden bg-white border-b border-[#e5e1d8] flex px-4">
        {[['feed', '📰 Feed'], ['stats', '📊 Stats']].map(([v, l]) => (
          <button key={v} onClick={() => setTab(v as 'feed' | 'stats')}
            className={`px-4 py-3 text-sm border-b-2 -mb-px cursor-pointer border-0 bg-transparent transition-colors ${tab === v ? 'border-[#1a5c38] text-[#1a5c38] font-semibold' : 'border-transparent text-[#aaa]'}`}>
            {l}
          </button>
        ))}
      </div>

      <div className="p-4 lg:p-8 space-y-5">
        {/* ── FEED TAB ── */}
        {tab === 'feed' && (
          <div className="max-w-2xl space-y-4">
            {/* Finished matches with emoji reactions */}
            {finishedMatches.length > 0 && (
              <div>
                <h2 className="text-xs font-semibold text-[#aaa] uppercase tracking-wider mb-3">Gespeelde wedstrijden</h2>
                <div className="space-y-3">
                  {finishedMatches.map(m => (
                    <div key={m.id} className="card p-4">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="text-sm font-semibold flex-1">
                          {m.home_team?.flag} {m.home_team?.name_nl}
                        </span>
                        <span className="heading text-xl font-extrabold text-[#1a5c38]">
                          {m.home_ft}–{m.away_ft}
                        </span>
                        <span className="text-sm font-semibold flex-1 text-right">
                          {m.away_team?.name_nl} {m.away_team?.flag}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#aaa] mb-2">
                        rust {m.home_ht}–{m.away_ht} ·{' '}
                        {new Date(m.scheduled_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
                      </p>
                      <EmojiReactions
                        matchId={m.id}
                        reactions={reactions}
                        currentUserId={currentUserId}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Activity feed */}
            {activityFeed.length > 0 && (
              <div>
                <h2 className="text-xs font-semibold text-[#aaa] uppercase tracking-wider mb-3">Activiteit</h2>
                <div className="space-y-2">
                  {activityFeed.map(item => (
                    <div key={item.id} className="card px-4 py-3 flex items-start gap-3">
                      <span className="text-xl flex-shrink-0">{item.emoji || '📌'}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">{item.title}</p>
                        {item.body && <p className="text-xs text-[#aaa] mt-0.5">{item.body}</p>}
                        <p className="text-[11px] text-[#ccc] mt-1">
                          {new Date(item.created_at).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })} ·{' '}
                          {new Date(item.created_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activityFeed.length === 0 && finishedMatches.length === 0 && (
              <div className="text-center py-16 text-[#aaa]">
                <p className="text-4xl mb-3">⚽</p>
                <p className="text-sm font-medium text-gray-600 mb-1">Het toernooi is nog niet begonnen</p>
                <p className="text-sm">Activiteit verschijnt hier zodra wedstrijden gespeeld zijn.</p>
              </div>
            )}
          </div>
        )}

        {/* ── STATS TAB ── */}
        {tab === 'stats' && (
          <div className="space-y-5">
            {/* Heatmap */}
            <div className="card p-4 lg:p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-1">Punten per categorie</h2>
              <p className="text-xs text-[#aaa] mb-4">Hoe zijn de punten verdeeld per deelnemer?</p>
              <div className="space-y-2">
                {leaderboard.map(p => (
                  <div key={p.user_id} className="flex items-center gap-3">
                    <span className={`text-xs w-24 flex-shrink-0 truncate ${p.user_id === currentUserId ? 'font-semibold text-[#1a5c38]' : 'text-[#888]'}`}>
                      {p.display_name}
                    </span>
                    <div className="flex-1 flex gap-1">
                      {[
                        { val: p.match_points, color: '#1a5c38', label: '⚽' },
                        { val: p.group_points, color: '#3b82f6', label: '📊' },
                        { val: p.bonus_points, color: '#c9930a', label: '🎯' },
                      ].map(({ val, color, label }) => (
                        <div key={label} title={`${label} ${val} pt`}
                          style={{ flex: val || 0.5, height: 24, background: color, opacity: 0.7, borderRadius: 4, minWidth: val > 0 ? 4 : 0 }}
                          className="flex items-center justify-center">
                          {val > 8 && <span className="text-[9px] font-bold text-white">{val}</span>}
                        </div>
                      ))}
                    </div>
                    <span className="heading text-sm font-bold w-8 text-right">{p.total_points}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-4 mt-3">
                {[['⚽', '#1a5c38', 'Wedstrijden'], ['📊', '#3b82f6', 'Poulestand'], ['🎯', '#c9930a', 'Bonus']].map(([icon, color, lbl]) => (
                  <div key={lbl} className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-sm" style={{ background: color as string, opacity: 0.7 }} />
                    <span className="text-xs text-[#888]">{lbl}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Top scores */}
            <div className="card overflow-hidden">
              <div className="px-4 py-3 border-b border-[#f6f4ef]">
                <h2 className="text-sm font-semibold text-gray-700">Top 3</h2>
              </div>
              {leaderboard.slice(0, 3).map(p => (
                <div key={p.user_id} className={`flex items-center gap-3 px-4 py-4 border-b border-[#f6f4ef] last:border-0 ${p.user_id === currentUserId ? 'bg-[#eaf4ef]' : ''}`}>
                  <span className="text-2xl w-8 text-center">
                    {p.rank === 1 ? '🥇' : p.rank === 2 ? '🥈' : '🥉'}
                  </span>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${p.user_id === currentUserId ? 'bg-[#1a5c38]' : 'bg-[#e5e1d8]'}`}>
                    <span className={`heading font-bold ${p.user_id === currentUserId ? 'text-white' : 'text-[#777]'}`}>{p.display_name[0]}</span>
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm font-semibold ${p.user_id === currentUserId ? 'text-[#1a5c38]' : ''}`}>{p.display_name}</p>
                    <p className="text-xs text-[#aaa]">{p.match_points} wed. · {p.group_points} poule · {p.bonus_points} bonus</p>
                  </div>
                  <span className="heading text-2xl font-extrabold">{p.total_points}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

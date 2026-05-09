'use client'
import { useState } from 'react'
import type { LeaderboardEntry } from '@/types'

export default function StandClient({
  leaderboard, currentUserId,
}: {
  leaderboard: (LeaderboardEntry & { rank: number })[]
  currentUserId: string
  matchPredictions?: Array<{ user_id: string; points: number; match: { scheduled_at: string } | null }>
}) {
  const [view, setView] = useState<'total' | 'breakdown'>('total')
  const topEntry = leaderboard[0]

  return (
    <div>
      {/* Header */}
      <div className="hidden lg:flex items-center justify-between px-8 py-5 bg-white border-b border-[#e5e1d8]">
        <div>
          <h1 className="heading text-xl font-extrabold text-[#1a5c38]">Tussenstand</h1>
          <p className="text-sm text-[#aaa] mt-0.5">Gebaseerd op alle berekende wedstrijden</p>
        </div>
        <div className="flex gap-1 bg-[#f6f4ef] rounded-xl p-1">
          {[['total', 'Totaal'], ['breakdown', 'Breakdown']].map(([v, l]) => (
            <button key={v} onClick={() => setView(v as 'total' | 'breakdown')}
              className={`px-4 py-1.5 rounded-lg text-sm font-semibold border-0 cursor-pointer transition-colors ${
                view === v ? 'bg-white text-[#1a5c38] shadow-sm' : 'bg-transparent text-[#aaa]'
              }`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 lg:p-8">
        {/* Leader banner */}
        {topEntry && (
          <div className="bg-[#1a5c38] rounded-2xl px-5 py-4 mb-5 flex justify-between items-center">
            <div>
              <p className="text-xs text-white/60 mb-1">Leider</p>
              <p className="heading text-lg font-extrabold text-white">{topEntry.display_name} 🏅</p>
            </div>
            <div className="text-right">
              <p className="heading text-2xl font-extrabold text-white">{topEntry.total_points} pt</p>
              <p className="text-xs text-white/60">{topEntry.match_points}+{topEntry.group_points}+{topEntry.bonus_points}</p>
            </div>
          </div>
        )}

        {/* Leaderboard */}
        <div className="card">
          {leaderboard.map(p => (
            <div key={p.user_id}
              className={`flex items-center gap-3 px-4 py-3.5 border-b border-[#f6f4ef] last:border-0 ${
                p.user_id === currentUserId ? 'bg-[#eaf4ef]' : 'bg-white'
              }`}>
              <span className={`w-6 text-center flex-shrink-0 ${p.rank <= 3 ? 'text-xl' : 'text-xs font-bold text-[#ccc]'}`}>
                {p.rank === 1 ? '🥇' : p.rank === 2 ? '🥈' : p.rank === 3 ? '🥉' : p.rank}
              </span>
              <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                p.user_id === currentUserId ? 'bg-[#1a5c38]' : 'bg-[#e5e1d8]'
              }`}>
                <span className={`heading text-sm font-bold ${p.user_id === currentUserId ? 'text-white' : 'text-[#777]'}`}>
                  {p.display_name[0]}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm ${p.user_id === currentUserId ? 'font-semibold text-[#1a5c38]' : 'font-medium'}`}>
                  {p.display_name}{p.user_id === currentUserId ? ' (jij)' : ''}
                </p>
                {view === 'breakdown' && (
                  <p className="text-[11px] text-[#aaa] mt-0.5">
                    ⚽ {p.match_points} · 📊 {p.group_points} · 🎯 {p.bonus_points}
                  </p>
                )}
              </div>
              <span className="heading text-xl font-extrabold">{p.total_points}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

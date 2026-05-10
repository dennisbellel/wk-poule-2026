'use client'
import type { LeaderboardEntry } from '@/types'

export default function StatsClient({
  leaderboard, currentUserId,
}: {
  leaderboard: (LeaderboardEntry & { rank: number })[]
  currentUserId: string
}) {
  return (
    <div>
      <div className="hidden lg:flex items-center justify-between px-8 py-5 bg-white border-b border-[#e5e1d8]">
        <div>
          <h1 className="heading text-xl font-extrabold text-[#1a5c38]">Statistieken</h1>
          <p className="text-sm text-[#aaa] mt-0.5">De strijd in beeld</p>
        </div>
      </div>

      <div className="p-4 lg:p-8">
        <div className="max-w-2xl mx-auto space-y-5">
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
                      { val: p.match_points, color: '#1a5c38' },
                      { val: p.group_points, color: '#3b82f6' },
                      { val: p.bonus_points, color: '#c9930a' },
                    ].map(({ val, color }, i) => (
                      <div key={i} title={`${val} pt`}
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
              {[['#1a5c38', 'Wedstrijden'], ['#3b82f6', 'Poulestand'], ['#c9930a', 'Bonus']].map(([color, lbl]) => (
                <div key={lbl} className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm" style={{ background: color, opacity: 0.7 }} />
                  <span className="text-xs text-[#888]">{lbl}</span>
                </div>
              ))}
            </div>
          </div>

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
      </div>
    </div>
  )
}

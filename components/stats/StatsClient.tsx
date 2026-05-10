'use client'

type RankPoint = { rank: number; at: string }
type AccuracyEntry = { user_id: string; display_name: string; exact: number; predicted: number; pct: number }
type TopScorerEntry = { user_id: string; display_name: string; count: number }
type ClimberEntry = { user_id: string; display_name: string; rank: number; delta: number | null }

function RankChart({ data, totalUsers }: { data: RankPoint[]; totalUsers: number }) {
  if (data.length === 0) {
    return (
      <div className="text-center py-10 text-[#aaa] text-sm">
        Nog geen geschiedenis — verschijnt zodra er uitslagen gepubliceerd zijn.
      </div>
    )
  }

  const W = 600
  const H = 200
  const padX = 30
  const padY = 20
  const innerW = W - padX * 2
  const innerH = H - padY * 2

  // X-as: tijd. Y-as: rank (lager = beter, dus 1 bovenaan)
  const minTime = new Date(data[0].at).getTime()
  const maxTime = new Date(data[data.length - 1].at).getTime()
  const timeRange = Math.max(maxTime - minTime, 1)
  const maxRank = Math.max(totalUsers, ...data.map(d => d.rank))

  const points = data.map(d => {
    const t = new Date(d.at).getTime()
    const x = padX + ((t - minTime) / timeRange) * innerW
    const y = padY + ((d.rank - 1) / Math.max(maxRank - 1, 1)) * innerH
    return { x, y, ...d }
  })

  // Single point edge case
  if (points.length === 1) {
    points[0].x = padX + innerW / 2
  }

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')

  // Y-as labels: 1, midden, totaal
  const yTicks = [1, Math.ceil(maxRank / 2), maxRank]

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 320 }}>
        {/* Y-as gridlines */}
        {yTicks.map(t => {
          const y = padY + ((t - 1) / Math.max(maxRank - 1, 1)) * innerH
          return (
            <g key={t}>
              <line x1={padX} y1={y} x2={W - padX} y2={y} stroke="#f0ede6" strokeWidth="1" />
              <text x={padX - 6} y={y + 3} fontSize="9" fill="#aaa" textAnchor="end">#{t}</text>
            </g>
          )
        })}
        {/* Lijn */}
        <path d={pathD} fill="none" stroke="#1a5c38" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {/* Punten */}
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="3" fill="#1a5c38" />
        ))}
        {/* X-as labels: eerste en laatste datum */}
        <text x={padX} y={H - 4} fontSize="9" fill="#aaa">
          {new Date(data[0].at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
        </text>
        <text x={W - padX} y={H - 4} fontSize="9" fill="#aaa" textAnchor="end">
          {new Date(data[data.length - 1].at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
        </text>
      </svg>
    </div>
  )
}

export default function StatsClient({
  leaderboardSize, currentUserId, myRankHistory, accuracy, topScorers, climbers, fallers,
}: {
  leaderboardSize: number
  currentUserId: string
  myRankHistory: RankPoint[]
  accuracy: AccuracyEntry[]
  topScorers: TopScorerEntry[]
  climbers: ClimberEntry[]
  fallers: ClimberEntry[]
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
        <div className="max-w-3xl mx-auto space-y-5">

          {/* Lijngrafiek: jouw positie over tijd */}
          <div className="card p-4 lg:p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-1">Mijn positie over tijd</h2>
            <p className="text-xs text-[#aaa] mb-3">Hoe sta jij ervoor sinds de eerste publicatie?</p>
            <RankChart data={myRankHistory} totalUsers={leaderboardSize} />
          </div>

          {/* Trefzekerheid */}
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-[#f6f4ef]">
              <h2 className="text-sm font-semibold text-gray-700">Trefzekerheid</h2>
              <p className="text-[11px] text-[#aaa] mt-0.5">% wedstrijden waarin je de exacte eindstand goed had</p>
            </div>
            {accuracy.length === 0 || accuracy.every(a => a.predicted === 0) ? (
              <div className="px-4 py-8 text-center text-sm text-[#aaa]">Nog geen voorspellingen om te beoordelen</div>
            ) : (
              accuracy.map((a, i) => (
                <div key={a.user_id} className={`flex items-center gap-3 px-4 py-3 border-b border-[#f6f4ef] last:border-0 ${a.user_id === currentUserId ? 'bg-[#eaf4ef]' : ''}`}>
                  <span className="w-5 text-xs font-bold text-[#ccc]">{i + 1}</span>
                  <span className={`flex-1 text-sm ${a.user_id === currentUserId ? 'font-semibold text-[#1a5c38]' : ''}`}>{a.display_name}</span>
                  <span className="text-xs text-[#aaa]">{a.exact}/{a.predicted}</span>
                  <span className="heading text-base font-bold text-[#1a5c38] w-12 text-right">{a.pct}%</span>
                </div>
              ))
            )}
          </div>

          {/* Topscoorder per wedstrijd */}
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-[#f6f4ef]">
              <h2 className="text-sm font-semibold text-gray-700">Topscoorder per wedstrijd</h2>
              <p className="text-[11px] text-[#aaa] mt-0.5">Hoe vaak heb je de hoogste score in één wedstrijd gehaald?</p>
            </div>
            {topScorers.length === 0 || topScorers.every(t => t.count === 0) ? (
              <div className="px-4 py-8 text-center text-sm text-[#aaa]">Nog geen gepubliceerde wedstrijden</div>
            ) : (
              topScorers.filter(t => t.count > 0).map((t, i) => (
                <div key={t.user_id} className={`flex items-center gap-3 px-4 py-3 border-b border-[#f6f4ef] last:border-0 ${t.user_id === currentUserId ? 'bg-[#eaf4ef]' : ''}`}>
                  <span className="w-5 text-xs font-bold text-[#ccc]">{i + 1}</span>
                  <span className={`flex-1 text-sm ${t.user_id === currentUserId ? 'font-semibold text-[#1a5c38]' : ''}`}>{t.display_name}</span>
                  <span className="heading text-base font-bold w-16 text-right">{t.count}× 🏆</span>
                </div>
              ))
            )}
          </div>

          {/* Klimmers + Dalers naast elkaar op desktop */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="card overflow-hidden">
              <div className="px-4 py-3 border-b border-[#f6f4ef]">
                <h2 className="text-sm font-semibold text-gray-700">📈 Grootste klimmers</h2>
                <p className="text-[11px] text-[#aaa] mt-0.5">Sprong omhoog sinds de vorige publicatie</p>
              </div>
              {climbers.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-[#aaa]">Nog niemand is gestegen</div>
              ) : (
                climbers.map(c => (
                  <div key={c.user_id} className={`flex items-center gap-3 px-4 py-3 border-b border-[#f6f4ef] last:border-0 ${c.user_id === currentUserId ? 'bg-[#eaf4ef]' : ''}`}>
                    <span className="w-5 text-xs font-bold text-[#ccc]">#{c.rank}</span>
                    <span className={`flex-1 text-sm truncate ${c.user_id === currentUserId ? 'font-semibold text-[#1a5c38]' : ''}`} title={c.display_name}>{c.display_name}</span>
                    <span className="heading text-base font-bold text-green-600">▲ {c.delta}</span>
                  </div>
                ))
              )}
            </div>

            <div className="card overflow-hidden">
              <div className="px-4 py-3 border-b border-[#f6f4ef]">
                <h2 className="text-sm font-semibold text-gray-700">📉 Grootste dalers</h2>
                <p className="text-[11px] text-[#aaa] mt-0.5">Plekken verloren sinds de vorige publicatie</p>
              </div>
              {fallers.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-[#aaa]">Nog niemand is gezakt</div>
              ) : (
                fallers.map(c => (
                  <div key={c.user_id} className={`flex items-center gap-3 px-4 py-3 border-b border-[#f6f4ef] last:border-0 ${c.user_id === currentUserId ? 'bg-[#eaf4ef]' : ''}`}>
                    <span className="w-5 text-xs font-bold text-[#ccc]">#{c.rank}</span>
                    <span className={`flex-1 text-sm truncate ${c.user_id === currentUserId ? 'font-semibold text-[#1a5c38]' : ''}`} title={c.display_name}>{c.display_name}</span>
                    <span className="heading text-base font-bold text-red-500">▼ {Math.abs(c.delta ?? 0)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

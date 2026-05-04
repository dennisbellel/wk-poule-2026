const BASE_URL = 'https://api.football-data.org/v4'
const API_KEY = process.env.FOOTBALL_DATA_API_KEY!
// FIFA World Cup 2026 competition ID
const WC_2026_ID = 2026

async function fetchFD(path: string) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'X-Auth-Token': API_KEY },
    next: { revalidate: 300 }, // 5 min cache
  })
  if (!res.ok) throw new Error(`football-data.org error: ${res.status} ${path}`)
  return res.json()
}

export interface FDMatch {
  id: number
  utcDate: string
  status: 'SCHEDULED' | 'TIMED' | 'IN_PLAY' | 'PAUSED' | 'FINISHED' | 'SUSPENDED' | 'POSTPONED' | 'CANCELLED' | 'AWARDED'
  stage: string
  group: string | null
  homeTeam: { id: number; name: string; shortName: string; crest: string } | null
  awayTeam: { id: number; name: string; shortName: string; crest: string } | null
  score: {
    winner: 'HOME_TEAM' | 'AWAY_TEAM' | 'DRAW' | null
    duration: 'REGULAR' | 'EXTRA_TIME' | 'PENALTY_SHOOTOUT'
    fullTime: { home: number | null; away: number | null }
    halfTime: { home: number | null; away: number | null }
    extraTime?: { home: number | null; away: number | null }
    penalties?: { home: number | null; away: number | null }
  }
  venue: string | null
  referees: Array<{ name: string }>
}

export interface FDTeam {
  id: number
  name: string
  shortName: string
  tla: string
  crest: string
}

export async function getCompetitionMatches(): Promise<FDMatch[]> {
  try {
    const data = await fetchFD(`/competitions/${WC_2026_ID}/matches`)
    return data.matches || []
  } catch (e) {
    console.error('Failed to fetch matches:', e)
    return []
  }
}

export async function getCompetitionTeams(): Promise<FDTeam[]> {
  try {
    const data = await fetchFD(`/competitions/${WC_2026_ID}/teams`)
    return data.teams || []
  } catch (e) {
    console.error('Failed to fetch teams:', e)
    return []
  }
}

export async function getMatch(matchId: number): Promise<FDMatch | null> {
  try {
    return await fetchFD(`/matches/${matchId}`)
  } catch (e) {
    console.error('Failed to fetch match:', e)
    return null
  }
}

// Map football-data.org status to our status
export function mapStatus(fdStatus: string): 'scheduled' | 'live' | 'finished' {
  if (['FINISHED', 'AWARDED'].includes(fdStatus)) return 'finished'
  if (['IN_PLAY', 'PAUSED'].includes(fdStatus)) return 'live'
  return 'scheduled'
}

// Map football-data.org stage to our phase
export function mapPhase(stage: string): string {
  const map: Record<string, string> = {
    'GROUP_STAGE': 'group',
    'LAST_32': 'r32',
    'LAST_16': 'r16',
    'QUARTER_FINALS': 'qf',
    'SEMI_FINALS': 'sf',
    'THIRD_PLACE': 'third',
    'FINAL': 'final',
  }
  return map[stage] || 'group'
}

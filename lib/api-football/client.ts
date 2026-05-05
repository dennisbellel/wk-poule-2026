const BASE = 'https://v3.football.api-sports.io'
const KEY = process.env.APIFOOTBALL_KEY!
const LEAGUE = 1    // FIFA World Cup
const SEASON = 2026

async function get(path: string) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'x-apisports-key': KEY },
    next: { revalidate: 300 },
  })
  if (!res.ok) throw new Error(`API-Football error: ${res.status}`)
  return res.json()
}

export interface AFFixture {
  fixture: {
    id: number
    date: string
    status: { short: string; long: string }
    venue: { name: string; city: string }
  }
  teams: {
    home: { id: number; name: string }
    away: { id: number; name: string }
  }
  goals: { home: number | null; away: number | null }
  score: {
    halftime: { home: number | null; away: number | null }
    fulltime: { home: number | null; away: number | null }
    extratime: { home: number | null; away: number | null }
    penalty: { home: number | null; away: number | null }
  }
}

export interface AFEvent {
  time: { elapsed: number }
  team: { id: number; name: string }
  player: { name: string }
  type: string   // 'Card' | 'Goal' | 'subst'
  detail: string // 'Yellow Card' | 'Red Card' | 'Normal Goal' etc
}

export async function getFinishedMatches(): Promise<AFFixture[]> {
  try {
    const data = await get(`/fixtures?league=${LEAGUE}&season=${SEASON}&status=FT`)
    return data.response || []
  } catch (e) {
    console.error('API-Football fixtures error:', e)
    return []
  }
}

export async function getMatchEvents(fixtureId: number): Promise<AFEvent[]> {
  try {
    const data = await get(`/fixtures/events?fixture=${fixtureId}`)
    return data.response || []
  } catch (e) {
    console.error('API-Football events error:', e)
    return []
  }
}

export async function getLiveMatches(): Promise<AFFixture[]> {
  try {
    const data = await get(`/fixtures?league=${LEAGUE}&season=${SEASON}&live=all`)
    return data.response || []
  } catch (e) {
    console.error('API-Football live error:', e)
    return []
  }
}

export function mapStatus(status: string): 'scheduled' | 'live' | 'finished' {
  if (['FT', 'AET', 'PEN', 'AWD'].includes(status)) return 'finished'
  if (['1H', '2H', 'ET', 'BT', 'P', 'INT', 'LIVE'].includes(status)) return 'live'
  return 'scheduled'
}
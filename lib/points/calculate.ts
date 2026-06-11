import type { Match, MatchPrediction, GroupStandingPrediction, ScoringKeys } from '@/types'

// ─── MATCH POINTS ─────────────────────────────────────────────────────────────
// Per-input scoring: elke goede team-input krijgt zijn punten apart.
// Bonus voor exact eindstand of exact ruststand komt er bovenop.
export function calculateMatchPoints(
  match: Match,
  prediction: MatchPrediction,
  scoring: ScoringKeys
): number {
  return calculateMatchPointsBreakdown(match, prediction, scoring).total
}

// ─── BREAKDOWN PER ONDERDEEL ──────────────────────────────────────────────────
// Per-input scoring met bonus voor volledig exacte voorspelling.
export interface MatchPointsBreakdown {
  ft_home: number           // home_ft correct → match_ft_team
  ft_away: number           // away_ft correct → match_ft_team
  ft_exact_bonus: number    // beide ft kloppen → match_ft_exact_bonus
  ht_home: number
  ht_away: number
  ht_exact_bonus: number
  yellow_home: number
  yellow_away: number
  red_home: number
  red_away: number
  et: number
  pens: number
  winner: number
  total: number
}

function emptyBreakdown(): MatchPointsBreakdown {
  return {
    ft_home: 0, ft_away: 0, ft_exact_bonus: 0,
    ht_home: 0, ht_away: 0, ht_exact_bonus: 0,
    yellow_home: 0, yellow_away: 0,
    red_home: 0, red_away: 0,
    et: 0, pens: 0, winner: 0, total: 0,
  }
}

export function calculateMatchPointsBreakdown(
  match: Match,
  prediction: Partial<MatchPrediction>,
  scoring: ScoringKeys
): MatchPointsBreakdown {
  const b = emptyBreakdown()
  if (match.status !== 'finished') return b

  // Eindstand per kant
  if (match.home_ft !== null && prediction.home_ft != null && prediction.home_ft === match.home_ft) {
    b.ft_home = scoring.match_ft_team
  }
  if (match.away_ft !== null && prediction.away_ft != null && prediction.away_ft === match.away_ft) {
    b.ft_away = scoring.match_ft_team
  }
  // Bonus: beide ft volledig exact
  if (match.home_ft !== null && match.away_ft !== null &&
      prediction.home_ft != null && prediction.away_ft != null &&
      prediction.home_ft === match.home_ft && prediction.away_ft === match.away_ft) {
    b.ft_exact_bonus = scoring.match_ft_exact_bonus
  }

  // Ruststand per kant
  if (match.home_ht !== null && prediction.home_ht != null && prediction.home_ht === match.home_ht) {
    b.ht_home = scoring.match_ht_team
  }
  if (match.away_ht !== null && prediction.away_ht != null && prediction.away_ht === match.away_ht) {
    b.ht_away = scoring.match_ht_team
  }
  if (match.home_ht !== null && match.away_ht !== null &&
      prediction.home_ht != null && prediction.away_ht != null &&
      prediction.home_ht === match.home_ht && prediction.away_ht === match.away_ht) {
    b.ht_exact_bonus = scoring.match_ht_exact_bonus
  }

  // Gele kaarten per kant
  if (match.home_yellow !== null && prediction.home_yellow != null && prediction.home_yellow === match.home_yellow) {
    b.yellow_home = scoring.match_yellow_team
  }
  if (match.away_yellow !== null && prediction.away_yellow != null && prediction.away_yellow === match.away_yellow) {
    b.yellow_away = scoring.match_yellow_team
  }

  // Rode kaarten per kant
  if (match.home_red !== null && prediction.home_red != null && prediction.home_red === match.home_red) {
    b.red_home = scoring.match_red_team
  }
  if (match.away_red !== null && prediction.away_red != null && prediction.away_red === match.away_red) {
    b.red_away = scoring.match_red_team
  }

  // Knockout extras
  if (match.phase !== 'group') {
    const actualEt = match.home_et !== null
    if (prediction.et_predicted != null && prediction.et_predicted === actualEt) b.et = scoring.knockout_et
    if (prediction.pens_predicted != null && prediction.pens_predicted === match.penalties) b.pens = scoring.knockout_pens
    if (prediction.winner_team_id && match.winner_team_id && prediction.winner_team_id === match.winner_team_id) b.winner = scoring.knockout_winner
  }

  b.total = b.ft_home + b.ft_away + b.ft_exact_bonus
          + b.ht_home + b.ht_away + b.ht_exact_bonus
          + b.yellow_home + b.yellow_away
          + b.red_home + b.red_away
          + b.et + b.pens + b.winner
  return b
}

// ─── GRANULAIRE SCORE BREAKDOWN ───────────────────────────────────────────────
// Telt het totaal aantal correcte individuele inputs.
// Wordt gebruikt als tiebreaker in de tussenstand én voor "goede antwoorden" stat.
export function countCorrectInputs(
  match: Match,
  prediction: MatchPrediction
): number {
  if (match.status !== 'finished') return 0
  let correct = 0

  if (match.home_ft !== null && prediction.home_ft === match.home_ft) correct++
  if (match.away_ft !== null && prediction.away_ft === match.away_ft) correct++
  if (match.home_ht !== null && prediction.home_ht === match.home_ht) correct++
  if (match.away_ht !== null && prediction.away_ht === match.away_ht) correct++
  if (match.home_yellow !== null && prediction.home_yellow === match.home_yellow) correct++
  if (match.away_yellow !== null && prediction.away_yellow === match.away_yellow) correct++
  if (match.home_red !== null && prediction.home_red === match.home_red) correct++
  if (match.away_red !== null && prediction.away_red === match.away_red) correct++

  return correct
}

// ─── GROUP STANDING POINTS ────────────────────────────────────────────────────
export interface ActualGroupStanding {
  team_id: string
  position: number
  points: number
  goals_for: number
  goals_against: number
  yellow_cards: number
  red_cards: number
}

export function calculateGroupStandingPoints(
  prediction: GroupStandingPrediction,
  actual: ActualGroupStanding | undefined,
  scoring: ScoringKeys
): number {
  if (!actual) return 0
  if (prediction.team_id !== actual.team_id) return 0

  let points = 0
  if (prediction.position === actual.position) points += scoring.group_position
  if (prediction.predicted_points === actual.points) points += scoring.group_points
  if (prediction.goals_for === actual.goals_for) points += scoring.group_gf
  if (prediction.goals_against === actual.goals_against) points += scoring.group_ga
  if (prediction.yellow_cards === actual.yellow_cards) points += scoring.group_yellow
  if (prediction.red_cards === actual.red_cards) points += scoring.group_red

  return points
}

// ─── BONUS POINTS ─────────────────────────────────────────────────────────────
export function calculateBonusPoints(
  answer: string,
  correctAnswer: string,
  pointsValue: number
): number {
  if (!answer || !correctAnswer) return 0
  const user = answer.trim().toLowerCase()
  // Admin kan meerdere geldige antwoorden invoeren, gescheiden door komma's.
  // Bv. correct_answer = "Memphis, Gakpo, Bergwijn" → elk van die spelers telt.
  const validAnswers = correctAnswer
    .split(',')
    .map(a => a.trim().toLowerCase())
    .filter(Boolean)

  // Match strikt op gelijkheid OF user-answer begint met de valide tekst
  // (bv. valid "Memphis" matcht ook met opgeslagen "Memphis (Nederland)").
  return validAnswers.some(v => user === v || user.startsWith(v + ' ') || user.startsWith(v + '('))
    ? pointsValue
    : 0
}

// ─── WERKELIJKE POULESTAND ────────────────────────────────────────────────────
// Aggregeert gespeelde groepswedstrijden tot een werkelijke stand per groep.
// Gedeeld door /api/admin/recalculate-all en /api/admin/publish-result.
export function computeActualStandings(matches: Match[]): Map<string, ActualGroupStanding[]> {
  const byGroup = new Map<string, Map<string, ActualGroupStanding>>()

  for (const m of matches) {
    if (!m.group_id || m.home_ft === null || m.away_ft === null) continue
    if (!m.home_team_id || !m.away_team_id) continue

    if (!byGroup.has(m.group_id)) byGroup.set(m.group_id, new Map())
    const g = byGroup.get(m.group_id)!

    const ensure = (teamId: string): ActualGroupStanding => {
      if (!g.has(teamId)) {
        g.set(teamId, { team_id: teamId, position: 0, points: 0, goals_for: 0, goals_against: 0, yellow_cards: 0, red_cards: 0 })
      }
      return g.get(teamId)!
    }

    const home = ensure(m.home_team_id)
    const away = ensure(m.away_team_id)

    home.goals_for += m.home_ft
    home.goals_against += m.away_ft
    away.goals_for += m.away_ft
    away.goals_against += m.home_ft
    home.yellow_cards += m.home_yellow ?? 0
    away.yellow_cards += m.away_yellow ?? 0
    home.red_cards += m.home_red ?? 0
    away.red_cards += m.away_red ?? 0

    if (m.home_ft > m.away_ft) home.points += 3
    else if (m.away_ft > m.home_ft) away.points += 3
    else { home.points += 1; away.points += 1 }
  }

  // Sorteer per groep (punten → doelsaldo → doelpunten voor) en wijs posities toe
  const result = new Map<string, ActualGroupStanding[]>()
  for (const [groupId, teams] of byGroup) {
    const sorted = [...teams.values()].sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points
      const aDiff = a.goals_for - a.goals_against
      const bDiff = b.goals_for - b.goals_against
      if (bDiff !== aDiff) return bDiff - aDiff
      return b.goals_for - a.goals_for
    })
    sorted.forEach((s, i) => { s.position = i + 1 })
    result.set(groupId, sorted)
  }
  return result
}

// ─── LEADERBOARD SORT ─────────────────────────────────────────────────────────
// 1e parameter: totaal punten (desc)
// 2e parameter tiebreaker: aantal goede voorspellingen (desc)
export function sortLeaderboard<T extends { total_points: number; correct_predictions?: number | null }>(
  entries: T[]
): (T & { rank: number })[] {
  const sorted = [...entries].sort((a, b) => {
    if (b.total_points !== a.total_points) return b.total_points - a.total_points
    const aCorrect = a.correct_predictions ?? 0
    const bCorrect = b.correct_predictions ?? 0
    return bCorrect - aCorrect
  })
  return sorted.map((entry, i) => ({ ...entry, rank: i + 1 }))
}

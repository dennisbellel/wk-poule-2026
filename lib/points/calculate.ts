import type { Match, MatchPrediction, GroupStandingPrediction, ScoringKeys } from '@/types'

// ─── MATCH POINTS ─────────────────────────────────────────────────────────────
export function calculateMatchPoints(
  match: Match,
  prediction: MatchPrediction,
  scoring: ScoringKeys
): number {
  if (match.status !== 'finished') return 0
  if (match.home_ft === null || match.away_ft === null) return 0
  if (prediction.home_ft === null || prediction.away_ft === null) return 0

  let points = 0
  const actualHome = match.home_ft
  const actualAway = match.away_ft
  const predHome = prediction.home_ft
  const predAway = prediction.away_ft

  // Exact eindstand
  if (predHome === actualHome && predAway === actualAway) {
    points += scoring.exact_ft
  } else {
    // Correct outcome (win/draw/loss)
    const actualOutcome = actualHome > actualAway ? 'home' : actualAway > actualHome ? 'away' : 'draw'
    const predOutcome = predHome > predAway ? 'home' : predAway > predHome ? 'away' : 'draw'
    if (actualOutcome === predOutcome) {
      points += scoring.correct_outcome
    }
  }

  // Ruststand exact
  if (match.home_ht !== null && match.away_ht !== null &&
      prediction.home_ht !== null && prediction.away_ht !== null) {
    if (prediction.home_ht === match.home_ht && prediction.away_ht === match.away_ht) {
      points += scoring.exact_ht
    }
  }

  // Gele kaarten
  if (match.home_yellow !== null && match.away_yellow !== null &&
      prediction.home_yellow !== null && prediction.away_yellow !== null) {
    if (prediction.home_yellow === match.home_yellow) points += scoring.exact_yellow
    if (prediction.away_yellow === match.away_yellow) points += scoring.exact_yellow
  }

  // Rode kaarten
  if (match.home_red !== null && match.away_red !== null &&
      prediction.home_red !== null && prediction.away_red !== null) {
    if (prediction.home_red === match.home_red) points += scoring.exact_red
    if (prediction.away_red === match.away_red) points += scoring.exact_red
  }

  // Knockout extras
  if (match.phase !== 'group') {
    // Verlenging
    if (prediction.et_predicted !== null && match.home_et !== null) {
      const actualEt = match.home_et !== null
      if (prediction.et_predicted === actualEt) points += scoring.knockout_et
    }

    // Strafschoppen
    if (prediction.pens_predicted !== null) {
      if (prediction.pens_predicted === match.penalties) points += scoring.knockout_pens
    }

    // Winnaar
    if (prediction.winner_team_id && match.winner_team_id) {
      if (prediction.winner_team_id === match.winner_team_id) points += scoring.knockout_winner
    }
  }

  return points
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
  if (prediction.team_id !== actual.team_id) return 0 // wrong team at this position

  let points = 0

  // Positie exact
  if (prediction.position === actual.position) points += scoring.group_position

  // Punten exact
  if (prediction.predicted_points === actual.points) points += scoring.group_points

  // Goals voor exact
  if (prediction.goals_for === actual.goals_for) points += scoring.group_gf

  // Goals tegen exact
  if (prediction.goals_against === actual.goals_against) points += scoring.group_ga

  // Gele kaarten exact
  if (prediction.yellow_cards === actual.yellow_cards) points += scoring.group_yellow

  // Rode kaarten exact
  if (prediction.red_cards === actual.red_cards) points += scoring.group_red

  return points
}

// ─── BONUS POINTS ─────────────────────────────────────────────────────────────
export function calculateBonusPoints(
  answer: string,
  correctAnswer: string,
  pointsValue: number
): number {
  return answer.trim().toLowerCase() === correctAnswer.trim().toLowerCase()
    ? pointsValue
    : 0
}

// ─── LEADERBOARD SORT ─────────────────────────────────────────────────────────
// Sort by total points desc, then by earliest submission timestamp (tiebreaker)
export function sortLeaderboard<T extends { total_points: number; submitted_at: string | null }>(
  entries: T[]
): (T & { rank: number })[] {
  const sorted = [...entries].sort((a, b) => {
    if (b.total_points !== a.total_points) return b.total_points - a.total_points
    // Tiebreaker: earlier submission wins
    if (!a.submitted_at) return 1
    if (!b.submitted_at) return -1
    return new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime()
  })
  return sorted.map((entry, i) => ({ ...entry, rank: i + 1 }))
}

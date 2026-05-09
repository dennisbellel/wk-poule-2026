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

  if (predHome === actualHome && predAway === actualAway) {
    points += scoring.exact_ft
  } else {
    const actualOutcome = actualHome > actualAway ? 'home' : actualAway > actualHome ? 'away' : 'draw'
    const predOutcome = predHome > predAway ? 'home' : predAway > predHome ? 'away' : 'draw'
    if (actualOutcome === predOutcome) points += scoring.correct_outcome
  }

  if (match.home_ht !== null && match.away_ht !== null &&
      prediction.home_ht !== null && prediction.away_ht !== null) {
    if (prediction.home_ht === match.home_ht && prediction.away_ht === match.away_ht)
      points += scoring.exact_ht
  }

  if (match.home_yellow !== null && match.away_yellow !== null &&
      prediction.home_yellow !== null && prediction.away_yellow !== null) {
    if (prediction.home_yellow === match.home_yellow) points += scoring.exact_yellow
    if (prediction.away_yellow === match.away_yellow) points += scoring.exact_yellow
  }

  if (match.home_red !== null && match.away_red !== null &&
      prediction.home_red !== null && prediction.away_red !== null) {
    if (prediction.home_red === match.home_red) points += scoring.exact_red
    if (prediction.away_red === match.away_red) points += scoring.exact_red
  }

  if (match.phase !== 'group') {
    if (prediction.et_predicted !== null && match.home_et !== null) {
      const actualEt = match.home_et !== null
      if (prediction.et_predicted === actualEt) points += scoring.knockout_et
    }
    if (prediction.pens_predicted !== null) {
      if (prediction.pens_predicted === match.penalties) points += scoring.knockout_pens
    }
    if (prediction.winner_team_id && match.winner_team_id) {
      if (prediction.winner_team_id === match.winner_team_id) points += scoring.knockout_winner
    }
  }

  return points
}

// ─── BREAKDOWN PER ONDERDEEL ──────────────────────────────────────────────────
// Voor weergave in MatchPredictionCard: per rij hoeveel punten behaald.
export interface MatchPointsBreakdown {
  ft: number          // eindstand (exact OF outcome)
  ft_label: 'exact' | 'outcome' | 'wrong'
  ht: number          // ruststand
  yellow: number      // gele kaarten (home + away)
  red: number         // rode kaarten (home + away)
  et: number          // verlenging (knockout)
  pens: number        // strafschoppen (knockout)
  winner: number      // winnaar (knockout)
  total: number
}

export function calculateMatchPointsBreakdown(
  match: Match,
  prediction: Partial<MatchPrediction>,
  scoring: ScoringKeys
): MatchPointsBreakdown {
  const b: MatchPointsBreakdown = {
    ft: 0, ft_label: 'wrong', ht: 0, yellow: 0, red: 0,
    et: 0, pens: 0, winner: 0, total: 0,
  }

  if (match.status !== 'finished') return b
  if (match.home_ft === null || match.away_ft === null) return b

  if (prediction.home_ft != null && prediction.away_ft != null) {
    if (prediction.home_ft === match.home_ft && prediction.away_ft === match.away_ft) {
      b.ft = scoring.exact_ft
      b.ft_label = 'exact'
    } else {
      const actual = match.home_ft > match.away_ft ? 'h' : match.away_ft > match.home_ft ? 'a' : 'd'
      const pred = prediction.home_ft > prediction.away_ft ? 'h' : prediction.away_ft > prediction.home_ft ? 'a' : 'd'
      if (actual === pred) {
        b.ft = scoring.correct_outcome
        b.ft_label = 'outcome'
      }
    }
  }

  if (match.home_ht !== null && match.away_ht !== null &&
      prediction.home_ht != null && prediction.away_ht != null &&
      prediction.home_ht === match.home_ht && prediction.away_ht === match.away_ht) {
    b.ht = scoring.exact_ht
  }

  if (match.home_yellow !== null && prediction.home_yellow != null && prediction.home_yellow === match.home_yellow) b.yellow += scoring.exact_yellow
  if (match.away_yellow !== null && prediction.away_yellow != null && prediction.away_yellow === match.away_yellow) b.yellow += scoring.exact_yellow
  if (match.home_red !== null && prediction.home_red != null && prediction.home_red === match.home_red) b.red += scoring.exact_red
  if (match.away_red !== null && prediction.away_red != null && prediction.away_red === match.away_red) b.red += scoring.exact_red

  if (match.phase !== 'group') {
    const actualEt = match.home_et !== null
    if (prediction.et_predicted != null && prediction.et_predicted === actualEt) b.et = scoring.knockout_et
    if (prediction.pens_predicted != null && prediction.pens_predicted === match.penalties) b.pens = scoring.knockout_pens
    if (prediction.winner_team_id && match.winner_team_id && prediction.winner_team_id === match.winner_team_id) b.winner = scoring.knockout_winner
  }

  b.total = b.ft + b.ht + b.yellow + b.red + b.et + b.pens + b.winner
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
  return answer.trim().toLowerCase() === correctAnswer.trim().toLowerCase()
    ? pointsValue
    : 0
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

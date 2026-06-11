export type Phase = 'group' | 'r32' | 'r16' | 'qf' | 'sf' | 'third' | 'final'
export type MatchStatus = 'scheduled' | 'live' | 'finished'
export type QuestionType = 'team' | 'player' | 'number' | 'yes_no' | 'text'
export type QuestionPhase = 'group' | 'tournament' | 'knockout' | 'live'

export interface Profile {
  id: string
  email: string
  display_name: string
  is_admin: boolean
  avatar_color: string
  created_at: string
}

export interface Team {
  id: string
  name: string
  name_nl: string
  flag: string
  group_id: string
  fd_team_id: number | null
}

export interface Match {
  id: string
  fd_match_id: number | null
  phase: Phase
  group_id: string | null
  match_number: number
  home_team_id: string | null
  away_team_id: string | null
  home_team_placeholder: string | null
  away_team_placeholder: string | null
  scheduled_at: string
  venue: string | null
  city: string | null
  status: MatchStatus
  home_ht: number | null
  away_ht: number | null
  home_ft: number | null
  away_ft: number | null
  home_et: number | null
  away_et: number | null
  penalties: boolean
  winner_team_id: string | null
  home_yellow: number | null
  away_yellow: number | null
  home_red: number | null
  away_red: number | null
  prediction_deadline_at: string
  home_team?: Team
  away_team?: Team
}

export interface MatchPrediction {
  id: string
  user_id: string
  match_id: string
  home_ht: number | null
  away_ht: number | null
  home_ft: number | null
  away_ft: number | null
  et_predicted: boolean | null
  pens_predicted: boolean | null
  winner_team_id: string | null
  home_yellow: number | null
  away_yellow: number | null
  home_red: number | null
  away_red: number | null
  points: number | null
  submitted_at: string
  updated_at: string
  match?: Match
}

export interface GroupStandingPrediction {
  id: string
  user_id: string
  group_id: string
  position: number
  team_id: string
  predicted_points: number
  goals_for: number
  goals_against: number
  yellow_cards: number
  red_cards: number
  points: number | null
  submitted_at: string
  team?: Team
}

export interface BonusQuestion {
  id: string
  question_nl: string
  question_type: QuestionType
  phase: QuestionPhase
  points_value: number
  icon: string
  deadline_at: string
  correct_answer: string | null
  active: boolean
  sort_order: number
  created_at: string
  team_filter: string | null
  options: string[] | null
}

export interface BonusAnswer {
  id: string
  user_id: string
  question_id: string
  answer: string
  points: number | null
  submitted_at: string
  updated_at: string
  question?: BonusQuestion
}

export interface ScoringConfig {
  id: string
  key: string
  value: number
  label_nl: string
  category: string
}

export interface Player {
  id: string
  name: string
  team_id: string
  position: string
  team?: Team
}

export interface LeaderboardEntry {
  user_id: string
  display_name: string
  avatar_color: string
  total_points: number
  match_points: number
  group_points: number
  bonus_points: number
  rank: number
  submitted_at: string | null
}

export interface ScoringKeys {
  // Per-input wedstrijdscores — elk onderdeel apart instelbaar
  match_toto: number             // toto: juiste uitslag-richting (winst/gelijk/verlies)
  match_ft_home: number          // doelpunten thuisteam (eindstand) correct
  match_ft_away: number          // doelpunten uitteam (eindstand) correct
  match_ht_home: number          // doelpunten thuisteam (ruststand) correct
  match_ht_away: number          // doelpunten uitteam (ruststand) correct
  match_yellow_home: number      // gele kaarten thuisteam correct
  match_yellow_away: number      // gele kaarten uitteam correct
  match_red_home: number         // rode kaarten thuisteam correct
  match_red_away: number         // rode kaarten uitteam correct
  match_ft_exact_bonus: number   // bonus als BEIDE ft scores exact kloppen
  match_ht_exact_bonus: number   // bonus als BEIDE ht scores exact kloppen
  match_all_correct_bonus: number // bonus als ALLE 8 inputs kloppen
  // Knockout extra
  knockout_et: number
  knockout_pens: number
  knockout_winner: number
  // Poulestand
  group_position: number
  group_points: number
  group_gf: number
  group_ga: number
  group_yellow: number
  group_red: number
  // Bonus
  bonus_default: number
}

// Bij alles goed: 5 + 8×3 + 5 + 3 + 3 = 40 punten
export const DEFAULT_SCORING: ScoringKeys = {
  match_toto: 5,
  match_ft_home: 3,
  match_ft_away: 3,
  match_ht_home: 3,
  match_ht_away: 3,
  match_yellow_home: 3,
  match_yellow_away: 3,
  match_red_home: 3,
  match_red_away: 3,
  match_ft_exact_bonus: 5,
  match_ht_exact_bonus: 3,
  match_all_correct_bonus: 3,
  knockout_et: 2,
  knockout_pens: 2,
  knockout_winner: 3,
  group_position: 3,
  group_points: 2,
  group_gf: 1,
  group_ga: 1,
  group_yellow: 1,
  group_red: 1,
  bonus_default: 5,
}

export const SCORING_LABELS: Record<keyof ScoringKeys, { label: string; category: string }> = {
  match_toto: { label: 'Toto: winnaar of gelijkspel goed', category: 'Wedstrijd' },
  match_ft_home: { label: 'Doelpunten thuisteam (eindstand)', category: 'Wedstrijd' },
  match_ft_away: { label: 'Doelpunten uitteam (eindstand)', category: 'Wedstrijd' },
  match_ht_home: { label: 'Doelpunten thuisteam (ruststand)', category: 'Wedstrijd' },
  match_ht_away: { label: 'Doelpunten uitteam (ruststand)', category: 'Wedstrijd' },
  match_yellow_home: { label: 'Gele kaarten thuisteam', category: 'Wedstrijd' },
  match_yellow_away: { label: 'Gele kaarten uitteam', category: 'Wedstrijd' },
  match_red_home: { label: 'Rode kaarten thuisteam', category: 'Wedstrijd' },
  match_red_away: { label: 'Rode kaarten uitteam', category: 'Wedstrijd' },
  match_ft_exact_bonus: { label: 'Bonus: eindstand helemaal goed', category: 'Wedstrijd' },
  match_ht_exact_bonus: { label: 'Bonus: ruststand helemaal goed', category: 'Wedstrijd' },
  match_all_correct_bonus: { label: 'Bonus: alles goed voorspeld', category: 'Wedstrijd' },
  knockout_et: { label: 'Verlenging (ja/nee) correct', category: 'Knockout extra' },
  knockout_pens: { label: 'Strafschoppen (ja/nee) correct', category: 'Knockout extra' },
  knockout_winner: { label: 'Winnaar correct', category: 'Knockout extra' },
  group_position: { label: 'Land op exacte positie', category: 'Poulestand' },
  group_points: { label: 'Punten exact', category: 'Poulestand' },
  group_gf: { label: 'Goals voor exact', category: 'Poulestand' },
  group_ga: { label: 'Goals tegen exact', category: 'Poulestand' },
  group_yellow: { label: 'Gele kaarten exact', category: 'Poulestand' },
  group_red: { label: 'Rode kaarten exact', category: 'Poulestand' },
  bonus_default: { label: 'Bonusvragen (standaard)', category: 'Bonus' },
}

export interface ScoringInput {
  oldestDirectorAge: number
  directorCount: number
  hasSuccessionRisk: boolean
  successorAge?: number
  yearsInBusiness: number
  hasWebsite: boolean
}

export interface ScoreBreakdown {
  age: number
  succession: number
  size: number
  longevity: number
  digital: number
}

export function scoreFirm(input: ScoringInput): { total: number; breakdown: ScoreBreakdown } {
  const breakdown: ScoreBreakdown = { age: 0, succession: 0, size: 0, longevity: 0, digital: 0 }

  // DIRECTOR AGE (max 35)
  const age = input.oldestDirectorAge
  if (age >= 68 && age <= 75) breakdown.age = 35
  else if (age >= 63 && age < 68) breakdown.age = 28
  else if (age >= 58 && age < 63) breakdown.age = 20
  else if (age >= 75 && age <= 82) breakdown.age = 22
  else if (age > 82) breakdown.age = 10
  else if (age >= 55 && age < 58) breakdown.age = 10
  else breakdown.age = 0

  // SUCCESSION RISK (max 25)
  // Looks at age of same-surname directors, not just their existence
  if (!input.hasSuccessionRisk) {
    breakdown.succession = 25 // no same-surname director at all
  } else if (input.successorAge !== undefined) {
    if (input.successorAge >= 55) breakdown.succession = 20 // successor also near retirement
    else if (input.successorAge >= 45) breakdown.succession = 12 // possible but uncertain
    else breakdown.succession = 3 // young successor, likely taking over
  } else {
    breakdown.succession = 25
  }

  // FIRM SIZE (max 20)
  const dc = input.directorCount
  if (dc >= 1 && dc <= 10) breakdown.size = 20
  else if (dc >= 11 && dc <= 20) breakdown.size = 14
  else if (dc >= 21 && dc <= 40) breakdown.size = 6
  else breakdown.size = 0

  // LONGEVITY (max 10)
  const years = input.yearsInBusiness
  if (years >= 20) breakdown.longevity = 10
  else if (years >= 15) breakdown.longevity = 8
  else if (years >= 10) breakdown.longevity = 6
  else if (years >= 5) breakdown.longevity = 4
  else breakdown.longevity = 1

  // DIGITAL PRESENCE (max 10)
  breakdown.digital = input.hasWebsite ? 2 : 10

  const total = Math.min(100, breakdown.age + breakdown.succession + breakdown.size + breakdown.longevity + breakdown.digital)
  return { total, breakdown }
}

export function getPriorityFromScore(score: number): 'high' | 'medium' | 'low' {
  if (score >= 70) return 'high'
  if (score >= 45) return 'medium'
  return 'low'
}

export function getScoreLabel(score: number): string {
  if (score >= 70) return 'Prime Target'
  if (score >= 55) return 'Strong Prospect'
  if (score >= 40) return 'Worth Reviewing'
  return 'Low Priority'
}
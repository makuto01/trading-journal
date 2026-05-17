import { CRITERIA, type CriterionId } from "./scoring-criteria"

export type Tier = "S" | "A" | "B" | "C" | "D" | "F"

export interface ScoreResult {
  score: number
  tier: Tier
  breakdown: Record<CriterionId, boolean>
}

export function calcScore(detected: Partial<Record<CriterionId, boolean>>): ScoreResult {
  const breakdown = Object.fromEntries(
    CRITERIA.map((c) => [c.id, detected[c.id] ?? false])
  ) as Record<CriterionId, boolean>

  const passed = CRITERIA.filter((c) => breakdown[c.id]).length
  const fvgFail = !breakdown.fvg

  const { score, tier } = mapPassedToScoreTier(passed, fvgFail)

  return { score, tier, breakdown }
}

function mapPassedToScoreTier(passed: number, fvgFail: boolean): { score: number; tier: Tier } {
  let score: number
  let tier: Tier

  if (passed === 12) {
    score = 10; tier = "S"
  } else if (passed === 11) {
    score = 9; tier = "A"
  } else if (passed === 10) {
    score = 8; tier = "A"
  } else if (passed === 9) {
    score = 7; tier = "B"
  } else if (passed === 8) {
    score = 6; tier = "B"
  } else if (passed === 7) {
    score = 5; tier = "C"
  } else if (passed === 6) {
    score = 4; tier = "C"
  } else if (passed === 5) {
    score = 3; tier = "D"
  } else if (passed === 4) {
    score = 2; tier = "D"
  } else {
    score = 1; tier = "F"
  }

  if (fvgFail && score > 5) {
    score = 5; tier = "D"
  }

  return { score, tier }
}

import { calcScore } from "@/lib/scorer"
import { type CriterionId } from "@/lib/scoring-criteria"

const ALL_IDS: CriterionId[] = [
  "timeCheck", "liquiditySweep", "displacement", "mss", "fvg",
  "fibAnchor", "frvpAnchor", "frvp40pct", "sTierRule",
  "patience", "candleConfirm", "execution",
]

function allPass(except: CriterionId[] = []): Partial<Record<CriterionId, boolean>> {
  return Object.fromEntries(ALL_IDS.map((id) => [id, !except.includes(id)]))
}

function only(ids: CriterionId[]): Partial<Record<CriterionId, boolean>> {
  return Object.fromEntries(ALL_IDS.map((id) => [id, ids.includes(id)]))
}

describe("calcScore", () => {
  test("all 12 pass → S / 10", () => {
    const { score, tier } = calcScore(allPass())
    expect(score).toBe(10)
    expect(tier).toBe("S")
  })

  test("11 pass → A / 9", () => {
    const { score, tier } = calcScore(allPass(["timeCheck"]))
    expect(score).toBe(9)
    expect(tier).toBe("A")
  })

  test("10 pass → A / 8", () => {
    const { score, tier } = calcScore(allPass(["timeCheck", "liquiditySweep"]))
    expect(score).toBe(8)
    expect(tier).toBe("A")
  })

  test("9 pass → B / 7", () => {
    const { score, tier } = calcScore(allPass(["timeCheck", "liquiditySweep", "displacement"]))
    expect(score).toBe(7)
    expect(tier).toBe("B")
  })

  test("8 pass → B / 6", () => {
    const result = calcScore(allPass(["timeCheck", "liquiditySweep", "displacement", "mss"]))
    expect(result.score).toBe(6)
    expect(result.tier).toBe("B")
  })

  test("7 pass → C / 5", () => {
    const result = calcScore(only(["fvg", "fibAnchor", "frvpAnchor", "frvp40pct", "sTierRule", "patience", "candleConfirm"]))
    expect(result.score).toBe(5)
    expect(result.tier).toBe("C")
  })

  test("6 pass → C / 4", () => {
    const result = calcScore(only(["fvg", "fibAnchor", "frvpAnchor", "frvp40pct", "sTierRule", "patience"]))
    expect(result.score).toBe(4)
    expect(result.tier).toBe("C")
  })

  test("5 pass → D / 3", () => {
    const result = calcScore(only(["fvg", "fibAnchor", "frvpAnchor", "frvp40pct", "sTierRule"]))
    expect(result.score).toBe(3)
    expect(result.tier).toBe("D")
  })

  test("4 pass → D / 2", () => {
    const result = calcScore(only(["fvg", "fibAnchor", "frvpAnchor", "frvp40pct"]))
    expect(result.score).toBe(2)
    expect(result.tier).toBe("D")
  })

  test("less than 4 pass → F / 1", () => {
    const { score, tier } = calcScore(only(["fvg", "fibAnchor"]))
    expect(score).toBe(1)
    expect(tier).toBe("F")
  })

  test("empty detection → F / 1", () => {
    const { score, tier } = calcScore({})
    expect(score).toBe(1)
    expect(tier).toBe("F")
  })

  test("FVG fail hard rule: 12 pass except FVG → D / 5 max", () => {
    const { score, tier } = calcScore(allPass(["fvg"]))
    expect(score).toBe(5)
    expect(tier).toBe("D")
  })

  test("FVG fail hard rule: 10 pass except FVG → D / 5 (caps at 5)", () => {
    const result = calcScore(allPass(["fvg", "timeCheck"]))
    expect(result.score).toBe(5)
    expect(result.tier).toBe("D")
  })

  test("FVG fail but only 4 pass total → F / 1 (hard rule irrelevant since score <= 5)", () => {
    // FVG fail + only 3 others passing → passes=3 → score=1/F; hard rule doesn't change anything
    const result = calcScore(only(["fibAnchor", "frvpAnchor", "frvp40pct"]))
    expect(result.score).toBe(1)
    expect(result.tier).toBe("F")
  })

  test("breakdown reflects exactly which criteria passed", () => {
    const input = only(["fvg", "displacement", "mss"])
    const { breakdown } = calcScore(input)
    expect(breakdown.fvg).toBe(true)
    expect(breakdown.displacement).toBe(true)
    expect(breakdown.mss).toBe(true)
    expect(breakdown.timeCheck).toBe(false)
    expect(breakdown.fibAnchor).toBe(false)
  })
})

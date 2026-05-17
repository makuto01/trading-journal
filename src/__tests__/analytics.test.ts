import { calcAnalytics, type ClosedTrade } from "@/lib/analytics"

function trade(
  overrides: Partial<ClosedTrade> & { pnl: number }
): ClosedTrade {
  return {
    id: Math.random().toString(36).slice(2),
    symbol: "EURUSD",
    time: new Date().toISOString(),
    ...overrides,
  }
}

function tradeAt(time: string, pnl: number): ClosedTrade {
  return trade({ time, pnl })
}

describe("calcAnalytics", () => {
  test("returns null metrics for empty trade list", () => {
    const result = calcAnalytics([])
    expect(result.totalTrades).toBe(0)
    expect(result.winRate).toBeNull()
    expect(result.profitFactor).toBeNull()
    expect(result.expectancy).toBeNull()
    expect(result.avgWin).toBeNull()
    expect(result.avgLoss).toBeNull()
    expect(result.avgWinLossRatio).toBeNull()
    expect(result.totalPnl).toBe(0)
    expect(result.maxDrawdown).toBe(0)
    expect(result.equityCurve).toHaveLength(0)
    expect(result.currentStreak).toEqual({ type: "none", count: 0 })
  })

  test("computes win rate correctly", () => {
    const trades = [trade({ pnl: 100 }), trade({ pnl: -50 }), trade({ pnl: 80 })]
    const { winRate, winners, losers } = calcAnalytics(trades)
    expect(winRate).toBeCloseTo(2 / 3)
    expect(winners).toBe(2)
    expect(losers).toBe(1)
  })

  test("win rate is 1.0 when all trades win", () => {
    const trades = [trade({ pnl: 100 }), trade({ pnl: 200 })]
    expect(calcAnalytics(trades).winRate).toBe(1)
  })

  test("win rate is 0 when all trades lose", () => {
    const trades = [trade({ pnl: -100 }), trade({ pnl: -50 })]
    expect(calcAnalytics(trades).winRate).toBe(0)
  })

  test("computes profit factor correctly", () => {
    // Gross profit = 300, gross loss = 100 → PF = 3
    const trades = [
      trade({ pnl: 100 }),
      trade({ pnl: 200 }),
      trade({ pnl: -100 }),
    ]
    expect(calcAnalytics(trades).profitFactor).toBeCloseTo(3)
  })

  test("profit factor is null when there are no losing trades", () => {
    const trades = [trade({ pnl: 100 }), trade({ pnl: 200 })]
    expect(calcAnalytics(trades).profitFactor).toBeNull()
  })

  test("computes expectancy (avg PnL per trade)", () => {
    const trades = [trade({ pnl: 100 }), trade({ pnl: -50 })]
    // (100 - 50) / 2 = 25
    expect(calcAnalytics(trades).expectancy).toBeCloseTo(25)
  })

  test("computes avg win and avg loss", () => {
    const trades = [
      trade({ pnl: 200 }),
      trade({ pnl: 100 }),
      trade({ pnl: -60 }),
      trade({ pnl: -40 }),
    ]
    const { avgWin, avgLoss, avgWinLossRatio } = calcAnalytics(trades)
    expect(avgWin).toBeCloseTo(150)
    expect(avgLoss).toBeCloseTo(50)
    expect(avgWinLossRatio).toBeCloseTo(3)
  })

  test("avg loss is null when there are no losing trades", () => {
    const { avgLoss, avgWinLossRatio } = calcAnalytics([trade({ pnl: 100 })])
    expect(avgLoss).toBeNull()
    expect(avgWinLossRatio).toBeNull()
  })

  test("equity curve accumulates pnl in chronological order", () => {
    const trades = [
      tradeAt("2026-01-01T00:00:00Z", 100),
      tradeAt("2026-01-03T00:00:00Z", -50),
      tradeAt("2026-01-02T00:00:00Z", 200), // out of order — should sort
    ]
    const { equityCurve } = calcAnalytics(trades)
    expect(equityCurve).toHaveLength(3)
    expect(equityCurve[0].cumPnl).toBeCloseTo(100)  // Jan 1: +100
    expect(equityCurve[1].cumPnl).toBeCloseTo(300)  // Jan 2: +200
    expect(equityCurve[2].cumPnl).toBeCloseTo(250)  // Jan 3: -50
  })

  test("computes max drawdown", () => {
    // Equity: +100, +50, +150, +100, +80, +120
    // Peak after trade 3 = 150. Min after peak = 80. Drawdown = 70.
    const trades = [
      tradeAt("2026-01-01T00:00:00Z", 100),
      tradeAt("2026-01-02T00:00:00Z", -50),
      tradeAt("2026-01-03T00:00:00Z", 100),
      tradeAt("2026-01-04T00:00:00Z", -50),
      tradeAt("2026-01-05T00:00:00Z", -20),
      tradeAt("2026-01-06T00:00:00Z", 40),
    ]
    // cumPnl: 100, 50, 150, 100, 80, 120
    // peak rises to 150 at index 2; trough at index 4 is 80 → dd = 70
    expect(calcAnalytics(trades).maxDrawdown).toBeCloseTo(70)
  })

  test("max drawdown is 0 when equity only rises", () => {
    const trades = [
      tradeAt("2026-01-01T00:00:00Z", 100),
      tradeAt("2026-01-02T00:00:00Z", 50),
    ]
    expect(calcAnalytics(trades).maxDrawdown).toBe(0)
  })

  test("detects winning streak", () => {
    const trades = [
      tradeAt("2026-01-01T00:00:00Z", -50),
      tradeAt("2026-01-02T00:00:00Z", 100),
      tradeAt("2026-01-03T00:00:00Z", 80),
      tradeAt("2026-01-04T00:00:00Z", 60),
    ]
    const { currentStreak } = calcAnalytics(trades)
    expect(currentStreak).toEqual({ type: "win", count: 3 })
  })

  test("detects losing streak", () => {
    const trades = [
      tradeAt("2026-01-01T00:00:00Z", 100),
      tradeAt("2026-01-02T00:00:00Z", -30),
      tradeAt("2026-01-03T00:00:00Z", -40),
    ]
    expect(calcAnalytics(trades).currentStreak).toEqual({ type: "loss", count: 2 })
  })

  test("streak of 1 when last trade breaks the prior run", () => {
    const trades = [
      tradeAt("2026-01-01T00:00:00Z", 100),
      tradeAt("2026-01-02T00:00:00Z", 100),
      tradeAt("2026-01-03T00:00:00Z", -50),
    ]
    expect(calcAnalytics(trades).currentStreak).toEqual({ type: "loss", count: 1 })
  })

  test("avgScore is null when no trades have scores", () => {
    const trades = [trade({ pnl: 100 }), trade({ pnl: -50 })]
    expect(calcAnalytics(trades).avgScore).toBeNull()
  })

  test("avgScore computes average of scored trades only", () => {
    const trades = [
      { ...trade({ pnl: 100 }), score: 10, tier: "S" },
      { ...trade({ pnl: -50 }), score: 6, tier: "B" },
      trade({ pnl: 80 }), // no score — excluded from avg
    ]
    const { avgScore } = calcAnalytics(trades)
    expect(avgScore).toBeCloseTo(8)
  })

  test("tierDistribution groups trades by tier with win rates", () => {
    const trades = [
      { ...trade({ pnl: 100 }), score: 10, tier: "S" },
      { ...trade({ pnl: 50 }), score: 10, tier: "S" },
      { ...trade({ pnl: -30 }), score: 6, tier: "B" },
    ]
    const { tierDistribution } = calcAnalytics(trades)

    const s = tierDistribution.find((d) => d.tier === "S")
    const b = tierDistribution.find((d) => d.tier === "B")

    expect(s?.count).toBe(2)
    expect(s?.winRate).toBe(1)
    expect(b?.count).toBe(1)
    expect(b?.winRate).toBe(0)
  })

  test("tierDistribution is empty when no trades have tiers", () => {
    const trades = [trade({ pnl: 100 }), trade({ pnl: -50 })]
    expect(calcAnalytics(trades).tierDistribution).toHaveLength(0)
  })
})

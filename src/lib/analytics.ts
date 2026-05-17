export interface ClosedTrade {
  id: string
  time: string // ISO-8601
  pnl: number
  symbol: string
  score?: number | null
  tier?: string | null
}

export interface EquityPoint {
  time: string
  cumPnl: number
}

export interface Streak {
  type: "win" | "loss" | "none"
  count: number
}

export interface TierDistribution {
  tier: string
  count: number
  winRate: number | null
}

export interface Analytics {
  totalTrades: number
  winners: number
  losers: number
  winRate: number | null          // 0–1
  profitFactor: number | null     // gross profit / gross loss
  expectancy: number | null       // avg PnL per closed trade
  avgWin: number | null
  avgLoss: number | null          // positive value
  avgWinLossRatio: number | null  // avgWin / avgLoss
  maxDrawdown: number             // largest peak-to-trough drop in cumPnl
  totalPnl: number
  equityCurve: EquityPoint[]
  currentStreak: Streak
  avgScore: number | null
  tierDistribution: TierDistribution[]
}

export function calcAnalytics(trades: ClosedTrade[]): Analytics {
  const sorted = [...trades].sort(
    (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()
  )

  const winners = sorted.filter((t) => t.pnl > 0)
  const losers = sorted.filter((t) => t.pnl < 0)

  const grossProfit = winners.reduce((s, t) => s + t.pnl, 0)
  const grossLoss = Math.abs(losers.reduce((s, t) => s + t.pnl, 0))
  const totalPnl = grossProfit - grossLoss

  const winRate = sorted.length === 0 ? null : winners.length / sorted.length
  const profitFactor = grossLoss === 0 ? null : grossProfit / grossLoss
  const expectancy = sorted.length === 0 ? null : totalPnl / sorted.length
  const avgWin = winners.length === 0 ? null : grossProfit / winners.length
  const avgLoss = losers.length === 0 ? null : grossLoss / losers.length
  const avgWinLossRatio =
    avgWin !== null && avgLoss !== null && avgLoss !== 0
      ? avgWin / avgLoss
      : null

  // Equity curve: cumulative PnL after each trade in chronological order.
  let cumPnl = 0
  const equityCurve: EquityPoint[] = sorted.map((t) => {
    cumPnl += t.pnl
    return { time: t.time, cumPnl }
  })

  // Max drawdown: largest peak-to-trough decline in cumulative PnL.
  let peak = 0
  let maxDrawdown = 0
  for (const point of equityCurve) {
    if (point.cumPnl > peak) peak = point.cumPnl
    const drawdown = peak - point.cumPnl
    if (drawdown > maxDrawdown) maxDrawdown = drawdown
  }

  // Current streak: how many consecutive wins or losses ending on the last trade.
  const currentStreak = calcStreak(sorted)

  const scored = sorted.filter((t) => t.score != null)
  const avgScore = scored.length === 0 ? null : scored.reduce((s, t) => s + (t.score ?? 0), 0) / scored.length

  const tierDistribution = calcTierDistribution(sorted)

  return {
    totalTrades: sorted.length,
    winners: winners.length,
    losers: losers.length,
    winRate,
    profitFactor,
    expectancy,
    avgWin,
    avgLoss,
    avgWinLossRatio,
    maxDrawdown,
    totalPnl,
    equityCurve,
    currentStreak,
    avgScore,
    tierDistribution,
  }
}

function calcTierDistribution(sorted: ClosedTrade[]): TierDistribution[] {
  const tierOrder = ["S", "A", "B", "C", "D", "F"]
  const map = new Map<string, { count: number; wins: number }>()

  for (const t of sorted) {
    if (!t.tier) continue
    const entry = map.get(t.tier) ?? { count: 0, wins: 0 }
    entry.count++
    if (t.pnl != null && t.pnl > 0) entry.wins++
    map.set(t.tier, entry)
  }

  return tierOrder
    .filter((tier) => map.has(tier))
    .map((tier) => {
      const { count, wins } = map.get(tier)!
      return { tier, count, winRate: count === 0 ? null : wins / count }
    })
}

function calcStreak(sorted: ClosedTrade[]): Streak {
  if (sorted.length === 0) return { type: "none", count: 0 }

  const last = sorted[sorted.length - 1]
  const type = last.pnl > 0 ? "win" : "loss"
  let count = 0
  for (let i = sorted.length - 1; i >= 0; i--) {
    const isWin = sorted[i].pnl > 0
    if ((type === "win") === isWin) count++
    else break
  }
  return { type, count }
}

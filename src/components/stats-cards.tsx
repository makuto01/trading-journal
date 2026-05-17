import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { Analytics } from "@/lib/analytics"

interface StatsCardsProps {
  openCount: number
  analytics: Analytics
}

type Accent = "neutral" | "green" | "red" | "indigo" | "amber"

interface StatItem {
  label: string
  value: string
  hint?: string
  accent?: Accent
}

export function StatsCards({ openCount, analytics }: StatsCardsProps) {
  const {
    totalTrades,
    winners,
    losers,
    winRate,
    profitFactor,
    expectancy,
    avgWinLossRatio,
    maxDrawdown,
    totalPnl,
    currentStreak,
  } = analytics

  const closedCount = winners + losers

  const row1: StatItem[] = [
    {
      label: "Trades",
      value: String(totalTrades + openCount),
      hint: `${openCount} open · ${closedCount} closed`,
    },
    {
      label: "Win rate",
      value: winRate === null ? "—" : `${(winRate * 100).toFixed(0)}%`,
      hint: closedCount === 0 ? "no closed trades" : `${winners}W / ${losers}L`,
      accent:
        winRate === null
          ? "neutral"
          : winRate >= 0.5
          ? "green"
          : "red",
    },
    {
      label: "Profit factor",
      value: profitFactor === null ? "—" : profitFactor.toFixed(2),
      hint: profitFactor === null ? undefined : profitFactor >= 1 ? "profitable" : "unprofitable",
      accent:
        profitFactor === null
          ? "neutral"
          : profitFactor >= 1.5
          ? "green"
          : profitFactor >= 1
          ? "amber"
          : "red",
    },
    {
      label: "Realized PnL",
      value: formatPnl(totalPnl),
      accent: closedCount === 0 ? "neutral" : totalPnl >= 0 ? "green" : "red",
    },
    {
      label: "Expectancy",
      value: expectancy === null ? "—" : formatPnl(expectancy),
      hint: "avg PnL / trade",
      accent:
        expectancy === null
          ? "neutral"
          : expectancy >= 0
          ? "green"
          : "red",
    },
  ]

  const row2: StatItem[] = [
    {
      label: "Avg win / loss",
      value: avgWinLossRatio === null ? "—" : `${avgWinLossRatio.toFixed(2)}×`,
      hint: avgWinLossRatio === null ? undefined : avgWinLossRatio >= 1 ? "winners are larger" : "losers are larger",
      accent:
        avgWinLossRatio === null
          ? "neutral"
          : avgWinLossRatio >= 1.5
          ? "green"
          : avgWinLossRatio >= 1
          ? "amber"
          : "red",
    },
    {
      label: "Max drawdown",
      value: maxDrawdown === 0 ? "—" : formatPnl(-maxDrawdown),
      accent: maxDrawdown === 0 ? "neutral" : "red",
    },
    {
      label: "Streak",
      value:
        currentStreak.type === "none"
          ? "—"
          : `${currentStreak.count} ${currentStreak.type === "win" ? "W" : "L"}`,
      accent:
        currentStreak.type === "win"
          ? "green"
          : currentStreak.type === "loss"
          ? "red"
          : "neutral",
    },
  ]

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {row1.map((item) => (
          <StatCard key={item.label} item={item} />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {row2.map((item) => (
          <StatCard key={item.label} item={item} />
        ))}
      </div>
    </div>
  )
}

function StatCard({ item }: { item: StatItem }) {
  return (
    <Card
      className={cn(
        "border-neutral-200/80 bg-white shadow-none transition-colors",
        "hover:border-neutral-300"
      )}
    >
      <CardContent className="px-4 py-5">
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-500">
          {item.label}
        </p>
        <p
          className={cn(
            "mt-2 font-mono text-2xl font-semibold tabular-nums",
            item.accent === "green" && "text-emerald-600",
            item.accent === "red" && "text-red-600",
            item.accent === "indigo" && "text-indigo-600",
            item.accent === "amber" && "text-amber-500",
            (!item.accent || item.accent === "neutral") && "text-neutral-900"
          )}
        >
          {item.value}
        </p>
        {item.hint && (
          <p className="mt-1 text-xs text-neutral-400">{item.hint}</p>
        )}
      </CardContent>
    </Card>
  )
}

function formatPnl(value: number): string {
  const sign = value > 0 ? "+" : value < 0 ? "−" : ""
  const abs = Math.abs(value)
  return `${sign}${abs.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

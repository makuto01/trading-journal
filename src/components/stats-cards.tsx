import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface StatsCardsProps {
  total: number
  open: number
  closed: number
  totalPnl: number
  winners: number
}

export function StatsCards({
  total,
  open,
  closed,
  totalPnl,
  winners,
}: StatsCardsProps) {
  const winRate = closed === 0 ? null : (winners / closed) * 100
  const pnlPositive = totalPnl >= 0

  const items: {
    label: string
    value: string
    hint?: string
    accent?: "neutral" | "green" | "red" | "indigo"
  }[] = [
    { label: "Trades", value: String(total), hint: `${open} open` },
    { label: "Open", value: String(open), accent: "indigo" },
    { label: "Closed", value: String(closed) },
    {
      label: "Realized PnL",
      value: formatPnl(totalPnl),
      accent: closed === 0 ? "neutral" : pnlPositive ? "green" : "red",
    },
    {
      label: "Win rate",
      value: winRate === null ? "—" : `${winRate.toFixed(0)}%`,
      hint: closed === 0 ? "no closed trades" : `${winners}/${closed}`,
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
      {items.map((item) => (
        <Card
          key={item.label}
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
                (!item.accent || item.accent === "neutral") &&
                  "text-neutral-900"
              )}
            >
              {item.value}
            </p>
            {item.hint && (
              <p className="mt-1 text-xs text-neutral-400">{item.hint}</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
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

import { cn } from "@/lib/utils"

type Tier = "S" | "A" | "B" | "C" | "D" | "F"

const TIER_STYLES: Record<Tier, string> = {
  S: "bg-amber-100 text-amber-800 border-amber-300",
  A: "bg-emerald-50 text-emerald-700 border-emerald-300",
  B: "bg-blue-50 text-blue-700 border-blue-300",
  C: "bg-yellow-50 text-yellow-700 border-yellow-300",
  D: "bg-orange-50 text-orange-700 border-orange-300",
  F: "bg-red-50 text-red-700 border-red-300",
}

interface ScoreBadgeProps {
  tier: string
  score: number
  size?: "sm" | "md"
  className?: string
}

export function ScoreBadge({ tier, score, size = "sm", className }: ScoreBadgeProps) {
  const styles = TIER_STYLES[tier as Tier] ?? "bg-neutral-100 text-neutral-700 border-neutral-300"
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded border font-medium tabular-nums",
        size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-xs",
        styles,
        className
      )}
    >
      <span className="font-bold">{tier}</span>
      <span className="opacity-60">·</span>
      <span>{score}/10</span>
    </span>
  )
}

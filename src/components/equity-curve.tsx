import type { EquityPoint } from "@/lib/analytics"

interface EquityCurveProps {
  data: EquityPoint[]
}

export function EquityCurve({ data }: EquityCurveProps) {
  if (data.length < 2) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-neutral-400">
        {data.length === 0 ? "No closed trades yet" : "Need at least 2 trades"}
      </div>
    )
  }

  const W = 600
  const H = 120
  const PAD = { top: 12, right: 8, bottom: 20, left: 8 }
  const plotW = W - PAD.left - PAD.right
  const plotH = H - PAD.top - PAD.bottom

  const values = data.map((d) => d.cumPnl)
  const minVal = Math.min(0, ...values)
  const maxVal = Math.max(0, ...values)
  const range = maxVal - minVal || 1

  const toX = (i: number) => PAD.left + (i / (data.length - 1)) * plotW
  const toY = (v: number) => PAD.top + ((maxVal - v) / range) * plotH

  const zeroY = toY(0)

  const points = data.map((d, i) => `${toX(i)},${toY(d.cumPnl)}`).join(" ")

  // Area fill: positive half green, negative half red — split at the zero line.
  // Build a closed polygon that clips to the zero baseline.
  const last = data[data.length - 1]
  const polyPoints = [
    `${toX(0)},${zeroY}`,
    ...data.map((d, i) => `${toX(i)},${toY(d.cumPnl)}`),
    `${toX(data.length - 1)},${zeroY}`,
  ].join(" ")

  const finalPositive = last.cumPnl >= 0

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      aria-label="Equity curve"
    >
      {/* Zero baseline */}
      <line
        x1={PAD.left}
        y1={zeroY}
        x2={W - PAD.right}
        y2={zeroY}
        stroke="#d4d4d4"
        strokeWidth={1}
        strokeDasharray="4 3"
      />

      {/* Filled area */}
      <polygon
        points={polyPoints}
        fill={finalPositive ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)"}
        stroke="none"
      />

      {/* Line */}
      <polyline
        points={points}
        fill="none"
        stroke={finalPositive ? "#10b981" : "#ef4444"}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* End dot */}
      <circle
        cx={toX(data.length - 1)}
        cy={toY(last.cumPnl)}
        r={3}
        fill={finalPositive ? "#10b981" : "#ef4444"}
      />
    </svg>
  )
}

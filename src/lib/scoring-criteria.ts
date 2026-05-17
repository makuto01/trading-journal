export const CRITERIA = [
  { id: "timeCheck",      phase: 1, label: "Time Check (inside Killzone)" },
  { id: "liquiditySweep", phase: 1, label: "Liquidity Sweep (wicked past swing)" },
  { id: "displacement",   phase: 2, label: "Displacement (strong impulse candles)" },
  { id: "mss",            phase: 2, label: "Market Structure Shift (broke swing)" },
  { id: "fvg",            phase: 2, label: "Fair Value Gap (unfilled FVG present)" },
  { id: "fibAnchor",      phase: 3, label: "Fibonacci Anchored on body" },
  { id: "frvpAnchor",     phase: 3, label: "FRVP drawn on same leg" },
  { id: "frvp40pct",      phase: 3, label: "FRVP at 40% Core Value Area" },
  { id: "sTierRule",      phase: 3, label: "S-Tier Rule: Fib OTE + FVG + FRVP overlap" },
  { id: "patience",       phase: 4, label: "Price retraced into confluence zone" },
  { id: "candleConfirm",  phase: 4, label: "Engulfing or Pin Bar confirmation" },
  { id: "execution",      phase: 4, label: "Market order on candle close" },
] as const

export type CriterionId = (typeof CRITERIA)[number]["id"]

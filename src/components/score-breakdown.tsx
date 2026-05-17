"use client"

import { useState } from "react"
import { CRITERIA } from "@/lib/scoring-criteria"
import { ScoreBadge } from "@/components/score-badge"

interface ScoreBreakdownProps {
  tier: string
  score: number
  breakdown: Record<string, boolean>
  defaultOpen?: boolean
}

export function ScoreBreakdown({ tier, score, breakdown, defaultOpen = false }: ScoreBreakdownProps) {
  const [open, setOpen] = useState(defaultOpen)

  const phaseLabels: Record<number, string> = {
    1: "Phase 1 — Trap & Timing",
    2: "Phase 2 — Shift",
    3: "Phase 3 — Confluence",
    4: "Phase 4 — Entry Trigger",
  }

  const phases = [1, 2, 3, 4]

  return (
    <div className="rounded-lg border border-neutral-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-2.5 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-neutral-700">S-Tier Score</span>
          <ScoreBadge tier={tier} score={score} size="sm" />
        </div>
        <svg
          className={`h-3.5 w-3.5 text-neutral-400 transition-transform ${open ? "rotate-180" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-neutral-100 px-4 pb-3 pt-2">
          {phases.map((phase) => {
            const criteria = CRITERIA.filter((c) => c.phase === phase)
            return (
              <div key={phase} className="mb-3 last:mb-0">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                  {phaseLabels[phase]}
                </p>
                <ul className="space-y-0.5">
                  {criteria.map((c) => {
                    const passed = breakdown[c.id] ?? false
                    return (
                      <li key={c.id} className="flex items-center gap-2 text-xs">
                        <span
                          className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${
                            passed
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-red-50 text-red-500"
                          }`}
                        >
                          {passed ? "✓" : "✗"}
                        </span>
                        <span className={passed ? "text-neutral-700" : "text-neutral-400"}>
                          {c.label}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

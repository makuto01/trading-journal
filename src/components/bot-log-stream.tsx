"use client"

import { useEffect, useRef, useState } from "react"
import { Badge } from "@/components/ui/badge"

interface BotLogRow {
  id: string
  ts: string
  level: string
  event: string
  symbol: string | null
  message: string
  payload: string | null
  tradeId: string | null
}

const LEVEL_CLASSES: Record<string, string> = {
  INFO:  "bg-blue-50 text-blue-700 border-blue-200",
  WARN:  "bg-amber-50 text-amber-700 border-amber-200",
  ERROR: "bg-red-50 text-red-700 border-red-200",
}

function LogRow({ log }: { log: BotLogRow }) {
  const ts = new Date(log.ts).toLocaleTimeString("en-GB", { hour12: false })
  const levelCls = LEVEL_CLASSES[log.level] ?? LEVEL_CLASSES.INFO
  return (
    <tr className="border-b border-neutral-100 text-sm hover:bg-neutral-50/60">
      <td className="w-24 py-2 pr-3 font-mono text-[11px] text-neutral-400">{ts}</td>
      <td className="w-16 py-2 pr-3">
        <span className={`inline-block rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase ${levelCls}`}>
          {log.level}
        </span>
      </td>
      <td className="w-36 py-2 pr-3 font-mono text-[11px] text-neutral-600">{log.event}</td>
      <td className="w-20 py-2 pr-3 text-[11px] text-neutral-500">{log.symbol ?? "—"}</td>
      <td className="py-2 text-[12px] text-neutral-800">{log.message}</td>
    </tr>
  )
}

export function BotLogStream() {
  const [logs, setLogs] = useState<BotLogRow[]>([])
  const [connected, setConnected] = useState(false)
  const [autoScroll, setAutoScroll] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const es = new EventSource("/api/bot-log/stream")

    es.onopen = () => setConnected(true)
    es.onerror = () => setConnected(false)

    es.onmessage = (e) => {
      const msg = JSON.parse(e.data) as { type: string; logs?: BotLogRow[]; log?: BotLogRow }
      if (msg.type === "init" && msg.logs) {
        setLogs(msg.logs.slice().reverse())
      } else if (msg.type === "log" && msg.log) {
        setLogs((prev) => [msg.log!, ...prev].slice(0, 500))
      }
    }

    return () => es.close()
  }, [])

  useEffect(() => {
    if (autoScroll) bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [logs, autoScroll])

  return (
    <div className="flex flex-col gap-4">
      {/* Status bar */}
      <div className="flex items-center gap-3 text-sm">
        <span className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-500" : "bg-red-400"}`} />
        <span className="text-neutral-600">{connected ? "Bot connected" : "Waiting for bot…"}</span>
        <button
          onClick={() => setAutoScroll((v) => !v)}
          className="ml-auto rounded border border-neutral-200 px-2 py-0.5 text-[11px] text-neutral-500 hover:bg-neutral-100"
        >
          {autoScroll ? "Pause scroll" : "Resume scroll"}
        </button>
        <button
          onClick={() => setLogs([])}
          className="rounded border border-neutral-200 px-2 py-0.5 text-[11px] text-neutral-500 hover:bg-neutral-100"
        >
          Clear
        </button>
      </div>

      {/* Log table */}
      <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
        <table className="w-full min-w-[640px] table-fixed">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50 text-[10px] uppercase tracking-wider text-neutral-500">
              <th className="w-24 px-0 py-2 pr-3 text-left font-medium">Time</th>
              <th className="w-16 py-2 pr-3 text-left font-medium">Level</th>
              <th className="w-36 py-2 pr-3 text-left font-medium">Event</th>
              <th className="w-20 py-2 pr-3 text-left font-medium">Symbol</th>
              <th className="py-2 text-left font-medium">Message</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-sm text-neutral-400">
                  No bot events yet — start the bot to see activity here.
                </td>
              </tr>
            ) : (
              logs.map((log) => <LogRow key={log.id} log={log} />)
            )}
          </tbody>
        </table>
        <div ref={bottomRef} />
      </div>
    </div>
  )
}

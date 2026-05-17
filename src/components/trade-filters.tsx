"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useTransition } from "react"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export function TradeFilters() {
  const router = useRouter()
  const params = useSearchParams()
  const [isPending, startTransition] = useTransition()

  function update(key: string, value: string | null) {
    const next = new URLSearchParams(params.toString())
    if (value) next.set(key, value)
    else next.delete(key)
    next.delete("page")
    startTransition(() => router.push(`?${next.toString()}`))
  }

  const symbol = params.get("symbol") ?? ""
  const status = params.get("status") ?? ""

  const exportParams = new URLSearchParams()
  const from = params.get("from")
  const to = params.get("to")
  if (from) exportParams.set("from", from)
  if (to) exportParams.set("to", to)
  const exportHref = `/api/trades/export${exportParams.size ? `?${exportParams}` : ""}`

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <Input
        className="h-8 w-36 text-sm"
        placeholder="Symbol…"
        defaultValue={symbol}
        onChange={(e) => update("symbol", e.target.value.toUpperCase().trim())}
        disabled={isPending}
      />

      <Select
        value={status || "ALL"}
        onValueChange={(v) => update("status", v === "ALL" ? "" : v)}
        disabled={isPending}
      >
        <SelectTrigger className="h-8 w-32 text-sm">
          <SelectValue placeholder="All statuses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">All statuses</SelectItem>
          <SelectItem value="OPEN">Open</SelectItem>
          <SelectItem value="CLOSED">Closed</SelectItem>
        </SelectContent>
      </Select>

      <a
        href={exportHref}
        download
        className="inline-flex h-8 items-center rounded-md px-3 text-xs text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
      >
        Export CSV
      </a>
    </div>
  )
}

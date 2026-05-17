"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useTransition } from "react"
import { Button } from "@/components/ui/button"

export interface PaginationMeta {
  total: number
  page: number
  limit: number
  totalPages: number
}

interface TradePaginationProps {
  meta: PaginationMeta
}

export function TradePagination({ meta }: TradePaginationProps) {
  const router = useRouter()
  const params = useSearchParams()
  const [isPending, startTransition] = useTransition()

  function goTo(page: number) {
    const next = new URLSearchParams(params.toString())
    next.set("page", String(page))
    startTransition(() => router.push(`?${next.toString()}`))
  }

  if (meta.totalPages <= 1 && meta.total === 0) return null

  const start = (meta.page - 1) * meta.limit + 1
  const end = Math.min(meta.page * meta.limit, meta.total)

  return (
    <div className="mt-3 flex items-center justify-between text-sm text-neutral-500">
      <p>
        {meta.total === 0
          ? "No trades"
          : `${start}–${end} of ${meta.total} trades`}
      </p>
      {meta.totalPages > 1 && (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            disabled={meta.page <= 1 || isPending}
            onClick={() => goTo(meta.page - 1)}
          >
            ← Prev
          </Button>
          <span className="text-xs tabular-nums">
            {meta.page} / {meta.totalPages}
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            disabled={meta.page >= meta.totalPages || isPending}
            onClick={() => goTo(meta.page + 1)}
          >
            Next →
          </Button>
        </div>
      )}
    </div>
  )
}

import { Suspense } from "react"
import { prisma } from "@/lib/prisma"
import { TradesView } from "@/components/trades-view"
import { StatsCards } from "@/components/stats-cards"
import { EquityCurve } from "@/components/equity-curve"
import { TradeFilters } from "@/components/trade-filters"
import { TradePagination, type PaginationMeta } from "@/components/trade-pagination"
import { calcAnalytics, type ClosedTrade } from "@/lib/analytics"

export const dynamic = "force-dynamic"

const DEFAULT_LIMIT = 50

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const params = await searchParams
  const page = Math.max(1, Number(params.page) || 1)
  const status =
    params.status === "OPEN" || params.status === "CLOSED"
      ? params.status
      : undefined
  const symbol =
    typeof params.symbol === "string" && params.symbol.trim()
      ? params.symbol.trim()
      : undefined

  const tableWhere = {
    ...(status ? { status } : {}),
    ...(symbol ? { symbol } : {}),
  }

  const [tableTotal, tableTrades, openCount, allClosed] = await Promise.all([
    prisma.trade.count({ where: tableWhere }),
    prisma.trade.findMany({
      where: tableWhere,
      orderBy: { time: "desc" },
      skip: (page - 1) * DEFAULT_LIMIT,
      take: DEFAULT_LIMIT,
      include: { images: { orderBy: { createdAt: "asc" } } },
    }),
    prisma.trade.count({ where: { status: "OPEN" } }),
    prisma.trade.findMany({
      where: { status: "CLOSED" },
      select: { id: true, time: true, pnl: true, symbol: true },
    }),
  ])

  const closedForAnalytics: ClosedTrade[] = allClosed.map((t) => ({
    id: t.id,
    time: t.time.toISOString(),
    pnl: t.pnl ?? 0,
    symbol: t.symbol,
  }))
  const analytics = calcAnalytics(closedForAnalytics)

  const paginationMeta: PaginationMeta = {
    total: tableTotal,
    page,
    limit: DEFAULT_LIMIT,
    totalPages: Math.ceil(tableTotal / DEFAULT_LIMIT) || 1,
  }

  const serialized = tableTrades.map((t) => ({
    ...t,
    time: t.time.toISOString(),
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    images: t.images.map((img) => ({
      id: img.id,
      url: img.url,
      caption: img.caption,
      createdAt: img.createdAt.toISOString(),
    })),
  }))

  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-10 lg:px-10">
      <header className="mb-10 flex flex-col gap-1">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-neutral-500">
          Trading Journal
        </p>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h1 className="text-4xl font-semibold tracking-tight text-neutral-900 lg:text-5xl">
            Every trade, captured.
          </h1>
          <p className="max-w-md text-sm text-neutral-500">
            Webhook-fed from TradingView. Manual edits welcome. Mathematical
            truth, not narrative.
          </p>
        </div>
      </header>

      <StatsCards openCount={openCount} analytics={analytics} />

      {analytics.equityCurve.length >= 2 && (
        <div className="mt-6 rounded-xl border border-neutral-200/80 bg-white px-5 py-4">
          <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-500">
            Equity curve
          </p>
          <EquityCurve data={analytics.equityCurve} />
        </div>
      )}

      <section className="mt-10">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight text-neutral-900">
            Ledger
          </h2>
          <Suspense>
            <TradeFilters />
          </Suspense>
        </div>

        <TradesView initialTrades={serialized} />

        <Suspense>
          <TradePagination meta={paginationMeta} />
        </Suspense>
      </section>
    </main>
  )
}

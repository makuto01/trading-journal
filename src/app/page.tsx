import { prisma } from "@/lib/prisma"
import { TradesView } from "@/components/trades-view"
import { StatsCards } from "@/components/stats-cards"

export const dynamic = "force-dynamic"

export default async function DashboardPage() {
  const trades = await prisma.trade.findMany({
    orderBy: { time: "desc" },
  })

  const open = trades.filter((t) => t.status === "OPEN")
  const closed = trades.filter((t) => t.status === "CLOSED")
  const totalPnl = closed.reduce((sum, t) => sum + (t.pnl ?? 0), 0)
  const winners = closed.filter((t) => (t.pnl ?? 0) > 0).length

  const serialized = trades.map((t) => ({
    ...t,
    time: t.time.toISOString(),
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
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

      <StatsCards
        total={trades.length}
        open={open.length}
        closed={closed.length}
        totalPnl={totalPnl}
        winners={winners}
      />

      <section className="mt-10">
        <TradesView initialTrades={serialized} />
      </section>
    </main>
  )
}

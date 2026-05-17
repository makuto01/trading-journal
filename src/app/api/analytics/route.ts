import { NextRequest } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { calcAnalytics, type ClosedTrade } from "@/lib/analytics"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const querySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  symbol: z.string().min(1).optional(),
})

export async function GET(request: NextRequest): Promise<Response> {
  const raw = Object.fromEntries(request.nextUrl.searchParams)
  const parsed = querySchema.safeParse(raw)
  if (!parsed.success) {
    return Response.json({ error: "Invalid query params" }, { status: 400 })
  }

  const { from, to, symbol } = parsed.data

  const closed = await prisma.trade.findMany({
    where: {
      status: "CLOSED",
      ...(symbol ? { symbol } : {}),
      ...(from || to
        ? {
            time: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          }
        : {}),
    },
    select: { id: true, time: true, pnl: true, symbol: true },
    orderBy: { time: "asc" },
  })

  const trades: ClosedTrade[] = closed.map((t) => ({
    id: t.id,
    time: t.time.toISOString(),
    pnl: t.pnl ?? 0,
    symbol: t.symbol,
  }))

  return Response.json(calcAnalytics(trades))
}

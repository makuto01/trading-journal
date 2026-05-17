import { NextRequest } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const querySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
})

const CSV_HEADERS = [
  "id",
  "externalId",
  "symbol",
  "side",
  "status",
  "entry",
  "stopLoss",
  "takeProfit",
  "lots",
  "exitPrice",
  "pnl",
  "reason",
  "time",
  "createdAt",
]

function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return ""
  const str = String(value)
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function toRow(trade: Record<string, unknown>): string {
  return CSV_HEADERS.map((h) => escapeCell(trade[h])).join(",")
}

export async function GET(request: NextRequest): Promise<Response> {
  const raw = Object.fromEntries(request.nextUrl.searchParams)
  const parsed = querySchema.safeParse(raw)
  if (!parsed.success) {
    return Response.json({ error: "Invalid query params" }, { status: 400 })
  }

  const { from, to } = parsed.data

  const trades = await prisma.trade.findMany({
    where:
      from || to
        ? {
            time: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          }
        : undefined,
    orderBy: { time: "asc" },
  })

  const rows = [
    CSV_HEADERS.join(","),
    ...trades.map((t) =>
      toRow({
        ...t,
        time: t.time.toISOString(),
        createdAt: t.createdAt.toISOString(),
        exitPrice: t.exitPrice ?? "",
        pnl: t.pnl ?? "",
        externalId: t.externalId ?? "",
        reason: t.reason ?? "",
      })
    ),
  ]

  const filename = `trades-${new Date().toISOString().slice(0, 10)}.csv`

  return new Response(rows.join("\n"), {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}

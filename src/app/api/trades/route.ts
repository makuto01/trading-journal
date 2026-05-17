import { NextRequest } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { manualCreateSchema } from "@/lib/webhook-schema"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
  status: z.enum(["OPEN", "CLOSED"]).optional(),
  symbol: z.string().min(1).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
})

export async function GET(request: NextRequest): Promise<Response> {
  const raw = Object.fromEntries(request.nextUrl.searchParams)
  const parsed = listQuerySchema.safeParse(raw)
  if (!parsed.success) {
    return Response.json({ error: "Invalid query params" }, { status: 400 })
  }

  const { page, limit, status, symbol, from, to } = parsed.data

  const where = {
    ...(status ? { status } : {}),
    ...(symbol ? { symbol } : {}),
    ...(from || to
      ? { time: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } }
      : {}),
  }

  const [total, trades] = await Promise.all([
    prisma.trade.count({ where }),
    prisma.trade.findMany({
      where,
      orderBy: { time: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ])

  return Response.json({
    trades,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) || 1 },
  })
}

export async function POST(request: NextRequest): Promise<Response> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = manualCreateSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid payload", issues: z.treeifyError(parsed.error) },
      { status: 400 }
    )
  }

  const created = await prisma.trade.create({
    data: { ...parsed.data, status: "OPEN" },
  })
  return Response.json(created, { status: 201 })
}

import { NextRequest } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { manualCreateSchema } from "@/lib/webhook-schema"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(): Promise<Response> {
  const trades = await prisma.trade.findMany({
    orderBy: { time: "desc" },
  })
  return Response.json({ trades })
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

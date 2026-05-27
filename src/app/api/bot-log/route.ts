import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { handleBotLog } from "@/lib/bot-log-handler"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: NextRequest): Promise<Response> {
  let rawBody: unknown
  try {
    rawBody = await request.json()
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const result = await handleBotLog({
    authorizationHeader: request.headers.get("Authorization"),
    rawBody,
    // Cast because the handler's BotLogRepository uses loose Record types for testability.
    prisma: prisma as never,
    secret: process.env.BOT_LOG_SECRET,
  })

  return Response.json(result.body, { status: result.status })
}

export async function GET(request: NextRequest): Promise<Response> {
  const limit = Math.min(
    200,
    Math.max(1, Number(request.nextUrl.searchParams.get("limit") || "100"))
  )
  const since = request.nextUrl.searchParams.get("since") ?? undefined

  const logs = await prisma.botLog.findMany({
    orderBy: { ts: "desc" },
    take: limit,
    ...(since ? { cursor: { id: since }, skip: 1 } : {}),
  })

  return Response.json({ logs })
}

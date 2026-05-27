import { z } from "zod"

export const botLogSchema = z.object({
  level: z.enum(["INFO", "WARN", "ERROR"]),
  event: z.string().min(1),
  symbol: z.string().optional(),
  message: z.string().min(1),
  payload: z.unknown().optional(),
  tradeId: z.string().optional(),
})

export type BotLogInput = z.infer<typeof botLogSchema>

export interface BotLogRecord {
  id: string
  ts: Date
  level: string
  event: string
  symbol: string | null
  message: string
  payload: string | null
  tradeId: string | null
}

export interface BotLogRepository {
  botLog: {
    create: (args: { data: Record<string, unknown> }) => Promise<BotLogRecord>
    findMany: (args: {
      where?: Record<string, unknown>
      orderBy?: Record<string, unknown>
      take?: number
      cursor?: { id: string }
      skip?: number
    }) => Promise<BotLogRecord[]>
  }
}

export interface HandleBotLogInput {
  authorizationHeader: string | null
  rawBody: unknown
  prisma: BotLogRepository
  secret: string | undefined
}

export interface HandlerResult {
  status: number
  body: Record<string, unknown>
}

function extractBearer(header: string | null): string | undefined {
  if (!header) return undefined
  const m = header.trim().match(/^Bearer\s+(.+)$/i)
  return m ? m[1].trim() : undefined
}

export async function handleBotLog({
  authorizationHeader,
  rawBody,
  prisma,
  secret,
}: HandleBotLogInput): Promise<HandlerResult> {
  if (!secret) {
    return { status: 500, body: { error: "BOT_LOG_SECRET not configured" } }
  }

  const bearer = extractBearer(authorizationHeader)
  if (!bearer || bearer !== secret) {
    return { status: 401, body: { error: "Unauthorized" } }
  }

  const parsed = botLogSchema.safeParse(rawBody)
  if (!parsed.success) {
    return {
      status: 400,
      body: { error: "Invalid payload", issues: z.treeifyError(parsed.error) },
    }
  }

  const { level, event, symbol, message, payload, tradeId } = parsed.data
  const record = await prisma.botLog.create({
    data: {
      level,
      event,
      symbol: symbol ?? null,
      message,
      payload: payload !== undefined ? JSON.stringify(payload) : null,
      tradeId: tradeId ?? null,
    },
  })

  return { status: 201, body: { id: record.id } }
}

import { z } from "zod"
import { webhookSchema } from "./webhook-schema"

export interface HandlerResult {
  status: number
  body: Record<string, unknown>
}

// Minimal Prisma surface the handler needs. Lets tests pass an in-memory
// double without depending on a real PrismaClient instance.
export interface TradeRepository {
  trade: {
    create: (args: { data: Record<string, unknown> }) => Promise<{
      id: string
      status: string
    }>
    update: (args: {
      where: { externalId: string }
      data: Record<string, unknown>
    }) => Promise<{ id: string; status: string }>
  }
}

export interface HandleWebhookInput {
  authorizationHeader: string | null
  rawBody: unknown
  prisma: TradeRepository
  secret: string | undefined
}

const PRISMA_NOT_FOUND_CODE = "P2025"

function extractBearer(header: string | null): string | undefined {
  if (!header) return undefined
  const trimmed = header.trim()
  const match = trimmed.match(/^Bearer\s+(.+)$/i)
  return match ? match[1].trim() : undefined
}

function unauthorized(): HandlerResult {
  return { status: 401, body: { error: "Unauthorized" } }
}

export async function handleWebhook({
  authorizationHeader,
  rawBody,
  prisma,
  secret,
}: HandleWebhookInput): Promise<HandlerResult> {
  if (!secret) {
    return {
      status: 500,
      body: { error: "Server misconfiguration: WEBHOOK_SECRET unset" },
    }
  }

  const parsed = webhookSchema.safeParse(rawBody)
  if (!parsed.success) {
    // Auth must still be checked even for malformed payloads so we don't leak
    // schema details to unauthenticated callers.
    const headerSecret = extractBearer(authorizationHeader)
    const bodySecret =
      typeof rawBody === "object" &&
      rawBody !== null &&
      "secret" in rawBody &&
      typeof (rawBody as { secret: unknown }).secret === "string"
        ? (rawBody as { secret: string }).secret
        : undefined
    if (headerSecret !== secret && bodySecret !== secret) {
      return unauthorized()
    }
    return {
      status: 400,
      body: {
        error: "Invalid payload",
        issues: z.treeifyError(parsed.error),
      },
    }
  }

  const headerSecret = extractBearer(authorizationHeader)
  const bodySecret = parsed.data.secret
  if (headerSecret !== secret && bodySecret !== secret) {
    return unauthorized()
  }

  if (parsed.data.action === "open") {
    const { secret: _ignored, action: _action, ...fields } = parsed.data
    const created = await prisma.trade.create({
      data: { ...fields, status: "OPEN" },
    })
    return {
      status: 200,
      body: { id: created.id, status: created.status },
    }
  }

  // close
  const { externalId, exitPrice, pnl } = parsed.data
  try {
    const updated = await prisma.trade.update({
      where: { externalId },
      data: { exitPrice, pnl, status: "CLOSED" },
    })
    return {
      status: 200,
      body: { id: updated.id, status: updated.status },
    }
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: unknown }).code === PRISMA_NOT_FOUND_CODE
    ) {
      return {
        status: 404,
        body: { error: `Trade with externalId="${externalId}" not found` },
      }
    }
    throw error
  }
}

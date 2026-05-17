import { z } from "zod"
import { timingSafeEqual } from "crypto"
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
    findUnique: (args: {
      where: { externalId: string }
    }) => Promise<{ id: string; status: string } | null>
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
const PRISMA_UNIQUE_VIOLATION_CODE = "P2002"

function isPrismaError(e: unknown, code: string): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    (e as { code: unknown }).code === code
  )
}

function extractBearer(header: string | null): string | undefined {
  if (!header) return undefined
  const match = header.trim().match(/^Bearer\s+(.+)$/i)
  return match ? match[1].trim() : undefined
}

// Constant-time comparison to prevent timing oracle on secret value.
// Uses timingSafeEqual so the comparison time doesn't vary with the
// common-prefix length; length mismatch is rejected before comparison
// to avoid throwing (Buffer.from both sides first).
function secretsMatch(candidate: string | undefined, actual: string): boolean {
  if (candidate === undefined) return false
  const a = Buffer.from(candidate)
  const b = Buffer.from(actual)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

function isAuthorized(
  headerSecret: string | undefined,
  bodySecret: string | undefined,
  actual: string
): boolean {
  return secretsMatch(headerSecret, actual) || secretsMatch(bodySecret, actual)
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
    if (!isAuthorized(headerSecret, bodySecret, secret)) {
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
  if (!isAuthorized(headerSecret, bodySecret, secret)) {
    return unauthorized()
  }

  if (parsed.data.action === "open") {
    const { secret: _ignored, action: _action, ...fields } = parsed.data
    try {
      const created = await prisma.trade.create({
        data: { ...fields, status: "OPEN" },
      })
      return {
        status: 200,
        body: { id: created.id, status: created.status },
      }
    } catch (error: unknown) {
      // Idempotent retry: same externalId already exists (TradingView re-fires on network issues).
      if (isPrismaError(error, PRISMA_UNIQUE_VIOLATION_CODE) && fields.externalId) {
        const existing = await prisma.trade.findUnique({
          where: { externalId: fields.externalId },
        })
        if (existing) {
          return {
            status: 200,
            body: { id: existing.id, status: existing.status },
          }
        }
      }
      throw error
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
    if (isPrismaError(error, PRISMA_NOT_FOUND_CODE)) {
      return {
        status: 404,
        body: { error: `Trade with externalId="${externalId}" not found` },
      }
    }
    throw error
  }
}

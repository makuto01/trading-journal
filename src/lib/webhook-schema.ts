import { z } from "zod"

const isoOrEpoch = z.union([z.string(), z.number()]).transform((v, ctx) => {
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Invalid datetime; expected ISO-8601 string or epoch ms",
    })
    return z.NEVER
  }
  return d
})

export const sideSchema = z.enum(["BUY", "SELL"])

export const openWebhookSchema = z.object({
  action: z.literal("open"),
  secret: z.string().optional(),
  externalId: z.string().min(1).optional(),
  symbol: z.string().min(1),
  side: sideSchema,
  entry: z.number().finite(),
  stopLoss: z.number().finite(),
  takeProfit: z.number().finite(),
  lots: z.number().finite().positive(),
  time: isoOrEpoch,
  reason: z.string().optional(),
})

export const closeWebhookSchema = z.object({
  action: z.literal("close"),
  secret: z.string().optional(),
  externalId: z.string().min(1),
  exitPrice: z.number().finite(),
  pnl: z.number().finite(),
  time: isoOrEpoch.optional(),
})

export const webhookSchema = z.discriminatedUnion("action", [
  openWebhookSchema,
  closeWebhookSchema,
])

export type OpenWebhookPayload = z.infer<typeof openWebhookSchema>
export type CloseWebhookPayload = z.infer<typeof closeWebhookSchema>
export type WebhookPayload = z.infer<typeof webhookSchema>

// Manual create/update schemas reused by /api/trades.
export const manualCreateSchema = openWebhookSchema
  .omit({ action: true, secret: true })
  .extend({
    score: z.number().int().min(1).max(10).optional(),
    tier: z.enum(["S", "A", "B", "C", "D", "F"]).optional(),
    scoreBreakdown: z.string().optional(),
    autoFilled: z.boolean().optional(),
  })

export const manualUpdateSchema = z
  .object({
    symbol: z.string().min(1).optional(),
    side: sideSchema.optional(),
    entry: z.number().finite().optional(),
    stopLoss: z.number().finite().optional(),
    takeProfit: z.number().finite().optional(),
    lots: z.number().finite().positive().optional(),
    time: isoOrEpoch.optional(),
    reason: z.string().nullable().optional(),
    status: z.enum(["OPEN", "CLOSED"]).optional(),
    exitPrice: z.number().finite().nullable().optional(),
    pnl: z.number().finite().nullable().optional(),
  })
  .strict()

export type ManualCreateInput = z.infer<typeof manualCreateSchema>
export type ManualUpdateInput = z.infer<typeof manualUpdateSchema>

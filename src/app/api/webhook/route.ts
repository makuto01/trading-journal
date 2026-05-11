import { NextRequest } from "next/server"
import { handleWebhook } from "@/lib/webhook-handler"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: NextRequest): Promise<Response> {
  let rawBody: unknown
  try {
    rawBody = await request.json()
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const result = await handleWebhook({
    authorizationHeader: request.headers.get("authorization"),
    rawBody,
    prisma,
    secret: process.env.WEBHOOK_SECRET,
  })

  return Response.json(result.body, { status: result.status })
}

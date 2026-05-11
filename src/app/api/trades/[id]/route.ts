import { NextRequest } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { manualUpdateSchema } from "@/lib/webhook-schema"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

interface Context {
  params: Promise<{ id: string }>
}

export async function PATCH(
  request: NextRequest,
  ctx: Context
): Promise<Response> {
  const { id } = await ctx.params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = manualUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid payload", issues: z.treeifyError(parsed.error) },
      { status: 400 }
    )
  }

  try {
    const updated = await prisma.trade.update({
      where: { id },
      data: parsed.data,
    })
    return Response.json(updated)
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: unknown }).code === "P2025"
    ) {
      return Response.json({ error: "Trade not found" }, { status: 404 })
    }
    throw error
  }
}

export async function DELETE(
  _request: NextRequest,
  ctx: Context
): Promise<Response> {
  const { id } = await ctx.params
  try {
    await prisma.trade.delete({ where: { id } })
    return new Response(null, { status: 204 })
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: unknown }).code === "P2025"
    ) {
      return Response.json({ error: "Trade not found" }, { status: 404 })
    }
    throw error
  }
}

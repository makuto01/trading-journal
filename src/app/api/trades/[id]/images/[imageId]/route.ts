import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { deleteTradeImageFile } from "@/lib/uploads"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

interface Context {
  params: Promise<{ id: string; imageId: string }>
}

export async function DELETE(
  _request: NextRequest,
  ctx: Context
): Promise<Response> {
  const { id, imageId } = await ctx.params
  const image = await prisma.tradeImage.findUnique({ where: { id: imageId } })
  if (!image || image.tradeId !== id) {
    return Response.json({ error: "Image not found" }, { status: 404 })
  }
  await deleteTradeImageFile(image.url)
  await prisma.tradeImage.delete({ where: { id: imageId } })
  return new Response(null, { status: 204 })
}

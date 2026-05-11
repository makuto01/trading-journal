import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { saveTradeImage, UploadError } from "@/lib/uploads"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

interface Context {
  params: Promise<{ id: string }>
}

export async function GET(
  _request: NextRequest,
  ctx: Context
): Promise<Response> {
  const { id } = await ctx.params
  const images = await prisma.tradeImage.findMany({
    where: { tradeId: id },
    orderBy: { createdAt: "asc" },
  })
  return Response.json({ images })
}

export async function POST(
  request: NextRequest,
  ctx: Context
): Promise<Response> {
  const { id } = await ctx.params

  const trade = await prisma.trade.findUnique({ where: { id } })
  if (!trade) {
    return Response.json({ error: "Trade not found" }, { status: 404 })
  }

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return Response.json({ error: "Invalid form data" }, { status: 400 })
  }

  const entries = form.getAll("files")
  const files = entries.filter((entry): entry is File => entry instanceof File)
  if (files.length === 0) {
    return Response.json(
      { error: "No files provided. Use the 'files' field." },
      { status: 400 }
    )
  }

  try {
    const saved = []
    for (const file of files) {
      const result = await saveTradeImage(id, file)
      const row = await prisma.tradeImage.create({
        data: { tradeId: id, url: result.url },
      })
      saved.push(row)
    }
    return Response.json({ images: saved }, { status: 201 })
  } catch (error: unknown) {
    if (error instanceof UploadError) {
      return Response.json({ error: error.message }, { status: 400 })
    }
    throw error
  }
}

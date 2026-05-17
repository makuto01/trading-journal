import { NextRequest } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { analyzeImages, type ImageInput, type AnthropicLike } from "@/lib/image-analyzer"
import { createGeminiClient } from "@/lib/gemini-adapter"
import { calcScore } from "@/lib/scorer"
import { type CriterionId } from "@/lib/scoring-criteria"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"])
const MAX_BYTES = 5 * 1024 * 1024
const MAX_FILES = 3

const DEFAULT_ACCOUNT_SIZE = Number(process.env.DEFAULT_ACCOUNT_SIZE ?? "10000")
const DEFAULT_RISK_PCT = Number(process.env.DEFAULT_RISK_PCT ?? "1.5")
const DEFAULT_LOT_MULTIPLIER = Number(process.env.DEFAULT_LOT_MULTIPLIER ?? "100000")

function calcLots(entry: number, stopLoss: number): number {
  const pips = Math.abs(entry - stopLoss)
  if (pips === 0) return 0
  const lots = (DEFAULT_ACCOUNT_SIZE * (DEFAULT_RISK_PCT / 100)) / (pips * DEFAULT_LOT_MULTIPLIER)
  return Math.min(Math.round(lots * 100) / 100, 100)
}

export async function POST(request: NextRequest): Promise<Response> {
  const apiKey = process.env.ANTHROPIC_API_KEY ?? process.env.GEMINI_API_KEY
  if (!apiKey) {
    return Response.json(
      { error: "No API key configured. Set ANTHROPIC_API_KEY or GEMINI_API_KEY in .env." },
      { status: 500 }
    )
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return Response.json({ error: "Expected multipart/form-data" }, { status: 400 })
  }

  const files = formData.getAll("files[]") as File[]
  if (files.length === 0) {
    return Response.json({ error: "At least one file is required" }, { status: 400 })
  }
  if (files.length > MAX_FILES) {
    return Response.json({ error: `Maximum ${MAX_FILES} images allowed` }, { status: 400 })
  }

  const images: ImageInput[] = []
  for (const file of files) {
    if (!ALLOWED_TYPES.has(file.type)) {
      return Response.json(
        { error: `Unsupported file type: ${file.type}. Use PNG, JPEG, or WebP.` },
        { status: 400 }
      )
    }
    if (file.size > MAX_BYTES) {
      return Response.json({ error: "File too large. Max 5MB per image." }, { status: 400 })
    }
    const buffer = Buffer.from(await file.arrayBuffer())
    images.push({ data: buffer, mimeType: file.type as ImageInput["mimeType"] })
  }

  try {
    let client: AnthropicLike
    if (apiKey.startsWith("sk-ant-")) {
      client = new Anthropic({ apiKey })
    } else {
      client = createGeminiClient(apiKey)
    }
    const analysis = await analyzeImages(images, client)
    const { score, tier, breakdown } = calcScore(
      analysis.detectedCriteria as Partial<Record<CriterionId, boolean>>
    )
    const lots = calcLots(analysis.entry, analysis.stopLoss)

    return Response.json({
      extracted: {
        symbol: analysis.symbol,
        side: analysis.side,
        entry: analysis.entry,
        sl: analysis.stopLoss,
        tp: analysis.takeProfit,
        lots,
        time: analysis.timeISO,
      },
      scoring: { score, tier, breakdown },
      autoFilled: true,
      notes: analysis.notes,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Analysis failed"
    return Response.json({ error: message }, { status: 500 })
  }
}

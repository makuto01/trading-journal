import { z } from "zod"
import { type CriterionId } from "./scoring-criteria"

export interface ImageInput {
  data: Buffer
  mimeType: "image/png" | "image/jpeg" | "image/webp"
}

export interface AnthropicMessage {
  content: Array<{
    type: string
    text?: string
  }>
}

// Narrow interface so tests can mock without importing the full SDK
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface AnthropicLike {
  messages: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    create(params: any): Promise<AnthropicMessage>
  }
}

const criterionIds: CriterionId[] = [
  "timeCheck", "liquiditySweep", "displacement", "mss", "fvg",
  "fibAnchor", "frvpAnchor", "frvp40pct", "sTierRule",
  "patience", "candleConfirm", "execution",
]

const analysisSchema = z.object({
  symbol: z.string().min(1),
  side: z.enum(["BUY", "SELL"]),
  entry: z.number().finite(),
  stopLoss: z.number().finite(),
  takeProfit: z.number().finite(),
  timeISO: z.string(),
  detectedCriteria: z.record(z.string(), z.boolean()),
  notes: z.string().optional(),
})

export type AnalysisResult = z.infer<typeof analysisSchema>

const SYSTEM_PROMPT = `You are a professional forex/CFD trade analyzer. The user provides TradingView chart screenshots (multiple timeframes: 30M, 5M, and/or 1M) with Fibonacci retracement, Fixed Range Volume Profile (FRVP), and Fair Value Gap (FVG) boxes drawn on the chart.

Your task:
1. Extract trade details from the charts.
2. Evaluate which of the 12 S-Tier setup criteria are visible and satisfied.

Criteria IDs and what to look for:
- timeCheck: Chart timestamp is within London (09:00-12:00 CEST) or NY (14:00-17:00 CEST) session
- liquiditySweep: Price wick pierces below a recent swing low (for BUY) or above swing high (for SELL)
- displacement: Strong reversal impulse — large bodied candles with small wicks immediately after the sweep
- mss: The impulse breaks the previous minor swing high (BUY) or swing low (SELL) — Market Structure Shift
- fvg: An unfilled Fair Value Gap (imbalance / FVG box) is visible from the impulse move
- fibAnchor: Fibonacci is drawn from the body of the sweep candle to the body of the displacement candle
- frvpAnchor: A Fixed Range Volume Profile overlay covers the same price leg as the Fibonacci
- frvp40pct: The FRVP appears to use a 40% Value Area setting (not 70% default) — narrower core zone
- sTierRule: The 61.8%-78.6% Fibonacci OTE zone, the unfilled FVG, and the FRVP Core/POC all visually overlap
- patience: Price has retraced back into the confluence zone after the initial displacement
- candleConfirm: A full engulfing candle or strong pin bar/rejection wick is visible at the cluster
- execution: A market entry appears to have been placed at the close of the confirmation candle

Respond ONLY with a JSON object matching this exact structure (no markdown, no extra text):
{
  "symbol": "EURUSD",
  "side": "BUY",
  "entry": 1.0850,
  "stopLoss": 1.0820,
  "takeProfit": 1.0920,
  "timeISO": "2026-05-17T10:30:00Z",
  "detectedCriteria": {
    "timeCheck": true,
    "liquiditySweep": true,
    "displacement": true,
    "mss": false,
    "fvg": true,
    "fibAnchor": true,
    "frvpAnchor": false,
    "frvp40pct": false,
    "sTierRule": false,
    "patience": true,
    "candleConfirm": true,
    "execution": false
  },
  "notes": "Optional brief explanation of key observations"
}`

export async function analyzeImages(
  images: ImageInput[],
  client: AnthropicLike
): Promise<AnalysisResult> {
  if (images.length === 0) throw new Error("At least one image is required")

  const imageBlocks = images.map((img) => ({
    type: "image" as const,
    source: {
      type: "base64" as const,
      media_type: img.mimeType,
      data: img.data.toString("base64"),
    },
  }))

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: [
          ...imageBlocks,
          { type: "text", text: "Analyze these chart screenshots and return the JSON." },
        ],
      },
    ],
  })

  const textBlock = response.content.find((b) => b.type === "text")
  if (!textBlock || !textBlock.text) {
    throw new Error("No text response from Claude Vision")
  }

  let parsed: unknown
  try {
    const raw = textBlock.text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")
    parsed = JSON.parse(raw)
  } catch {
    throw new Error(`Claude Vision returned non-JSON: ${textBlock.text.slice(0, 200)}`)
  }

  const validated = analysisSchema.safeParse(parsed)
  if (!validated.success) {
    throw new Error(`Claude Vision response failed validation: ${JSON.stringify(validated.error.issues)}`)
  }

  const result = validated.data

  // Ensure all 12 criterion IDs are present (fill missing as false)
  const completeCriteria: Record<string, boolean> = {}
  for (const id of criterionIds) {
    completeCriteria[id] = result.detectedCriteria[id] ?? false
  }
  result.detectedCriteria = completeCriteria

  return result
}

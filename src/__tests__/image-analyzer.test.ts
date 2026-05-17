import { analyzeImages, type AnthropicLike, type ImageInput } from "@/lib/image-analyzer"

const fakeImage: ImageInput = {
  data: Buffer.from("fake-png-data"),
  mimeType: "image/png",
}

const validResponse = {
  symbol: "EURUSD",
  side: "BUY",
  entry: 1.085,
  stopLoss: 1.082,
  takeProfit: 1.092,
  timeISO: "2026-05-17T10:30:00Z",
  detectedCriteria: {
    timeCheck: true,
    liquiditySweep: true,
    displacement: true,
    mss: true,
    fvg: true,
    fibAnchor: true,
    frvpAnchor: false,
    frvp40pct: false,
    sTierRule: false,
    patience: true,
    candleConfirm: true,
    execution: false,
  },
  notes: "Strong setup observed",
}

function makeClient(responseText: string): AnthropicLike {
  return {
    messages: {
      create: jest.fn().mockResolvedValue({
        content: [{ type: "text", text: responseText }],
      }),
    },
  }
}

describe("analyzeImages", () => {
  test("returns parsed analysis for a valid response", async () => {
    const client = makeClient(JSON.stringify(validResponse))
    const result = await analyzeImages([fakeImage], client)

    expect(result.symbol).toBe("EURUSD")
    expect(result.side).toBe("BUY")
    expect(result.entry).toBe(1.085)
    expect(result.detectedCriteria.fvg).toBe(true)
    expect(result.detectedCriteria.frvpAnchor).toBe(false)
  })

  test("sends all images in a single request with image blocks", async () => {
    const client = makeClient(JSON.stringify(validResponse))
    const images: ImageInput[] = [
      { data: Buffer.from("img1"), mimeType: "image/png" },
      { data: Buffer.from("img2"), mimeType: "image/jpeg" },
    ]
    await analyzeImages(images, client)

    const createCall = (client.messages.create as jest.Mock).mock.calls[0][0]
    const imageBlocks = createCall.messages[0].content.filter((b: { type: string }) => b.type === "image")
    expect(imageBlocks).toHaveLength(2)
    expect(imageBlocks[0].source.media_type).toBe("image/png")
    expect(imageBlocks[1].source.media_type).toBe("image/jpeg")
  })

  test("fills missing criteria as false when Claude omits some", async () => {
    const partial = { ...validResponse, detectedCriteria: { fvg: true } }
    const client = makeClient(JSON.stringify(partial))
    const result = await analyzeImages([fakeImage], client)

    expect(result.detectedCriteria.fvg).toBe(true)
    expect(result.detectedCriteria.timeCheck).toBe(false)
    expect(result.detectedCriteria.execution).toBe(false)
  })

  test("throws when Claude returns non-JSON", async () => {
    const client = makeClient("Sorry, I cannot analyze this.")
    await expect(analyzeImages([fakeImage], client)).rejects.toThrow(
      "Claude Vision returned non-JSON"
    )
  })

  test("throws when response fails Zod validation (missing required field)", async () => {
    const invalid = { ...validResponse, side: "LONG" }
    const client = makeClient(JSON.stringify(invalid))
    await expect(analyzeImages([fakeImage], client)).rejects.toThrow(
      "Claude Vision response failed validation"
    )
  })

  test("throws when no images provided", async () => {
    const client = makeClient("{}")
    await expect(analyzeImages([], client)).rejects.toThrow("At least one image is required")
  })

  test("throws when response has no text block", async () => {
    const client: AnthropicLike = {
      messages: {
        create: jest.fn().mockResolvedValue({ content: [{ type: "tool_use" }] }),
      },
    }
    await expect(analyzeImages([fakeImage], client)).rejects.toThrow("No text response")
  })
})

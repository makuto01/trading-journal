import { GoogleGenerativeAI, type Part } from "@google/generative-ai"
import type { AnthropicLike, AnthropicMessage } from "./image-analyzer"

export function createGeminiClient(apiKey: string): AnthropicLike {
  const genAI = new GoogleGenerativeAI(apiKey)

  return {
    messages: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async create(params: any): Promise<AnthropicMessage> {
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" })

        const systemText: string = params.system?.[0]?.text ?? ""
        const userContent: Array<{ type: string; source?: { type: string; media_type: string; data: string }; text?: string }> =
          params.messages?.[0]?.content ?? []

        const parts: Part[] = []

        if (systemText) parts.push({ text: systemText })

        for (const block of userContent) {
          if (block.type === "image" && block.source?.type === "base64") {
            parts.push({ inlineData: { mimeType: block.source.media_type, data: block.source.data } })
          } else if (block.type === "text" && block.text) {
            parts.push({ text: block.text })
          }
        }

        const result = await model.generateContent(parts)
        const text = result.response.text()

        return { content: [{ type: "text", text }] }
      },
    },
  }
}

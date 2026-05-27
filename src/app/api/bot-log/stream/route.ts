import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const POLL_INTERVAL_MS = 1500

export async function GET(): Promise<Response> {
  let lastId: string | undefined

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()

      const send = (data: unknown) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
        )
      }

      // Initial batch — last 50 rows
      const initial = await prisma.botLog.findMany({
        orderBy: { ts: "asc" },
        take: 50,
      })
      if (initial.length > 0) {
        lastId = initial[initial.length - 1].id
        send({ type: "init", logs: initial })
      }

      // Poll for new rows
      const poll = setInterval(async () => {
        try {
          const rows = await prisma.botLog.findMany({
            orderBy: { ts: "asc" },
            ...(lastId ? { cursor: { id: lastId }, skip: 1 } : {}),
            take: 50,
          })
          if (rows.length > 0) {
            lastId = rows[rows.length - 1].id
            for (const row of rows) {
              send({ type: "log", log: row })
            }
          }
        } catch {
          clearInterval(poll)
          controller.close()
        }
      }, POLL_INTERVAL_MS)

      // Clean up when client disconnects
      return () => clearInterval(poll)
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}

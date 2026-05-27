import { handleBotLog, BotLogRepository } from "@/lib/bot-log-handler"

const SECRET = "test-bot-secret"

function mockRepo(): BotLogRepository {
  return {
    botLog: {
      create: jest.fn().mockResolvedValue({
        id: "log-1",
        ts: new Date(),
        level: "INFO",
        event: "sweep_detected",
        symbol: "EURUSD",
        message: "Sweep detected",
        payload: null,
        tradeId: null,
      }),
      findMany: jest.fn().mockResolvedValue([]),
    },
  }
}

describe("handleBotLog", () => {
  it("returns 500 when secret is not configured", async () => {
    const result = await handleBotLog({
      authorizationHeader: `Bearer ${SECRET}`,
      rawBody: { level: "INFO", event: "test", message: "hi" },
      prisma: mockRepo(),
      secret: undefined,
    })
    expect(result.status).toBe(500)
  })

  it("returns 401 when no bearer token", async () => {
    const result = await handleBotLog({
      authorizationHeader: null,
      rawBody: { level: "INFO", event: "test", message: "hi" },
      prisma: mockRepo(),
      secret: SECRET,
    })
    expect(result.status).toBe(401)
  })

  it("returns 401 when wrong secret", async () => {
    const result = await handleBotLog({
      authorizationHeader: "Bearer wrong",
      rawBody: { level: "INFO", event: "test", message: "hi" },
      prisma: mockRepo(),
      secret: SECRET,
    })
    expect(result.status).toBe(401)
  })

  it("returns 400 for invalid payload", async () => {
    const result = await handleBotLog({
      authorizationHeader: `Bearer ${SECRET}`,
      rawBody: { level: "VERBOSE" },  // invalid level
      prisma: mockRepo(),
      secret: SECRET,
    })
    expect(result.status).toBe(400)
  })

  it("creates a log row and returns 201", async () => {
    const repo = mockRepo()
    const result = await handleBotLog({
      authorizationHeader: `Bearer ${SECRET}`,
      rawBody: {
        level: "INFO",
        event: "sweep_detected",
        symbol: "EURUSD",
        message: "Sweep below 1.1010 detected",
      },
      prisma: repo,
      secret: SECRET,
    })
    expect(result.status).toBe(201)
    expect(result.body).toHaveProperty("id")
    expect(repo.botLog.create).toHaveBeenCalledTimes(1)
  })

  it("serialises payload as JSON string", async () => {
    const repo = mockRepo()
    await handleBotLog({
      authorizationHeader: `Bearer ${SECRET}`,
      rawBody: {
        level: "WARN",
        event: "setup_rejected",
        message: "No confluence",
        payload: { reason: "no_fvg" },
      },
      prisma: repo,
      secret: SECRET,
    })
    const createArgs = (repo.botLog.create as jest.Mock).mock.calls[0][0]
    expect(createArgs.data.payload).toBe('{"reason":"no_fvg"}')
  })
})

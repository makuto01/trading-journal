import {
  handleWebhook,
  type TradeRepository,
} from "@/lib/webhook-handler"

const SECRET = "test-secret"

function makeRepo(overrides: Partial<TradeRepository["trade"]> = {}) {
  const create = jest.fn(async (args) => ({
    id: "trade_created_id",
    status: "OPEN",
    ...args.data,
  }))
  const findUnique = jest.fn(async (_args: { where: { externalId: string } }) =>
    null as { id: string; status: string } | null
  )
  const update = jest.fn(async (args) => ({
    id: "trade_updated_id",
    status: "CLOSED",
    ...args.data,
  }))
  const repo: TradeRepository = {
    trade: {
      create,
      findUnique,
      update,
      ...overrides,
    } as TradeRepository["trade"],
  }
  return { repo, create, findUnique, update }
}

const validOpenBody = {
  action: "open",
  externalId: "tv-001",
  symbol: "EURUSD",
  side: "BUY",
  entry: 1.085,
  stopLoss: 1.082,
  takeProfit: 1.09,
  lots: 0.1,
  time: "2026-05-07T19:30:00Z",
  reason: "breakout",
}

const validCloseBody = {
  action: "close",
  externalId: "tv-001",
  exitPrice: 1.089,
  pnl: 40,
  time: "2026-05-07T20:15:00Z",
}

describe("handleWebhook", () => {
  test("creates a trade for an authorized open payload", async () => {
    const { repo, create } = makeRepo()
    const result = await handleWebhook({
      authorizationHeader: `Bearer ${SECRET}`,
      rawBody: validOpenBody,
      prisma: repo,
      secret: SECRET,
    })

    expect(result.status).toBe(200)
    expect(result.body).toEqual({
      id: "trade_created_id",
      status: "OPEN",
    })
    expect(create).toHaveBeenCalledTimes(1)
    const callArg = create.mock.calls[0][0] as { data: Record<string, unknown> }
    expect(callArg.data).toMatchObject({
      symbol: "EURUSD",
      side: "BUY",
      entry: 1.085,
      stopLoss: 1.082,
      takeProfit: 1.09,
      lots: 0.1,
      externalId: "tv-001",
      reason: "breakout",
      status: "OPEN",
    })
    expect(callArg.data.time).toBeInstanceOf(Date)
  })

  test("updates a trade for an authorized close payload", async () => {
    const { repo, update } = makeRepo()
    const result = await handleWebhook({
      authorizationHeader: `Bearer ${SECRET}`,
      rawBody: validCloseBody,
      prisma: repo,
      secret: SECRET,
    })

    expect(result.status).toBe(200)
    expect(result.body).toEqual({
      id: "trade_updated_id",
      status: "CLOSED",
    })
    expect(update).toHaveBeenCalledWith({
      where: { externalId: "tv-001" },
      data: { exitPrice: 1.089, pnl: 40, status: "CLOSED" },
    })
  })

  test("rejects with 401 when no auth is provided", async () => {
    const { repo, create, update } = makeRepo()
    const result = await handleWebhook({
      authorizationHeader: null,
      rawBody: validOpenBody,
      prisma: repo,
      secret: SECRET,
    })
    expect(result.status).toBe(401)
    expect(create).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
  })

  test("rejects with 401 when the auth value is wrong", async () => {
    const { repo, create } = makeRepo()
    const result = await handleWebhook({
      authorizationHeader: "Bearer not-the-secret",
      rawBody: { ...validOpenBody, secret: "also-wrong" },
      prisma: repo,
      secret: SECRET,
    })
    expect(result.status).toBe(401)
    expect(create).not.toHaveBeenCalled()
  })

  test("returns 404 when closing a trade that doesn't exist", async () => {
    const notFoundError = Object.assign(
      new Error("Record to update not found."),
      { code: "P2025" }
    )
    const update = jest.fn(async () => {
      throw notFoundError
    })
    const repo: TradeRepository = {
      trade: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update,
      } as unknown as TradeRepository["trade"],
    }

    const result = await handleWebhook({
      authorizationHeader: `Bearer ${SECRET}`,
      rawBody: validCloseBody,
      prisma: repo,
      secret: SECRET,
    })

    expect(result.status).toBe(404)
    expect(update).toHaveBeenCalledTimes(1)
  })

  test("returns 400 with issue tree when payload is malformed", async () => {
    const { repo, create } = makeRepo()
    const result = await handleWebhook({
      authorizationHeader: `Bearer ${SECRET}`,
      rawBody: {
        action: "open",
        symbol: "EURUSD",
        // missing required numeric fields
      },
      prisma: repo,
      secret: SECRET,
    })
    expect(result.status).toBe(400)
    expect(result.body).toHaveProperty("issues")
    expect(create).not.toHaveBeenCalled()
  })

  test("accepts auth via body.secret when header is absent", async () => {
    const { repo, create } = makeRepo()
    const result = await handleWebhook({
      authorizationHeader: null,
      rawBody: { ...validOpenBody, secret: SECRET },
      prisma: repo,
      secret: SECRET,
    })
    expect(result.status).toBe(200)
    expect(create).toHaveBeenCalledTimes(1)
  })

  // --- new: Phase 1 additions ---

  test("returns 200 idempotently when open fires with a duplicate externalId", async () => {
    const uniqueError = Object.assign(new Error("Unique constraint failed."), {
      code: "P2002",
    })
    const create = jest.fn(async () => {
      throw uniqueError
    })
    const findUnique = jest.fn(async () => ({
      id: "existing_trade_id",
      status: "OPEN",
    }))
    const { repo } = makeRepo({ create, findUnique })

    const result = await handleWebhook({
      authorizationHeader: `Bearer ${SECRET}`,
      rawBody: validOpenBody,
      prisma: repo,
      secret: SECRET,
    })

    expect(result.status).toBe(200)
    expect(result.body).toEqual({ id: "existing_trade_id", status: "OPEN" })
    expect(findUnique).toHaveBeenCalledWith({ where: { externalId: "tv-001" } })
  })

  test("rethrows unexpected (non-P2002) errors from trade create", async () => {
    const unexpectedError = new Error("Database connection lost")
    const create = jest.fn(async () => {
      throw unexpectedError
    })
    const { repo } = makeRepo({ create })

    await expect(
      handleWebhook({
        authorizationHeader: `Bearer ${SECRET}`,
        rawBody: validOpenBody,
        prisma: repo,
        secret: SECRET,
      })
    ).rejects.toThrow("Database connection lost")
  })

  test("rejects with 401 when secret has wrong length (constant-time path)", async () => {
    const { repo, create } = makeRepo()
    const result = await handleWebhook({
      authorizationHeader: "Bearer short",
      rawBody: validOpenBody,
      prisma: repo,
      secret: SECRET,
    })
    expect(result.status).toBe(401)
    expect(create).not.toHaveBeenCalled()
  })
})

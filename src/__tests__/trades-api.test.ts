// Route handler tests — mock Prisma so tests stay fast and deterministic.
// Consistent with the handleWebhook test philosophy: no real DB, no HTTP server.
import { NextRequest } from "next/server"

// Must mock before importing routes that call prisma
jest.mock("@/lib/prisma", () => ({
  prisma: {
    trade: {
      count: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}))

import { GET as tradesGET, POST as tradesPOST } from "@/app/api/trades/route"
import { PATCH, DELETE } from "@/app/api/trades/[id]/route"
import { prisma } from "@/lib/prisma"

const mockTrade = {
  count: prisma.trade.count as jest.Mock,
  findMany: prisma.trade.findMany as jest.Mock,
  create: prisma.trade.create as jest.Mock,
  update: prisma.trade.update as jest.Mock,
  delete: prisma.trade.delete as jest.Mock,
}

function makeRequest(
  url: string,
  opts: { method?: string; body?: unknown } = {}
) {
  return new NextRequest(url, {
    method: opts.method ?? "GET",
    ...(opts.body
      ? {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(opts.body),
        }
      : {}),
  })
}

const fakeTrade = {
  id: "trade_1",
  externalId: null,
  symbol: "EURUSD",
  side: "BUY",
  entry: 1.085,
  stopLoss: 1.082,
  takeProfit: 1.09,
  lots: 0.1,
  time: new Date("2026-01-01T12:00:00Z"),
  reason: null,
  status: "OPEN",
  exitPrice: null,
  pnl: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}

beforeEach(() => jest.clearAllMocks())

describe("GET /api/trades", () => {
  test("returns paginated trades with default params", async () => {
    mockTrade.count.mockResolvedValue(3)
    mockTrade.findMany.mockResolvedValue([fakeTrade])

    const req = makeRequest("http://localhost/api/trades")
    const res = await tradesGET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.meta).toEqual({ total: 3, page: 1, limit: 50, totalPages: 1 })
    expect(body.trades).toHaveLength(1)
    expect(mockTrade.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 50 })
    )
  })

  test("filters by status when ?status=OPEN", async () => {
    mockTrade.count.mockResolvedValue(1)
    mockTrade.findMany.mockResolvedValue([fakeTrade])

    const req = makeRequest("http://localhost/api/trades?status=OPEN")
    await tradesGET(req)

    expect(mockTrade.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: "OPEN" }) })
    )
  })

  test("filters by symbol when ?symbol=EURUSD", async () => {
    mockTrade.count.mockResolvedValue(1)
    mockTrade.findMany.mockResolvedValue([fakeTrade])

    const req = makeRequest("http://localhost/api/trades?symbol=EURUSD")
    await tradesGET(req)

    expect(mockTrade.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ symbol: "EURUSD" }) })
    )
  })

  test("paginates correctly with ?page=2&limit=10", async () => {
    mockTrade.count.mockResolvedValue(25)
    mockTrade.findMany.mockResolvedValue([])

    const req = makeRequest("http://localhost/api/trades?page=2&limit=10")
    const res = await tradesGET(req)
    const body = await res.json()

    expect(body.meta).toEqual({ total: 25, page: 2, limit: 10, totalPages: 3 })
    expect(mockTrade.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 10 })
    )
  })

  test("returns 400 for invalid status value", async () => {
    const req = makeRequest("http://localhost/api/trades?status=PENDING")
    const res = await tradesGET(req)
    expect(res.status).toBe(400)
  })
})

describe("POST /api/trades", () => {
  const validBody = {
    symbol: "GBPUSD",
    side: "SELL",
    entry: 1.27,
    stopLoss: 1.275,
    takeProfit: 1.26,
    lots: 0.2,
    time: "2026-01-15T09:00:00Z",
  }

  test("creates trade and returns 201", async () => {
    mockTrade.create.mockResolvedValue({ ...fakeTrade, id: "new_trade" })

    const req = makeRequest("http://localhost/api/trades", {
      method: "POST",
      body: validBody,
    })
    const res = await tradesPOST(req)

    expect(res.status).toBe(201)
    expect(mockTrade.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ symbol: "GBPUSD", status: "OPEN" }),
      })
    )
  })

  test("returns 400 for invalid body", async () => {
    const req = makeRequest("http://localhost/api/trades", {
      method: "POST",
      body: { symbol: "EURUSD" }, // missing required fields
    })
    const res = await tradesPOST(req)
    expect(res.status).toBe(400)
  })

  test("returns 400 for malformed JSON", async () => {
    const req = new NextRequest("http://localhost/api/trades", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    })
    const res = await tradesPOST(req)
    expect(res.status).toBe(400)
  })
})

describe("PATCH /api/trades/[id]", () => {
  test("updates trade and returns 200", async () => {
    mockTrade.update.mockResolvedValue({ ...fakeTrade, status: "CLOSED" })

    const req = makeRequest("http://localhost/api/trades/trade_1", {
      method: "PATCH",
      body: { status: "CLOSED", exitPrice: 1.089, pnl: 40 },
    })
    const res = await PATCH(req, { params: Promise.resolve({ id: "trade_1" }) })

    expect(res.status).toBe(200)
    expect(mockTrade.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "trade_1" } })
    )
  })

  test("returns 404 when trade not found", async () => {
    const notFound = Object.assign(new Error("Record not found"), {
      code: "P2025",
    })
    mockTrade.update.mockRejectedValue(notFound)

    const req = makeRequest("http://localhost/api/trades/missing", {
      method: "PATCH",
      body: { status: "CLOSED" },
    })
    const res = await PATCH(req, { params: Promise.resolve({ id: "missing" }) })
    expect(res.status).toBe(404)
  })
})

describe("DELETE /api/trades/[id]", () => {
  test("deletes trade and returns 204", async () => {
    mockTrade.delete.mockResolvedValue(fakeTrade)

    const req = makeRequest("http://localhost/api/trades/trade_1", {
      method: "DELETE",
    })
    const res = await DELETE(req, { params: Promise.resolve({ id: "trade_1" }) })
    expect(res.status).toBe(204)
  })

  test("returns 404 when trade not found", async () => {
    const notFound = Object.assign(new Error("Record not found"), {
      code: "P2025",
    })
    mockTrade.delete.mockRejectedValue(notFound)

    const req = makeRequest("http://localhost/api/trades/missing", {
      method: "DELETE",
    })
    const res = await DELETE(req, { params: Promise.resolve({ id: "missing" }) })
    expect(res.status).toBe(404)
  })
})

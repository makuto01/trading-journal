@AGENTS.md

# Trading Journal

Fully automated trading journal. Captures TradingView webhook alerts (open/close), persists to SQLite via Prisma, and exposes a Next.js dashboard for manual viewing/editing.

## Tech stack

- **Next.js 16** (App Router, src/ layout, no Turbopack at build time)
- **TypeScript** strict mode
- **Tailwind CSS v4** + **shadcn/ui** (neutral base, css variables)
- **Prisma 7** with the new `prisma-client` generator → `src/generated/prisma`
- **SQLite** for local dev (`prisma/dev.db`)
- **Zod 4** for schema validation
- **Jest 30** + **@swc/jest** for fast TS-native unit tests

> **Important Next.js gotcha**: dynamic route `params` is now a `Promise`. Always `await ctx.params` inside route handlers.

> **Important Prisma gotcha**: the v7 client is generated to `src/generated/prisma`, not `node_modules/@prisma/client`. Import via `@/generated/prisma/client` and re-export through `src/lib/prisma.ts`.

## Commands

| Action | Command |
|---|---|
| Start dev server | `npm run dev` |
| Production build | `npm run build` |
| Run unit tests | `npm test` |
| Watch tests | `npm run test:watch` |
| Run a migration | `npm run db:migrate -- --name <name>` |
| Open Prisma Studio | `npm run db:studio` |
| Regenerate client | `npm run db:generate` |

## Environment

Defined in `.env` (gitignored), template in `.env.example`:

| Var | Purpose |
|---|---|
| `DATABASE_URL` | SQLite path, default `file:./dev.db` |
| `WEBHOOK_SECRET` | Shared secret for `POST /api/webhook` |

The Prisma CLI loads `.env` via `prisma.config.ts` (which calls `import "dotenv/config"`).

## Webhook contract

`POST /api/webhook` — auth is `Authorization: Bearer <WEBHOOK_SECRET>` **or** body `secret` field (TradingView Free tier can't set custom headers, so body fallback is required).

Schemas live in `src/lib/webhook-schema.ts` as a Zod discriminated union on `action`:

**Open** (creates a row, status `OPEN`):
```json
{
  "action": "open",
  "externalId": "tv-001",
  "symbol": "EURUSD",
  "side": "BUY",
  "entry": 1.085,
  "stopLoss": 1.082,
  "takeProfit": 1.09,
  "lots": 0.1,
  "time": "2026-05-07T19:30:00Z",
  "reason": "breakout"
}
```

**Close** (updates by `externalId`, sets `status: CLOSED`):
```json
{
  "action": "close",
  "externalId": "tv-001",
  "exitPrice": 1.089,
  "pnl": 40,
  "time": "2026-05-07T20:15:00Z"
}
```

Status code map:
- 200 — created or updated
- 400 — JSON parse error or schema invalid (returns Zod issue tree)
- 401 — missing or wrong secret
- 404 — close payload references unknown `externalId`
- 500 — `WEBHOOK_SECRET` env var unset

## Architecture

```
src/
├── app/
│   ├── page.tsx                  # server-rendered dashboard
│   ├── api/
│   │   ├── webhook/route.ts      # thin Next adapter
│   │   └── trades/
│   │       ├── route.ts          # GET, POST
│   │       └── [id]/route.ts     # PATCH, DELETE
├── components/
│   ├── stats-cards.tsx           # server component
│   ├── trades-view.tsx           # client; table + add/edit modal
│   └── ui/                       # shadcn primitives
├── lib/
│   ├── prisma.ts                 # singleton client
│   ├── webhook-schema.ts         # Zod discriminated union
│   └── webhook-handler.ts        # PURE handler — Jest target
└── __tests__/
    └── webhook-handler.test.ts   # 7 cases
```

## Testing paradigm

Unit tests run against `handleWebhook` — a pure function that takes a `TradeRepository` interface (mocked with `jest.fn()`), the raw body, the auth header, and the secret. **No Next.js runtime, no real Prisma, no HTTP.** This makes the suite fast (sub-second) and deterministic.

The `route.ts` layer is intentionally thin (parse JSON → call handler → serialize result). E2E sanity is verified via curl against `npm run dev`.

When changing webhook logic:
1. Add a failing test in `src/__tests__/webhook-handler.test.ts`
2. Implement in `src/lib/webhook-handler.ts`
3. `npm test` to confirm green
4. Restart dev server and curl-verify

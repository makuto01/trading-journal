# Trading Journal

A lightweight, fully automated trading journal that ingests TradingView webhook alerts and provides a dashboard for reviewing and manually editing trades.

## Features

- **Automatic trade capture** — TradingView alerts hit `POST /api/webhook` to open or close trades
- **Dashboard** — view all trades, filter by status, see stats (total PnL, win rate)
- **Manual CRUD** — add, edit, and delete trades directly from the UI
- **SQLite storage** — zero-config local database, Prisma-managed
- **Dual auth** — Bearer token header *or* body `secret` field (works with TradingView Free tier)

---

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

```env
DATABASE_URL="file:./prisma/dev.db"
WEBHOOK_SECRET="your-secret-here"
```

Pick any strong random string for `WEBHOOK_SECRET`. You will paste it into TradingView alert settings.

### 3. Create the database

```bash
npm run db:migrate
```

This runs the Prisma migration and creates `prisma/dev.db`.

### 4. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — the dashboard loads immediately (empty until trades arrive).

---

## TradingView Setup

### Alert message format

In TradingView → **Create Alert → Notifications → Webhook URL**, set the URL to:

```
http://your-server/api/webhook
```

Set the **Alert Message** body to JSON. TradingView Free tier cannot send custom headers, so include `secret` in the body.

#### Opening a trade

```json
{
  "secret": "your-secret-here",
  "action": "open",
  "externalId": "{{strategy.order.id}}",
  "symbol": "{{ticker}}",
  "side": "BUY",
  "entry": {{strategy.order.price}},
  "stopLoss": 1.0820,
  "takeProfit": 1.0900,
  "lots": 0.10,
  "time": "{{timenow}}",
  "reason": "Breakout above resistance"
}
```

#### Closing a trade

```json
{
  "secret": "your-secret-here",
  "action": "close",
  "externalId": "{{strategy.order.id}}",
  "exitPrice": {{strategy.order.price}},
  "pnl": 40.00,
  "time": "{{timenow}}"
}
```

**`externalId`** links the open and close. Use `{{strategy.order.id}}` from Pine Script or any stable unique string per trade.

### Field reference

| Field | Required for | Type | Description |
|-------|-------------|------|-------------|
| `secret` | both | string | Must match `WEBHOOK_SECRET` (or use Bearer header) |
| `action` | both | `"open"` \| `"close"` | Discriminates the payload |
| `externalId` | both | string | Unique trade ID — links open to close |
| `symbol` | open | string | e.g. `"EURUSD"`, `"BTCUSD"` |
| `side` | open | `"BUY"` \| `"SELL"` | Trade direction |
| `entry` | open | number | Entry price |
| `stopLoss` | open | number | Stop loss price |
| `takeProfit` | open | number | Take profit price |
| `lots` | open | number | Position size in lots |
| `time` | both | ISO 8601 or ms epoch | Trade timestamp |
| `reason` | open | string | Optional: your setup notes |
| `exitPrice` | close | number | Exit fill price |
| `pnl` | close | number | Realized PnL (your currency) |

### Using Bearer header instead of body secret

If your webhook client can send custom headers (e.g. a server-side relay or broker integration):

```
Authorization: Bearer your-secret-here
```

The `secret` field in the body is then optional.

---

## Manual Trade Entry

Click **Add Trade** on the dashboard to create a trade manually. Click the pencil icon on any row to edit it. All fields are editable at any time.

---

## API Reference

### `POST /api/webhook`

Accepts open or close payloads. Returns:

| Status | Meaning |
|--------|---------|
| 200 | Trade created or updated |
| 400 | JSON parse error or schema validation failure |
| 401 | Missing or wrong secret |
| 404 | Close payload references unknown `externalId` |
| 500 | `WEBHOOK_SECRET` env var is not set |

### `GET /api/trades`

Returns all trades ordered by time descending.

```json
{ "trades": [ { "id": "...", "symbol": "EURUSD", "status": "CLOSED", ... } ] }
```

### `POST /api/trades`

Create a trade manually (same fields as open payload, no `secret` required).

### `PATCH /api/trades/:id`

Partially update any trade field. Body: any subset of trade fields.

### `DELETE /api/trades/:id`

Delete a trade by ID.

---

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm start` | Run production build |
| `npm test` | Run unit tests |
| `npm run test:watch` | Watch mode for tests |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:studio` | Open Prisma Studio (visual DB browser) |
| `npm run db:generate` | Regenerate Prisma client after schema changes |

---

## Project Structure

```
src/
├── app/
│   ├── page.tsx                  # Dashboard (server component)
│   └── api/
│       ├── webhook/route.ts      # TradingView webhook receiver
│       └── trades/
│           ├── route.ts          # GET, POST
│           └── [id]/route.ts     # PATCH, DELETE
├── components/
│   ├── stats-cards.tsx           # PnL, win rate, open/closed counts
│   ├── trades-view.tsx           # Trade table + add/edit modal
│   └── ui/                       # shadcn UI primitives
└── lib/
    ├── prisma.ts                 # Prisma singleton
    ├── webhook-schema.ts         # Zod validation schemas
    └── webhook-handler.ts        # Pure handler (unit-testable)
```

---

## Testing

```bash
npm test
```

7 unit tests cover the webhook handler: open, close, auth via header, auth via body, wrong secret, unknown externalId (→ 404), and schema validation failure.

Tests run in ~1 second with no database or network required.

---

## Deploying

The app is a standard Next.js project. The simplest production option is a VPS or cloud VM where you can expose a public URL for TradingView webhooks.

1. Copy the project to your server
2. Set `DATABASE_URL` and `WEBHOOK_SECRET` in `.env`
3. `npm run db:migrate`
4. `npm run build && npm start`

For HTTPS (required by TradingView), put the app behind nginx or Caddy with a certificate.

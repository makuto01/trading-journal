# Trading Journal

A lightweight, fully automated trading journal that ingests TradingView webhook alerts and provides a dashboard for reviewing and manually editing trades.

## Features

- **Automatic trade capture** — TradingView alerts hit `POST /api/webhook` to open or close trades
- **Dashboard** — view all trades, filter by status, see stats (total PnL, win rate)
- **Manual CRUD** — add, edit, and delete trades directly from the UI
- **Screenshots per trade** — paste, drag, or pick image files; stored on disk, viewable in a lightbox
- **Auto-capture from limit orders** — Pine Script "Limit Order Mirror" turns chart levels into webhooks; supports multiple concurrent positions
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

## Screenshots

Every trade can have any number of screenshots attached. There are three ways to add them, all from inside the Add/Edit modal:

1. **Paste** — copy an image to the clipboard (TradingView's "Copy chart image" → Ctrl+Alt+S works), then press **Ctrl+V** anywhere in the modal.
2. **Drag-and-drop** — drop one or more image files onto the dashed upload zone.
3. **File picker** — click **Choose files** and select images.

Accepted formats: PNG, JPEG, WebP, GIF. Max 5MB per image.

Pasted screenshots in **Add** mode are staged in memory and uploaded automatically once you save the trade. In **Edit** mode they upload immediately.

Files are stored on disk at `public/uploads/trades/{tradeId}/{cuid}.{ext}` and served directly by Next.js. The upload directory is gitignored. Deleting a trade cascades to its images.

A small camera icon next to the symbol on each row shows how many screenshots are attached — click it to open the edit modal with the gallery. Click any thumbnail to open the lightbox (arrow keys navigate, `Esc` closes).

---

## Auto-capture from limit orders (Pine Script)

TradingView's Paper Trading panel does **not** fire webhooks for manual orders. The "Limit Order Mirror" Pine Script in `docs/tradingview/limit-order-mirror.pine` is the closest workaround: it puts a broker-form-style settings panel on your chart and fires the open/close webhooks automatically when price touches your levels.

### Setup

1. Open **TradingView → Pine Editor → New Indicator**.
2. Paste the contents of [`docs/tradingview/limit-order-mirror.pine`](docs/tradingview/limit-order-mirror.pine).
3. **Save** (give it any name) → **Add to chart**.
4. Open the indicator's **settings** (cog icon on the indicator title):
   - **Side** — LONG or SHORT
   - **Entry / Stop Loss / Take Profit** — your price levels
   - **Lots / Size** — position size
   - **Lot Multiplier** — `100000` for forex standard lots, `1` for crypto/stocks, contract size for futures
   - **Reason** — free-text setup notes
   - **Webhook Secret** — must match `WEBHOOK_SECRET` in your `.env`
   - **External ID** — leave blank for auto-generation
5. Create a TradingView alert (clock icon → Create Alert):
   - **Condition**: select this indicator → **"Any alert() function call"**
   - **Webhook URL**: `https://your-public-domain.com/api/webhook`
   - **Message**: leave empty — the script builds the JSON itself
   - **Expiration**: pick a far-future date
6. Click **Create**.

### Multiple concurrent positions

Add the indicator to the same chart **once per planned trade**. Each instance has independent settings, state, and external ID. Each fires its own open/close webhook pair.

### Mechanics

| Event | Trigger |
|-------|---------|
| `open` fires | Any bar whose range touches the Entry price (`low ≤ entry ≤ high`) |
| `close` fires | First bar after open whose high (long) / low (short) hits Take Profit, or low/high hits Stop Loss |
| PnL formula | `(exitPrice − entryPrice) × direction × lots × lotMultiplier` |

PnL is an approximation — adjust `Lot Multiplier` per asset, or just edit the PnL field manually in the journal UI after the close webhook lands.

### Local development

For local testing you need a public HTTPS URL. The simplest is [ngrok](https://ngrok.com):

```bash
ngrok http 3001
# → use the https://*.ngrok-free.app URL as your TradingView webhook URL
```

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

Delete a trade by ID. Cascades to attached screenshots.

### `GET /api/trades/:id/images`

Returns all screenshots for a trade, oldest first.

```json
{ "images": [ { "id": "...", "url": "/uploads/trades/.../abc.png", "caption": null, "createdAt": "..." } ] }
```

### `POST /api/trades/:id/images`

Upload one or more screenshots. Content-Type: `multipart/form-data`, field name: `files`. Returns the inserted `TradeImage` rows. Validation: PNG/JPEG/WebP/GIF, max 5MB each.

### `DELETE /api/trades/:id/images/:imageId`

Delete a single screenshot (removes file from disk and row from DB).

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
│   ├── page.tsx                          # Dashboard (server component)
│   └── api/
│       ├── webhook/route.ts              # TradingView webhook receiver
│       └── trades/
│           ├── route.ts                  # GET, POST
│           └── [id]/
│               ├── route.ts              # PATCH, DELETE
│               └── images/
│                   ├── route.ts          # GET, POST (upload)
│                   └── [imageId]/route.ts # DELETE
├── components/
│   ├── stats-cards.tsx                   # PnL, win rate, open/closed counts
│   ├── trades-view.tsx                   # Trade table + add/edit modal
│   ├── trade-image-manager.tsx           # Paste/drop/pick + thumbnail grid + lightbox
│   └── ui/                               # shadcn UI primitives
└── lib/
    ├── prisma.ts                         # Prisma singleton
    ├── uploads.ts                        # File-save + delete helpers (5MB cap)
    ├── webhook-schema.ts                 # Zod validation schemas
    └── webhook-handler.ts                # Pure handler (unit-testable)

docs/
└── tradingview/
    └── limit-order-mirror.pine           # Pine Script auto-capture indicator

public/
└── uploads/trades/{tradeId}/{cuid}.{ext} # User screenshots (gitignored)
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

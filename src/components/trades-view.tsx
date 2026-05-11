"use client"

import { useMemo, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  TradeImageManager,
  type SerializedTradeImage,
  type TradeImageManagerHandle,
} from "@/components/trade-image-manager"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

export interface SerializedTrade {
  id: string
  externalId: string | null
  symbol: string
  side: string
  entry: number
  stopLoss: number
  takeProfit: number
  lots: number
  time: string
  reason: string | null
  status: string
  exitPrice: number | null
  pnl: number | null
  createdAt: string
  updatedAt: string
  images: SerializedTradeImage[]
}

type FormState = {
  symbol: string
  side: "BUY" | "SELL"
  entry: string
  stopLoss: string
  takeProfit: string
  lots: string
  time: string
  reason: string
  status: "OPEN" | "CLOSED"
  exitPrice: string
  pnl: string
}

const emptyForm: FormState = {
  symbol: "",
  side: "BUY",
  entry: "",
  stopLoss: "",
  takeProfit: "",
  lots: "",
  time: "",
  reason: "",
  status: "OPEN",
  exitPrice: "",
  pnl: "",
}

function tradeToForm(t: SerializedTrade): FormState {
  return {
    symbol: t.symbol,
    side: t.side === "SELL" ? "SELL" : "BUY",
    entry: String(t.entry),
    stopLoss: String(t.stopLoss),
    takeProfit: String(t.takeProfit),
    lots: String(t.lots),
    // <input type="datetime-local"> wants YYYY-MM-DDTHH:mm (no Z, no seconds)
    time: t.time.slice(0, 16),
    reason: t.reason ?? "",
    status: t.status === "CLOSED" ? "CLOSED" : "OPEN",
    exitPrice: t.exitPrice == null ? "" : String(t.exitPrice),
    pnl: t.pnl == null ? "" : String(t.pnl),
  }
}

function nowLocalForInput(): string {
  const d = new Date()
  const off = d.getTimezoneOffset()
  const local = new Date(d.getTime() - off * 60_000)
  return local.toISOString().slice(0, 16)
}

interface TradesViewProps {
  initialTrades: SerializedTrade[]
}

export function TradesView({ initialTrades }: TradesViewProps) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingImages, setEditingImages] = useState<SerializedTradeImage[]>([])
  const [form, setForm] = useState<FormState>(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const imageManagerRef = useRef<TradeImageManagerHandle>(null)

  const trades = initialTrades

  const empty = useMemo(() => trades.length === 0, [trades])

  function openAddModal() {
    setEditingId(null)
    setEditingImages([])
    setForm({ ...emptyForm, time: nowLocalForInput() })
    setOpen(true)
  }

  function openEditModal(trade: SerializedTrade) {
    setEditingId(trade.id)
    setEditingImages(trade.images)
    setForm(tradeToForm(trade))
    setOpen(true)
  }

  async function submit() {
    setSubmitting(true)
    try {
      const num = (s: string) => Number(s)
      const isEdit = editingId !== null

      const payload: Record<string, unknown> = {
        symbol: form.symbol.trim(),
        side: form.side,
        entry: num(form.entry),
        stopLoss: num(form.stopLoss),
        takeProfit: num(form.takeProfit),
        lots: num(form.lots),
        time: new Date(form.time).toISOString(),
        reason: form.reason.trim() || null,
      }

      if (isEdit) {
        payload.status = form.status
        payload.exitPrice =
          form.exitPrice.trim() === "" ? null : num(form.exitPrice)
        payload.pnl = form.pnl.trim() === "" ? null : num(form.pnl)
        // PATCH is partial; reason can be null but we always send it
      }

      const url = isEdit ? `/api/trades/${editingId}` : "/api/trades"
      const method = isEdit ? "PATCH" : "POST"

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error ?? `Request failed (${res.status})`)
      }

      const savedTrade = (await res.json()) as { id: string }

      // After creating, upload any staged screenshots to the new trade
      if (!isEdit && imageManagerRef.current?.hasStaged()) {
        try {
          await imageManagerRef.current.flushStaged(savedTrade.id)
        } catch (err: unknown) {
          const msg =
            err instanceof Error ? err.message : "Some screenshots failed"
          toast.error(`Trade saved, but ${msg.toLowerCase()}`)
        }
      }

      toast.success(isEdit ? "Trade updated" : "Trade added")
      setOpen(false)
      startTransition(() => router.refresh())
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong"
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  async function deleteTrade(id: string) {
    if (!confirm("Delete this trade? This cannot be undone.")) return
    const res = await fetch(`/api/trades/${id}`, { method: "DELETE" })
    if (res.ok) {
      toast.success("Trade deleted")
      startTransition(() => router.refresh())
    } else {
      toast.error("Failed to delete trade")
    }
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight text-neutral-900">
          Ledger
        </h2>
        <Button
          onClick={openAddModal}
          className="bg-neutral-900 text-white hover:bg-neutral-800"
        >
          + Add trade
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow className="bg-neutral-50/80 hover:bg-neutral-50/80">
              <TableHead className="w-[140px]">Time</TableHead>
              <TableHead>Symbol</TableHead>
              <TableHead>Side</TableHead>
              <TableHead className="text-right">Entry</TableHead>
              <TableHead className="text-right">SL</TableHead>
              <TableHead className="text-right">TP</TableHead>
              <TableHead className="text-right">Lots</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Exit</TableHead>
              <TableHead className="text-right">PnL</TableHead>
              <TableHead className="w-[120px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {empty ? (
              <TableRow>
                <TableCell
                  colSpan={11}
                  className="h-32 text-center text-sm text-neutral-400"
                >
                  No trades yet. Send a webhook or add one manually.
                </TableCell>
              </TableRow>
            ) : (
              trades.map((t) => (
                <TableRow
                  key={t.id}
                  className="group transition-colors hover:bg-neutral-50/60"
                >
                  <TableCell className="whitespace-nowrap font-mono text-xs text-neutral-500">
                    {new Date(t.time).toLocaleString(undefined, {
                      month: "short",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </TableCell>
                  <TableCell className="font-medium text-neutral-900">
                    <span className="inline-flex items-center gap-1.5">
                      {t.symbol}
                      {t.images.length > 0 && (
                        <button
                          type="button"
                          onClick={() => openEditModal(t)}
                          className="inline-flex items-center gap-0.5 rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-600 hover:bg-neutral-200"
                          title={`${t.images.length} screenshot${t.images.length > 1 ? "s" : ""}`}
                        >
                          <svg
                            width="10"
                            height="10"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <rect x="3" y="3" width="18" height="18" rx="2" />
                            <circle cx="8.5" cy="8.5" r="1.5" />
                            <path d="m21 15-5-5L5 21" />
                          </svg>
                          {t.images.length}
                        </button>
                      )}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
                        t.side === "BUY"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-rose-50 text-rose-700"
                      )}
                    >
                      {t.side}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {t.entry}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-neutral-500">
                    {t.stopLoss}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-neutral-500">
                    {t.takeProfit}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {t.lots}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn(
                        "border-transparent",
                        t.status === "OPEN"
                          ? "bg-indigo-50 text-indigo-700"
                          : "bg-neutral-100 text-neutral-700"
                      )}
                    >
                      {t.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-neutral-500">
                    {t.exitPrice ?? "—"}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right font-mono tabular-nums",
                      t.pnl == null && "text-neutral-400",
                      t.pnl != null && t.pnl > 0 && "text-emerald-600",
                      t.pnl != null && t.pnl < 0 && "text-red-600"
                    )}
                  >
                    {t.pnl == null
                      ? "—"
                      : t.pnl > 0
                        ? `+${t.pnl.toFixed(2)}`
                        : t.pnl.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openEditModal(t)}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-600 hover:bg-red-50 hover:text-red-700"
                        onClick={() => deleteTrade(t.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingId === null ? "Add trade" : "Edit trade"}
            </DialogTitle>
            <DialogDescription>
              {editingId === null
                ? "Capture a manual trade entry. Webhook-fed trades will appear automatically."
                : "Update fields. Set status to CLOSED and add Exit/PnL when the trade closes."}
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              void submit()
            }}
            className="grid grid-cols-2 gap-4"
          >
            <Field label="Symbol" id="symbol">
              <Input
                id="symbol"
                required
                value={form.symbol}
                onChange={(e) =>
                  setForm({ ...form, symbol: e.target.value.toUpperCase() })
                }
                placeholder="EURUSD"
              />
            </Field>

            <Field label="Side" id="side">
              <Select
                value={form.side}
                onValueChange={(v) =>
                  setForm({ ...form, side: v as "BUY" | "SELL" })
                }
              >
                <SelectTrigger id="side">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BUY">BUY</SelectItem>
                  <SelectItem value="SELL">SELL</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field label="Entry" id="entry">
              <Input
                id="entry"
                type="number"
                step="any"
                required
                value={form.entry}
                onChange={(e) => setForm({ ...form, entry: e.target.value })}
              />
            </Field>

            <Field label="Lots" id="lots">
              <Input
                id="lots"
                type="number"
                step="any"
                required
                value={form.lots}
                onChange={(e) => setForm({ ...form, lots: e.target.value })}
              />
            </Field>

            <Field label="Stop loss" id="stopLoss">
              <Input
                id="stopLoss"
                type="number"
                step="any"
                required
                value={form.stopLoss}
                onChange={(e) =>
                  setForm({ ...form, stopLoss: e.target.value })
                }
              />
            </Field>

            <Field label="Take profit" id="takeProfit">
              <Input
                id="takeProfit"
                type="number"
                step="any"
                required
                value={form.takeProfit}
                onChange={(e) =>
                  setForm({ ...form, takeProfit: e.target.value })
                }
              />
            </Field>

            <Field label="Time" id="time">
              <Input
                id="time"
                type="datetime-local"
                required
                value={form.time}
                onChange={(e) => setForm({ ...form, time: e.target.value })}
              />
            </Field>

            {editingId !== null && (
              <Field label="Status" id="status">
                <Select
                  value={form.status}
                  onValueChange={(v) =>
                    setForm({ ...form, status: v as "OPEN" | "CLOSED" })
                  }
                >
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OPEN">OPEN</SelectItem>
                    <SelectItem value="CLOSED">CLOSED</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            )}

            {editingId !== null && (
              <>
                <Field label="Exit price" id="exitPrice">
                  <Input
                    id="exitPrice"
                    type="number"
                    step="any"
                    value={form.exitPrice}
                    onChange={(e) =>
                      setForm({ ...form, exitPrice: e.target.value })
                    }
                    placeholder="—"
                  />
                </Field>
                <Field label="PnL" id="pnl">
                  <Input
                    id="pnl"
                    type="number"
                    step="any"
                    value={form.pnl}
                    onChange={(e) => setForm({ ...form, pnl: e.target.value })}
                    placeholder="—"
                  />
                </Field>
              </>
            )}

            <div className="col-span-2">
              <Field label="Reason" id="reason">
                <Textarea
                  id="reason"
                  rows={2}
                  value={form.reason}
                  onChange={(e) =>
                    setForm({ ...form, reason: e.target.value })
                  }
                  placeholder="Breakout above 1.0845 resistance"
                />
              </Field>
            </div>

            <div className="col-span-2 mt-2 rounded-lg border border-neutral-200 bg-white p-4">
              <TradeImageManager
                ref={imageManagerRef}
                tradeId={editingId}
                initialImages={editingImages}
                onChange={() =>
                  startTransition(() => router.refresh())
                }
              />
            </div>

            <DialogFooter className="col-span-2 mt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="bg-neutral-900 text-white hover:bg-neutral-800"
              >
                {submitting
                  ? "Saving…"
                  : editingId === null
                    ? "Add trade"
                    : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

function Field({
  label,
  id,
  children,
}: {
  label: string
  id: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-xs font-medium text-neutral-700">
        {label}
      </Label>
      {children}
    </div>
  )
}

"use client"

import { Suspense, useCallback, useMemo, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ScoreBadge } from "@/components/score-badge"
import { ScoreBreakdown } from "@/components/score-breakdown"
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
import { TradeFilters } from "@/components/trade-filters"

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
  score: number | null
  tier: string | null
  scoreBreakdown: string | null
  autoFilled: boolean
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

interface ScoringState {
  score: number
  tier: string
  breakdown: Record<string, boolean>
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
  const [analyzing, setAnalyzing] = useState(false)
  const [pendingScoring, setPendingScoring] = useState<ScoringState | null>(null)
  const [pendingAutoFilled, setPendingAutoFilled] = useState(false)
  const imageManagerRef = useRef<TradeImageManagerHandle>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropZoneRef = useRef<HTMLDivElement>(null)

  const trades = initialTrades
  const empty = useMemo(() => trades.length === 0, [trades])

  function openAddModal() {
    setEditingId(null)
    setEditingImages([])
    setForm({ ...emptyForm, time: nowLocalForInput() })
    setPendingScoring(null)
    setPendingAutoFilled(false)
    setOpen(true)
  }

  function openEditModal(trade: SerializedTrade) {
    setEditingId(trade.id)
    setEditingImages(trade.images)
    setForm(tradeToForm(trade))
    setPendingScoring(
      trade.score != null && trade.tier != null && trade.scoreBreakdown != null
        ? { score: trade.score, tier: trade.tier, breakdown: JSON.parse(trade.scoreBreakdown) as Record<string, boolean> }
        : null
    )
    setPendingAutoFilled(trade.autoFilled)
    setOpen(true)
  }

  const analyzeScreenshots = useCallback(async (files: File[]) => {
    if (files.length === 0) return
    setAnalyzing(true)
    try {
      const fd = new FormData()
      for (const f of files) fd.append("files[]", f)

      const res = await fetch("/api/analyze-image", { method: "POST", body: fd })
      const body = (await res.json()) as {
        extracted?: {
          symbol: string; side: string; entry: number
          sl: number; tp: number; lots: number; time: string
        }
        scoring?: { score: number; tier: string; breakdown: Record<string, boolean> }
        notes?: string
        error?: string
      }

      if (!res.ok) throw new Error(body.error ?? `Analysis failed (${res.status})`)

      if (body.extracted) {
        const e = body.extracted
        setForm((prev) => ({
          ...prev,
          symbol: e.symbol,
          side: (e.side === "SELL" ? "SELL" : "BUY") as "BUY" | "SELL",
          entry: String(e.entry),
          stopLoss: String(e.sl),
          takeProfit: String(e.tp),
          lots: String(e.lots),
          time: new Date(e.time).toISOString().slice(0, 16),
        }))
        setPendingAutoFilled(true)
      }

      if (body.scoring) {
        setPendingScoring(body.scoring)
      }

      if (body.notes) toast.info(body.notes, { duration: 5000 })
      toast.success("Trade fields auto-filled from screenshot")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Analysis failed")
    } finally {
      setAnalyzing(false)
    }
  }, [])

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const files = Array.from(e.dataTransfer.files).filter((f) =>
      ["image/png", "image/jpeg", "image/webp"].includes(f.type)
    )
    void analyzeScreenshots(files)
  }

  function handlePaste(e: React.ClipboardEvent) {
    const files = Array.from(e.clipboardData.files).filter((f) =>
      ["image/png", "image/jpeg", "image/webp"].includes(f.type)
    )
    if (files.length > 0) void analyzeScreenshots(files)
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

      if (pendingScoring && !isEdit) {
        payload.score = pendingScoring.score
        payload.tier = pendingScoring.tier
        payload.scoreBreakdown = JSON.stringify(pendingScoring.breakdown)
        payload.autoFilled = pendingAutoFilled
      }

      if (isEdit) {
        payload.status = form.status
        payload.exitPrice = form.exitPrice.trim() === "" ? null : num(form.exitPrice)
        payload.pnl = form.pnl.trim() === "" ? null : num(form.pnl)
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
        throw new Error((body as { error?: string })?.error ?? `Request failed (${res.status})`)
      }

      const savedTrade = (await res.json()) as { id: string }

      if (!isEdit && imageManagerRef.current?.hasStaged()) {
        try {
          await imageManagerRef.current.flushStaged(savedTrade.id)
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Some screenshots failed"
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
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold tracking-tight text-neutral-900">Ledger</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Suspense>
            <TradeFilters />
          </Suspense>
          <Button onClick={openAddModal} className="bg-neutral-900 text-white hover:bg-neutral-800 shrink-0">
            + Add trade
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
        <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-neutral-50/80 hover:bg-neutral-50/80">
              <TableHead className="w-[120px]">Time</TableHead>
              <TableHead>Symbol</TableHead>
              <TableHead>Side</TableHead>
              <TableHead className="text-right">Entry</TableHead>
              <TableHead className="hidden text-right sm:table-cell">SL</TableHead>
              <TableHead className="hidden text-right sm:table-cell">TP</TableHead>
              <TableHead className="hidden text-right md:table-cell">Lots</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden text-right sm:table-cell">Exit</TableHead>
              <TableHead className="text-right">PnL</TableHead>
              <TableHead>Score</TableHead>
              <TableHead className="w-[100px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {empty ? (
              <TableRow>
                <TableCell colSpan={12} className="h-32 text-center text-sm text-neutral-400">
                  No trades yet. Send a webhook or add one manually.
                </TableCell>
              </TableRow>
            ) : (
              trades.map((t) => (
                <TableRow key={t.id} className="group transition-colors hover:bg-neutral-50/60">
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
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
                    <span className={cn(
                      "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
                      t.side === "BUY" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                    )}>
                      {t.side}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{t.entry}</TableCell>
                  <TableCell className="hidden text-right font-mono tabular-nums text-neutral-500 sm:table-cell">{t.stopLoss}</TableCell>
                  <TableCell className="hidden text-right font-mono tabular-nums text-neutral-500 sm:table-cell">{t.takeProfit}</TableCell>
                  <TableCell className="hidden text-right font-mono tabular-nums md:table-cell">{t.lots}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn(
                      "border-transparent",
                      t.status === "OPEN" ? "bg-indigo-50 text-indigo-700" : "bg-neutral-100 text-neutral-700"
                    )}>
                      {t.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden text-right font-mono tabular-nums text-neutral-500 sm:table-cell">
                    {t.exitPrice ?? "—"}
                  </TableCell>
                  <TableCell className={cn(
                    "text-right font-mono tabular-nums",
                    t.pnl == null && "text-neutral-400",
                    t.pnl != null && t.pnl > 0 && "text-emerald-600",
                    t.pnl != null && t.pnl < 0 && "text-red-600"
                  )}>
                    {t.pnl == null ? "—" : t.pnl > 0 ? `+${t.pnl.toFixed(2)}` : t.pnl.toFixed(2)}
                  </TableCell>
                  <TableCell>
                    {t.score != null && t.tier != null ? (
                      <ScoreBadge tier={t.tier} score={t.score} />
                    ) : (
                      <span className="text-[10px] text-neutral-300">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                      <Button size="sm" variant="ghost" onClick={() => openEditModal(t)}>Edit</Button>
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
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="flex max-h-[90svh] w-[calc(100vw-2rem)] max-w-2xl flex-col gap-0 overflow-hidden p-0 sm:w-full"
          onPaste={handlePaste}
        >
          {/* Sticky header */}
          <DialogHeader className="shrink-0 border-b border-neutral-100 px-6 pb-4 pt-6">
            <DialogTitle>{editingId === null ? "Add trade" : "Edit trade"}</DialogTitle>
            <DialogDescription>
              {editingId === null
                ? "Paste or drop TradingView screenshots to auto-fill fields, or enter manually."
                : "Update fields. Set status to CLOSED and add Exit/PnL when the trade closes."}
            </DialogDescription>
          </DialogHeader>

          {/* Scrollable body */}
          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
            {editingId === null && (
              <div
                ref={dropZoneRef}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                className={cn(
                  "flex min-h-[72px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-neutral-200 bg-neutral-50 px-4 py-3 text-center transition-colors hover:border-neutral-300 hover:bg-neutral-100",
                  analyzing && "cursor-wait opacity-70"
                )}
                onClick={() => !analyzing && fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const files = Array.from(e.target.files ?? [])
                    void analyzeScreenshots(files)
                    e.target.value = ""
                  }}
                />
                {analyzing ? (
                  <span className="text-xs text-neutral-500">Analyzing screenshots…</span>
                ) : (
                  <>
                    <svg className="mb-1 h-5 w-5 text-neutral-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    <p className="text-xs font-medium text-neutral-600">Paste or drop TradingView screenshots</p>
                    <p className="text-[10px] text-neutral-400">Up to 3 images · auto-fills fields</p>
                  </>
                )}
              </div>
            )}

            {pendingScoring && (
              <ScoreBreakdown
                tier={pendingScoring.tier}
                score={pendingScoring.score}
                breakdown={pendingScoring.breakdown}
              />
            )}

            <form
              id="trade-form"
              onSubmit={(e) => {
                e.preventDefault()
                void submit()
              }}
              className="grid grid-cols-1 gap-4 sm:grid-cols-2"
            >
              <Field label="Symbol" id="symbol">
                <Input
                  id="symbol"
                  required
                  value={form.symbol}
                  onChange={(e) => setForm({ ...form, symbol: e.target.value.toUpperCase() })}
                  placeholder="EURUSD"
                />
              </Field>

              <Field label="Side" id="side">
                <Select value={form.side} onValueChange={(v) => setForm({ ...form, side: v as "BUY" | "SELL" })}>
                  <SelectTrigger id="side"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BUY">BUY</SelectItem>
                    <SelectItem value="SELL">SELL</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Entry" id="entry">
                <Input id="entry" type="number" step="any" required value={form.entry}
                  onChange={(e) => setForm({ ...form, entry: e.target.value })} />
              </Field>

              <Field label="Lots" id="lots">
                <Input id="lots" type="number" step="any" required value={form.lots}
                  onChange={(e) => setForm({ ...form, lots: e.target.value })} />
              </Field>

              <Field label="Stop loss" id="stopLoss">
                <Input id="stopLoss" type="number" step="any" required value={form.stopLoss}
                  onChange={(e) => setForm({ ...form, stopLoss: e.target.value })} />
              </Field>

              <Field label="Take profit" id="takeProfit">
                <Input id="takeProfit" type="number" step="any" required value={form.takeProfit}
                  onChange={(e) => setForm({ ...form, takeProfit: e.target.value })} />
              </Field>

              <Field label="Time" id="time" className="sm:col-span-2">
                <Input id="time" type="datetime-local" required value={form.time}
                  onChange={(e) => setForm({ ...form, time: e.target.value })} />
              </Field>

              {editingId !== null && (
                <Field label="Status" id="status">
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as "OPEN" | "CLOSED" })}>
                    <SelectTrigger id="status"><SelectValue /></SelectTrigger>
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
                    <Input id="exitPrice" type="number" step="any" value={form.exitPrice}
                      onChange={(e) => setForm({ ...form, exitPrice: e.target.value })} placeholder="—" />
                  </Field>
                  <Field label="PnL" id="pnl">
                    <Input id="pnl" type="number" step="any" value={form.pnl}
                      onChange={(e) => setForm({ ...form, pnl: e.target.value })} placeholder="—" />
                  </Field>
                </>
              )}

              <div className="sm:col-span-2">
                <Field label="Reason" id="reason">
                  <Textarea id="reason" rows={2} value={form.reason}
                    onChange={(e) => setForm({ ...form, reason: e.target.value })}
                    placeholder="Breakout above 1.0845 resistance" />
                </Field>
              </div>

              <div className="rounded-lg border border-neutral-200 bg-white p-4 sm:col-span-2">
                <TradeImageManager
                  ref={imageManagerRef}
                  tradeId={editingId}
                  initialImages={editingImages}
                  onChange={() => startTransition(() => router.refresh())}
                />
              </div>
            </form>
          </div>

          {/* Sticky footer — always visible */}
          <div className="flex shrink-0 justify-end gap-2 border-t border-neutral-100 px-6 py-4">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              type="submit"
              form="trade-form"
              disabled={submitting}
              className="bg-neutral-900 text-white hover:bg-neutral-800"
            >
              {submitting ? "Saving…" : editingId === null ? "Add trade" : "Save changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function Field({ label, id, children, className }: { label: string; id: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={id} className="text-xs font-medium text-neutral-700">{label}</Label>
      {children}
    </div>
  )
}

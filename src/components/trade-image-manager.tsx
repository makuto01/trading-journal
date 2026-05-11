"use client"

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export interface SerializedTradeImage {
  id: string
  url: string
  caption: string | null
  createdAt: string
}

export interface TradeImageManagerHandle {
  flushStaged: (tradeId: string) => Promise<void>
  hasStaged: () => boolean
}

interface TradeImageManagerProps {
  tradeId: string | null
  initialImages: SerializedTradeImage[]
  onChange?: () => void
}

interface StagedFile {
  id: string
  file: File
  previewUrl: string
}

const ACCEPT = "image/png,image/jpeg,image/webp,image/gif"

function makeStagedId(): string {
  return `staged_${Math.random().toString(36).slice(2)}_${Date.now()}`
}

function imageFilesFromList(list: FileList | File[]): File[] {
  return Array.from(list).filter((f) => f.type.startsWith("image/"))
}

async function uploadFiles(
  tradeId: string,
  files: File[]
): Promise<SerializedTradeImage[]> {
  const form = new FormData()
  for (const file of files) form.append("files", file)
  const res = await fetch(`/api/trades/${tradeId}/images`, {
    method: "POST",
    body: form,
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(body?.error ?? `Upload failed (${res.status})`)
  }
  return body.images as SerializedTradeImage[]
}

export const TradeImageManager = forwardRef<
  TradeImageManagerHandle,
  TradeImageManagerProps
>(function TradeImageManager(
  { tradeId, initialImages, onChange },
  ref
) {
  const [images, setImages] = useState<SerializedTradeImage[]>(initialImages)
  const [staged, setStaged] = useState<StagedFile[]>([])
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setImages(initialImages)
  }, [initialImages])

  // Revoke object URLs on unmount to avoid memory leaks
  useEffect(() => {
    return () => {
      for (const s of staged) URL.revokeObjectURL(s.previewUrl)
    }
  }, [staged])

  // Global paste handler — clipboard images get added
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items
      if (!items) return
      const files: File[] = []
      for (const item of Array.from(items)) {
        if (item.kind === "file" && item.type.startsWith("image/")) {
          const file = item.getAsFile()
          if (file) files.push(file)
        }
      }
      if (files.length === 0) return
      e.preventDefault()
      void handleNewFiles(files)
    }
    document.addEventListener("paste", onPaste)
    return () => document.removeEventListener("paste", onPaste)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tradeId])

  async function handleNewFiles(files: File[]): Promise<void> {
    if (files.length === 0) return

    if (tradeId === null) {
      // Stage locally; will upload after parent saves the trade
      const newStaged: StagedFile[] = files.map((file) => ({
        id: makeStagedId(),
        file,
        previewUrl: URL.createObjectURL(file),
      }))
      setStaged((prev) => [...prev, ...newStaged])
      toast.success(
        `${files.length} screenshot${files.length > 1 ? "s" : ""} staged. They’ll attach when you save the trade.`
      )
      return
    }

    setUploading(true)
    try {
      const uploaded = await uploadFiles(tradeId, files)
      setImages((prev) => [...prev, ...uploaded])
      onChange?.()
      toast.success(
        `${uploaded.length} screenshot${uploaded.length > 1 ? "s" : ""} attached`
      )
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Upload failed"
      toast.error(msg)
    } finally {
      setUploading(false)
    }
  }

  async function removeImage(imageId: string): Promise<void> {
    if (tradeId === null) return
    const prev = images
    setImages((curr) => curr.filter((img) => img.id !== imageId))
    const res = await fetch(`/api/trades/${tradeId}/images/${imageId}`, {
      method: "DELETE",
    })
    if (!res.ok) {
      setImages(prev)
      toast.error("Failed to remove image")
      return
    }
    onChange?.()
  }

  function removeStaged(id: string): void {
    setStaged((prev) => {
      const target = prev.find((s) => s.id === id)
      if (target) URL.revokeObjectURL(target.previewUrl)
      return prev.filter((s) => s.id !== id)
    })
  }

  useImperativeHandle(ref, () => ({
    flushStaged: async (newTradeId: string) => {
      if (staged.length === 0) return
      const files = staged.map((s) => s.file)
      const uploaded = await uploadFiles(newTradeId, files)
      // Cleanup preview URLs
      for (const s of staged) URL.revokeObjectURL(s.previewUrl)
      setStaged([])
      setImages((prev) => [...prev, ...uploaded])
    },
    hasStaged: () => staged.length > 0,
  }))

  const tiles = useMemo(
    () => [
      ...images.map((img) => ({
        kind: "saved" as const,
        id: img.id,
        url: img.url,
      })),
      ...staged.map((s) => ({
        kind: "staged" as const,
        id: s.id,
        url: s.previewUrl,
      })),
    ],
    [images, staged]
  )

  const total = tiles.length

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium uppercase tracking-[0.18em] text-neutral-500">
          Screenshots {total > 0 ? `(${total})` : ""}
        </div>
        <div className="text-[11px] text-neutral-400">
          Paste, drag, or pick files
        </div>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          const files = imageFilesFromList(e.dataTransfer.files)
          void handleNewFiles(files)
        }}
        className={cn(
          "relative rounded-lg border-2 border-dashed px-4 py-5 transition-colors",
          dragging
            ? "border-neutral-900 bg-neutral-50"
            : "border-neutral-200 bg-neutral-50/50 hover:border-neutral-300"
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => {
            if (!e.target.files) return
            const files = imageFilesFromList(e.target.files)
            void handleNewFiles(files)
            e.target.value = ""
          }}
        />

        <div className="flex flex-col items-center gap-2 text-center">
          <p className="text-sm text-neutral-600">
            <span className="font-medium text-neutral-900">
              Ctrl+V
            </span>{" "}
            to paste from clipboard, drag a file here, or
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? "Uploading…" : "Choose files"}
          </Button>
          <p className="text-[11px] text-neutral-400">
            PNG, JPEG, WebP, or GIF · max 5MB each
          </p>
        </div>
      </div>

      {tiles.length > 0 && (
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
          {tiles.map((tile, idx) => (
            <div
              key={tile.id}
              className="group relative aspect-square overflow-hidden rounded-md border border-neutral-200 bg-neutral-100"
            >
              <button
                type="button"
                onClick={() => setLightboxIndex(idx)}
                className="block h-full w-full"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={tile.url}
                  alt=""
                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                />
              </button>

              {tile.kind === "staged" && (
                <div className="absolute left-1 top-1 rounded bg-amber-500 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-white">
                  staged
                </div>
              )}

              <button
                type="button"
                onClick={() =>
                  tile.kind === "saved"
                    ? void removeImage(tile.id)
                    : removeStaged(tile.id)
                }
                className="absolute right-1 top-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100"
                aria-label="Remove image"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {lightboxIndex !== null && tiles[lightboxIndex] && (
        <Lightbox
          tiles={tiles}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onPrev={() =>
            setLightboxIndex((i) =>
              i === null ? null : (i - 1 + tiles.length) % tiles.length
            )
          }
          onNext={() =>
            setLightboxIndex((i) =>
              i === null ? null : (i + 1) % tiles.length
            )
          }
        />
      )}
    </div>
  )
})

interface LightboxProps {
  tiles: { id: string; url: string }[]
  index: number
  onClose: () => void
  onPrev: () => void
  onNext: () => void
}

function Lightbox({ tiles, index, onClose, onPrev, onNext }: LightboxProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
      if (e.key === "ArrowLeft") onPrev()
      if (e.key === "ArrowRight") onNext()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [onClose, onPrev, onNext])

  const tile = tiles[index]
  if (!tile) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-6"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onPrev()
        }}
        className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 px-3 py-2 text-white hover:bg-white/20"
        aria-label="Previous image"
      >
        ‹
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onNext()
        }}
        className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 px-3 py-2 text-white hover:bg-white/20"
        aria-label="Next image"
      >
        ›
      </button>
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 rounded-full bg-white/10 px-3 py-1 text-sm text-white hover:bg-white/20"
        aria-label="Close"
      >
        Close
      </button>
      <div className="absolute bottom-4 text-xs text-white/60">
        {index + 1} / {tiles.length}
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={tile.url}
        alt=""
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] max-w-[90vw] object-contain"
      />
    </div>
  )
}

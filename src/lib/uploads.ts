import { promises as fs } from "fs"
import path from "path"
import { randomUUID } from "crypto"

const UPLOAD_ROOT = path.join(process.cwd(), "public", "uploads", "trades")
const MAX_BYTES = 5 * 1024 * 1024
const ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
])
const EXTENSION_BY_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
}

export class UploadError extends Error {}

export interface SavedImage {
  url: string
  bytes: number
  type: string
}

export async function saveTradeImage(
  tradeId: string,
  file: File
): Promise<SavedImage> {
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new UploadError(
      "Unsupported file type. Use PNG, JPEG, WebP, or GIF."
    )
  }
  if (file.size > MAX_BYTES) {
    throw new UploadError("File too large. Max 5MB per image.")
  }

  const extension = EXTENSION_BY_TYPE[file.type]
  const filename = `${randomUUID()}.${extension}`
  const dir = path.join(UPLOAD_ROOT, tradeId)
  await fs.mkdir(dir, { recursive: true })

  const filepath = path.join(dir, filename)
  const buffer = Buffer.from(await file.arrayBuffer())
  await fs.writeFile(filepath, buffer)

  return {
    url: `/uploads/trades/${tradeId}/${filename}`,
    bytes: file.size,
    type: file.type,
  }
}

export async function deleteTradeImageFile(url: string): Promise<void> {
  if (!url.startsWith("/uploads/trades/")) return
  const relative = url.replace(/^\//, "")
  const fullpath = path.join(process.cwd(), "public", relative)
  await fs.unlink(fullpath).catch(() => {
    // Silently ignore — file already gone is fine
  })
}

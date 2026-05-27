import { put, del } from "@vercel/blob"
import { randomUUID } from "crypto"

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
  const pathname = `trades/${tradeId}/${randomUUID()}.${extension}`

  const blob = await put(pathname, file, {
    access: "public",
    contentType: file.type,
  })

  return {
    url: blob.url,
    bytes: file.size,
    type: file.type,
  }
}

export async function deleteTradeImageFile(url: string): Promise<void> {
  // Skip legacy local URLs (e.g. from a previous SQLite/local setup)
  if (!url.startsWith("https://")) return
  await del(url).catch(() => {
    // Silently ignore — file already gone is fine
  })
}

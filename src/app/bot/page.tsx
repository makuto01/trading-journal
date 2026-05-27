import Link from "next/link"
import { BotLogStream } from "@/components/bot-log-stream"

export const dynamic = "force-dynamic"

export default function BotPage() {
  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-10 lg:px-10">
      <header className="mb-8 flex flex-col gap-1">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-neutral-500">
          Trading Journal
        </p>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-900">
            Bot Activity
          </h1>
          <Link
            href="/"
            className="text-sm text-neutral-500 underline underline-offset-4 hover:text-neutral-900"
          >
            ← All trades
          </Link>
        </div>
        <p className="mt-1 text-sm text-neutral-500">
          Real-time log of every signal the S-Tier bot scanned, accepted, or rejected.
        </p>
      </header>

      <BotLogStream />
    </main>
  )
}

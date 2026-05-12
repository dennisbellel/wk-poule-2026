'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

export default function DeadlineCountdown({
  label, deadline, href = '/predict',
}: {
  label: string
  deadline: string
  href?: string
}) {
  const [now, setNow] = useState<number>(() => Date.now())

  useEffect(() => {
    // Tickt elke 30s — voor zichtbare voortgang zonder onnodige re-renders
    const i = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(i)
  }, [])

  const target = new Date(deadline).getTime()
  const diffMs = target - now

  // Verstreken
  if (diffMs <= 0) {
    return (
      <Link href={href} className="block bg-[#f0ede6] rounded-2xl px-4 py-3 text-sm text-[#888]">
        Vorige deadline verstreken — bekijk volgende →
      </Link>
    )
  }

  const totalMin = Math.floor(diffMs / 60_000)
  const days = Math.floor(totalMin / (60 * 24))
  const hours = Math.floor((totalMin % (60 * 24)) / 60)
  const mins = totalMin % 60

  // Format
  let timeStr: string
  if (days > 0) {
    timeStr = `over ${days} dag${days > 1 ? 'en' : ''} ${hours}u`
  } else if (hours > 0) {
    timeStr = `over ${hours}u ${mins}m`
  } else {
    timeStr = `over ${mins} min`
  }

  const isUrgent = diffMs < 2 * 60 * 60 * 1000  // < 2u
  const isVerySoon = diffMs < 30 * 60 * 1000     // < 30 min

  return (
    <Link
      href={href}
      className={`block rounded-2xl px-4 py-3 transition-colors ${
        isVerySoon
          ? 'bg-red-500 text-white hover:bg-red-600'
          : isUrgent
            ? 'bg-amber-50 border border-amber-200 hover:bg-amber-100'
            : 'bg-white border border-[#e5e1d8] hover:bg-[#fafaf9]'
      }`}
    >
      {/* Mobile: gestapeld (vraag boven, countdown onder). Desktop: naast elkaar. */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2 lg:gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-base flex-shrink-0">
            {isVerySoon ? '🔥' : isUrgent ? '⏰' : '🗓️'}
          </span>
          <div className="min-w-0">
            <p className={`text-[11px] uppercase tracking-wide font-semibold ${
              isVerySoon ? 'text-white/80' : isUrgent ? 'text-amber-700' : 'text-[#aaa]'
            }`}>
              Volgende deadline
            </p>
            <p className={`text-sm font-semibold truncate ${isVerySoon ? 'text-white' : 'text-gray-900'}`}>
              {label}
            </p>
          </div>
        </div>
        <span className={`heading text-lg font-extrabold flex-shrink-0 pl-7 lg:pl-0 ${
          isVerySoon ? 'text-white' : isUrgent ? 'text-amber-700' : 'text-[#1a5c38]'
        }`}>
          {timeStr}
        </span>
      </div>
    </Link>
  )
}

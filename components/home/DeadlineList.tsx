'use client'
import { useState } from 'react'
import Link from 'next/link'

export type DeadlineListItem = {
  id: string
  label: string
  sub: string
  href: string
  urgent: boolean
  deadlineFormatted: string   // bv. "12 jun, 18:00"
  deadlineRelative: string    // bv. "over 3 uur"
}

const VISIBLE = 4

// Compacte deadline-lijst: hele regel klikbaar, standaard 4 zichtbaar,
// de rest uitklapbaar — houdt de homepagina kort
export default function DeadlineList({ items }: { items: DeadlineListItem[] }) {
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? items : items.slice(0, VISIBLE)
  const hidden = items.length - VISIBLE

  return (
    <div>
      {visible.map(item => (
        <Link
          key={item.id}
          href={item.href}
          className="flex items-center gap-2.5 px-4 py-2.5 border-b border-[#f6f4ef] last:border-0 hover:bg-[#fafaf9] transition-colors"
        >
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${item.urgent ? 'bg-red-400' : 'bg-amber-400'}`} />
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-gray-900 truncate">{item.label}</p>
            <p className="text-[10px] text-[#aaa] truncate mt-0.5">{item.sub}</p>
          </div>
          <div className="text-right flex-shrink-0">
            <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-full ${
              item.urgent ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
            }`}>
              {item.deadlineFormatted}
            </span>
            <p className="text-[10px] text-[#ccc] mt-0.5">{item.deadlineRelative}</p>
          </div>
          <span className="text-[#1a5c38] text-sm flex-shrink-0">→</span>
        </Link>
      ))}
      {hidden > 0 && (
        <button
          onClick={() => setExpanded(e => !e)}
          className="w-full text-center py-2.5 text-xs font-semibold text-[#1a5c38] bg-[#f6f4ef] border-0 border-t border-[#e5e1d8] cursor-pointer hover:bg-[#eaf4ef] transition-colors"
        >
          {expanded ? '▴ Minder tonen' : `▾ Nog ${hidden} ${hidden === 1 ? 'deadline' : 'deadlines'} tonen`}
        </button>
      )}
    </div>
  )
}

'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const EMOJIS = ['🔥','😭','😤','🎉','🤯','😂','👏','💀']

export default function FeedReactions({
  matchId, reactions, currentUserId,
}: {
  matchId: string
  reactions: Array<{ id: string; user_id: string; match_id: string; emoji: string }>
  currentUserId: string
}) {
  const supabase = createClient()
  const [localReactions, setLocalReactions] = useState(reactions.filter(r => r.match_id === matchId))
  const [showAll, setShowAll] = useState(false)

  const counts = EMOJIS.reduce((acc, e) => {
    acc[e] = localReactions.filter(r => r.emoji === e).length
    return acc
  }, {} as Record<string, number>)

  const myReactions = new Set(localReactions.filter(r => r.user_id === currentUserId).map(r => r.emoji))

  async function toggleReaction(emoji: string) {
    if (myReactions.has(emoji)) {
      setLocalReactions(prev => prev.filter(r => !(r.user_id === currentUserId && r.emoji === emoji)))
      await supabase.from('match_reactions').delete().eq('user_id', currentUserId).eq('match_id', matchId).eq('emoji', emoji)
    } else {
      const newR = { id: crypto.randomUUID(), user_id: currentUserId, match_id: matchId, emoji }
      setLocalReactions(prev => [...prev, newR])
      await supabase.from('match_reactions').insert({ user_id: currentUserId, match_id: matchId, emoji })
    }
  }

  const activeEmojis = EMOJIS.filter(e => counts[e] > 0 || myReactions.has(e))
  const inactiveEmojis = EMOJIS.filter(e => counts[e] === 0 && !myReactions.has(e))

  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {(showAll ? EMOJIS : activeEmojis).map(emoji => (
        <button key={emoji} onClick={() => toggleReaction(emoji)}
          className={`flex items-center gap-1 px-2 py-1 rounded-full text-sm border transition-all cursor-pointer ${
            myReactions.has(emoji)
              ? 'bg-[#eaf4ef] border-[#1a5c38] text-[#1a5c38]'
              : 'bg-white border-[#e5e1d8] text-gray-600 hover:border-[#1a5c38]'
          }`}>
          <span>{emoji}</span>
          {counts[emoji] > 0 && <span className="text-xs font-semibold">{counts[emoji]}</span>}
        </button>
      ))}
      {!showAll && inactiveEmojis.length > 0 && (
        <button onClick={() => setShowAll(true)}
          className="flex items-center gap-1 px-2.5 py-1 rounded-full text-sm border border-dashed border-[#e5e1d8] text-[#aaa] cursor-pointer hover:border-[#1a5c38] bg-white">
          <span>+</span>
        </button>
      )}
    </div>
  )
}

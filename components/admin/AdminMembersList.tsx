'use client'
import { useState } from 'react'

type Member = {
  id: string
  display_name: string
  email: string
  is_admin: boolean
  created_at: string
}

export default function AdminMembersList({ initialMembers }: { initialMembers: Member[] }) {
  const [members, setMembers] = useState<Member[]>(initialMembers)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function startEdit(m: Member) {
    setEditingId(m.id)
    setDraft(m.display_name)
    setError(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setDraft('')
    setError(null)
  }

  async function saveEdit(memberId: string) {
    const name = draft.trim()
    if (!name) { setError('Naam mag niet leeg zijn'); return }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/update-member-name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: memberId, display_name: name }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || 'Opslaan mislukt')
        return
      }
      setMembers(prev => prev.map(m => m.id === memberId ? { ...m, display_name: name } : m))
      setEditingId(null)
      setDraft('')
    } catch {
      setError('Netwerkfout')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-[#e5e1d8] overflow-hidden">
      <div className="px-5 py-4 border-b border-[#f6f4ef] flex justify-between items-center">
        <h2 className="text-sm font-semibold text-gray-800">
          Actieve deelnemers ({members.length})
        </h2>
      </div>
      {members.map(p => {
        const isEditing = editingId === p.id
        return (
          <div key={p.id} className="flex items-center gap-3 px-5 py-3.5 border-b border-[#f6f4ef] last:border-0">
            <div className="w-9 h-9 rounded-full bg-[#1a5c38] flex items-center justify-center flex-shrink-0">
              <span className="heading text-sm font-bold text-white">{p.display_name[0] ?? '?'}</span>
            </div>
            <div className="flex-1 min-w-0">
              {isEditing ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    maxLength={30}
                    autoFocus
                    onKeyDown={e => {
                      if (e.key === 'Enter') saveEdit(p.id)
                      if (e.key === 'Escape') cancelEdit()
                    }}
                    className="flex-1 min-w-0 border border-[#1a5c38] rounded-lg px-2.5 py-1 text-sm outline-none bg-white"
                  />
                  <button
                    onClick={() => saveEdit(p.id)}
                    disabled={saving}
                    className="px-2.5 py-1 text-xs font-semibold bg-[#1a5c38] text-white rounded-lg border-0 cursor-pointer disabled:opacity-50"
                  >
                    {saving ? '…' : 'OK'}
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="px-2.5 py-1 text-xs font-semibold bg-white border border-[#e5e1d8] text-gray-500 rounded-lg cursor-pointer"
                  >
                    Annuleer
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-900 truncate">{p.display_name}</span>
                    {p.is_admin && (
                      <span className="tag bg-amber-100 text-amber-700 flex-shrink-0">admin</span>
                    )}
                  </div>
                  <span className="text-xs text-[#aaa] truncate block">{p.email}</span>
                </>
              )}
            </div>
            {!isEditing && (
              <button
                onClick={() => startEdit(p)}
                title="Naam wijzigen"
                className="px-2.5 py-1 text-xs font-semibold text-[#1a5c38] bg-[#eaf4ef] rounded-lg border border-[#c8e6d4] hover:bg-[#d4f0e0] cursor-pointer flex-shrink-0"
              >
                ✏️
              </button>
            )}
            <span className="text-xs text-[#aaa] flex-shrink-0 hidden sm:inline">
              {new Date(p.created_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
            </span>
          </div>
        )
      })}
      {editingId && error && (
        <div className="px-5 py-2.5 bg-red-50 text-xs text-red-700 border-t border-red-100">
          {error}
        </div>
      )}
    </div>
  )
}

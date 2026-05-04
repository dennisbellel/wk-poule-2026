import { createClient } from '@/lib/supabase/server'
import AdminInviteForm from '@/components/admin/AdminInviteForm'

export default async function AdminMembersPage() {
  const supabase = await createClient()

  const [{ data: profiles }, { data: invites }] = await Promise.all([
    supabase.from('profiles').select('*').order('created_at', { ascending: true }),
    supabase.from('invited_emails').select('*').order('invited_at', { ascending: false }),
  ])

  const pendingInvites = invites?.filter(i => !i.registered_at) || []

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="heading text-2xl font-extrabold text-gray-900">Deelnemers</h1>
        <AdminInviteForm />
      </div>

      {/* Active members */}
      <div className="bg-white rounded-2xl border border-[#e5e1d8] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#f6f4ef] flex justify-between items-center">
          <h2 className="text-sm font-semibold text-gray-800">
            Actieve deelnemers ({profiles?.length || 0})
          </h2>
        </div>
        {profiles?.map(p => (
          <div key={p.id} className="flex items-center gap-3 px-5 py-3.5 border-b border-[#f6f4ef] last:border-0">
            <div className="w-9 h-9 rounded-full bg-[#1a5c38] flex items-center justify-center flex-shrink-0">
              <span className="heading text-sm font-bold text-white">{p.display_name[0]}</span>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-900">{p.display_name}</span>
                {p.is_admin && (
                  <span className="tag bg-amber-100 text-amber-700">admin</span>
                )}
              </div>
              <span className="text-xs text-[#aaa]">{p.email}</span>
            </div>
            <span className="text-xs text-[#aaa]">
              {new Date(p.created_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
            </span>
          </div>
        ))}
      </div>

      {/* Pending invites */}
      {pendingInvites.length > 0 && (
        <div className="bg-white rounded-2xl border border-[#e5e1d8] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#f6f4ef]">
            <h2 className="text-sm font-semibold text-gray-800">
              Uitnodigingen verzonden ({pendingInvites.length})
            </h2>
          </div>
          {pendingInvites.map(inv => (
            <div key={inv.email} className="flex items-center gap-3 px-5 py-3.5 border-b border-[#f6f4ef] last:border-0">
              <div className="w-9 h-9 rounded-full bg-[#e5e1d8] flex items-center justify-center flex-shrink-0">
                <span className="text-lg">?</span>
              </div>
              <div className="flex-1">
                <span className="text-sm text-gray-600">{inv.email}</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="tag bg-[#f0ede6] text-[#888]">uitgenodigd</span>
                  <span className="text-[11px] text-[#aaa]">
                    {new Date(inv.invited_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

import { createClient } from '@/lib/supabase/server'
import AdminInviteForm from '@/components/admin/AdminInviteForm'
import AdminMembersList from '@/components/admin/AdminMembersList'
import ResendInviteButton from '@/components/admin/ResendInviteButton'

export const dynamic = 'force-dynamic'

export default async function AdminMembersPage() {
  const supabase = await createClient()

  const [{ data: profiles }, { data: invites }] = await Promise.all([
    supabase.from('profiles').select('*').order('created_at', { ascending: true }),
    supabase.from('invited_emails').select('*').order('invited_at', { ascending: false }),
  ])

  // Iemand is echt "geactiveerd" als ze een profiel hebben mét een wachtwoord
  // (password_set = true). Daar vertrouwen we op, niet op invited_emails.registered_at
  // (die wordt door een DB-trigger gezet die in productie soms niet draait).
  type ProfileWithPassword = { email: string; password_set?: boolean }
  const activatedEmails = new Set(
    (profiles ?? []).filter((p): p is typeof p & { email: string } => (p as ProfileWithPassword).password_set === true).map(p => p.email)
  )
  const pendingInvites = (invites ?? []).filter(i => !activatedEmails.has(i.email))

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="heading text-2xl font-extrabold text-gray-900">Deelnemers</h1>
        <AdminInviteForm />
      </div>

      <AdminMembersList initialMembers={(profiles ?? []).filter(p => (p as { password_set?: boolean }).password_set === true)} />

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
              <div className="flex-1 min-w-0">
                <span className="text-sm text-gray-600 truncate block">{inv.email}</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="tag bg-[#f0ede6] text-[#888]">uitgenodigd</span>
                  <span className="text-[11px] text-[#aaa]">
                    {new Date(inv.invited_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
              </div>
              <ResendInviteButton email={inv.email} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

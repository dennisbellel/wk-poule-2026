import { createClient } from '@/lib/supabase/server'
import AdminSyncButton from '@/components/admin/AdminSyncButton'

export default async function AdminPage() {
  const supabase = await createClient()

  const [
    { count: userCount },
    { count: matchCount },
    { count: predCount },
    { data: syncLog },
    { data: recentActivity },
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('matches').select('*', { count: 'exact', head: true }),
    supabase.from('match_predictions').select('*', { count: 'exact', head: true }),
    supabase.from('sync_log').select('*').order('synced_at', { ascending: false }).limit(5),
    supabase.from('activity_feed').select('*').order('created_at', { ascending: false }).limit(10),
  ])

  const lastSync = syncLog?.[0]

  return (
    <div className="max-w-4xl space-y-6">
      <h1 className="heading text-2xl font-extrabold text-gray-900">Overzicht</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Deelnemers', value: userCount || 0, icon: '👥' },
          { label: 'Wedstrijden', value: matchCount || 0, icon: '⚽' },
          { label: 'Voorspellingen', value: predCount || 0, icon: '✏️' },
          { label: 'Laatste sync', value: lastSync ? new Date(lastSync.synced_at).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }) : '—', icon: '🔄' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl border border-[#e5e1d8] p-4">
            <span className="text-2xl block mb-2">{s.icon}</span>
            <span className="heading text-2xl font-extrabold text-gray-900 block">{s.value}</span>
            <span className="text-sm text-[#aaa]">{s.label}</span>
          </div>
        ))}
      </div>

      {/* API Sync */}
      <div className="bg-white rounded-2xl border border-[#e5e1d8] p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-800">football-data.org API</h2>
            <p className="text-xs text-[#aaa] mt-0.5">
              {lastSync?.status === 'success'
                ? `Laatste sync: ${new Date(lastSync.synced_at).toLocaleString('nl-NL')} · ${lastSync.matches_updated} wedstrijden bijgewerkt`
                : 'Nog niet gesynchroniseerd'}
            </p>
          </div>
          <div className={`tag ${lastSync?.status === 'success' ? 'bg-green-100 text-green-700' : 'bg-[#f0ede6] text-[#888]'}`}>
            {lastSync?.status === 'success' ? '✓ Verbonden' : 'Onbekend'}
          </div>
        </div>
        <AdminSyncButton />
        {syncLog && syncLog.length > 0 && (
          <div className="mt-4 space-y-1">
            <p className="text-xs font-semibold text-[#aaa] uppercase tracking-wide mb-2">Sync geschiedenis</p>
            {syncLog.map(log => (
              <div key={log.id} className="flex justify-between text-xs text-[#888] py-1 border-b border-[#f6f4ef]">
                <span>{new Date(log.synced_at).toLocaleString('nl-NL')}</span>
                <span className={log.status === 'success' ? 'text-green-600' : 'text-red-500'}>
                  {log.status === 'success' ? `✓ ${log.matches_updated} bijgewerkt` : `✗ ${log.error}`}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent activity */}
      <div className="bg-white rounded-2xl border border-[#e5e1d8] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#f6f4ef]">
          <h2 className="text-sm font-semibold text-gray-800">Recente activiteit</h2>
        </div>
        {recentActivity?.length ? recentActivity.map(item => (
          <div key={item.id} className="flex items-center gap-3 px-5 py-3 border-b border-[#f6f4ef] last:border-0">
            <span className="text-lg">{item.emoji || '📌'}</span>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-800">{item.title}</p>
              {item.body && <p className="text-xs text-[#aaa]">{item.body}</p>}
            </div>
            <span className="text-xs text-[#ccc] flex-shrink-0">
              {new Date(item.created_at).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        )) : (
          <div className="px-5 py-8 text-center text-sm text-[#aaa]">Nog geen activiteit</div>
        )}
      </div>
    </div>
  )
}

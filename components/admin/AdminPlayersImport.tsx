'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

type ImportResult = {
  ok?: boolean
  imported?: number
  deleted?: number
  skipped?: { row: number; reason: string }[]
  error?: string
}

export default function AdminPlayersImport() {
  const router = useRouter()
  const [csv, setCsv] = useState('')
  const [replaceExisting, setReplaceExisting] = useState(true)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)

  function onFileSelected(file: File | undefined) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = e => setCsv(String(e.target?.result ?? ''))
    reader.readAsText(file, 'UTF-8')
  }

  async function submit() {
    if (!csv.trim()) return
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/admin/players-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv, replaceExisting }),
      })
      const json = await res.json() as ImportResult
      setResult(json)
      if (res.ok) router.refresh()
    } catch {
      setResult({ error: 'Netwerkfout' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-[#e5e1d8] p-5 space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-gray-800 mb-1">Spelers importeren</h2>
        <p className="text-xs text-[#888] leading-relaxed">
          Upload een CSV met de kolommen <code className="bg-[#f6f4ef] px-1 rounded">name,team_code,position</code>.
          Eerste regel = header. <code className="bg-[#f6f4ef] px-1 rounded">team_code</code> is de 3-letter
          landcode (bv. NED, BRA, ARG). <code className="bg-[#f6f4ef] px-1 rounded">position</code> is GK, DEF,
          MID of FWD.
        </p>
        <details className="mt-2 text-xs">
          <summary className="cursor-pointer text-[#1a5c38] font-semibold">Voorbeeld bestand</summary>
          <pre className="mt-1.5 bg-[#f6f4ef] rounded-lg p-3 text-[11px] overflow-x-auto">
{`name,team_code,position
Memphis Depay,NED,FWD
Virgil van Dijk,NED,DEF
Frenkie de Jong,NED,MID
Justin Bijlow,NED,GK`}
          </pre>
        </details>
      </div>

      <div>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={e => onFileSelected(e.target.files?.[0])}
          className="block w-full text-sm text-gray-700 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#eaf4ef] file:text-[#1a5c38] file:cursor-pointer cursor-pointer"
        />
        {csv && (
          <p className="text-[11px] text-[#888] mt-1.5">{csv.split('\n').length - 1} regels geladen (incl. header)</p>
        )}
      </div>

      <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
        <input
          type="checkbox"
          checked={replaceExisting}
          onChange={e => setReplaceExisting(e.target.checked)}
          className="w-4 h-4 cursor-pointer"
        />
        Vervang bestaande spelers van de geïmporteerde landen
        <span className="text-[#aaa]">(aanrader; voorkomt dubbele namen)</span>
      </label>

      <button
        onClick={submit}
        disabled={loading || !csv.trim()}
        className="px-4 py-2.5 bg-[#1a5c38] text-white text-sm font-semibold rounded-xl border-0 cursor-pointer hover:bg-[#164d2f] disabled:opacity-50"
      >
        {loading ? 'Importeren...' : '📥 Importeer spelers'}
      </button>

      {result && (
        <div className={`rounded-xl px-4 py-3 text-sm ${
          result.ok
            ? 'bg-[#eaf4ef] text-[#1a5c38] border border-[#c8e6d4]'
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {result.ok ? (
            <>
              <p className="font-semibold">✓ Import gelukt</p>
              <p className="text-xs mt-1">
                {result.imported} speler{result.imported === 1 ? '' : 's'} toegevoegd
                {(result.deleted ?? 0) > 0 && ` · ${result.deleted} bestaande verwijderd`}
                {(result.skipped?.length ?? 0) > 0 && ` · ${result.skipped!.length} overgeslagen`}
              </p>
              {result.skipped && result.skipped.length > 0 && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs font-semibold">Overgeslagen rijen tonen</summary>
                  <ul className="mt-1 text-[11px] space-y-0.5">
                    {result.skipped.slice(0, 20).map((s, i) => (
                      <li key={i}>Rij {s.row}: {s.reason}</li>
                    ))}
                    {result.skipped.length > 20 && <li>... en nog {result.skipped.length - 20}</li>}
                  </ul>
                </details>
              )}
            </>
          ) : (
            <>
              <p className="font-semibold">✗ Import mislukt</p>
              <p className="text-xs mt-1">{result.error}</p>
              {result.skipped && result.skipped.length > 0 && (
                <ul className="mt-2 text-[11px] space-y-0.5">
                  {result.skipped.slice(0, 10).map((s, i) => (
                    <li key={i}>Rij {s.row}: {s.reason}</li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

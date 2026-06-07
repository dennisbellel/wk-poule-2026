import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

const VALID_POSITIONS = new Set(['GK', 'DEF', 'MID', 'FWD'])

// Minimale CSV-parser: ondersteunt veld-tussen-quotes "Memphis, Jr.", en
// dubbele quotes binnen quotes ("O""Brien"). Geen externe library nodig.
function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  let i = 0
  let field = ''
  let row: string[] = []
  let inQuotes = false
  while (i < text.length) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue }
        inQuotes = false; i++; continue
      }
      field += c; i++; continue
    }
    if (c === '"') { inQuotes = true; i++; continue }
    if (c === ',') { row.push(field); field = ''; i++; continue }
    if (c === '\r') { i++; continue }
    if (c === '\n') { row.push(field); field = ''; rows.push(row); row = []; i++; continue }
    field += c; i++
  }
  // Laatste cel/rij
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row) }
  return rows.filter(r => r.length > 0 && !(r.length === 1 && r[0].trim() === ''))
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: callerProfile } = await supabase
    .from('profiles').select('is_admin').eq('id', user.id).single()
  if (!callerProfile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { csv, replaceExisting } = await request.json() as { csv: string; replaceExisting: boolean }
  if (!csv?.trim()) return NextResponse.json({ error: 'CSV is leeg' }, { status: 400 })

  const rows = parseCSV(csv)
  if (rows.length < 2) {
    return NextResponse.json({ error: 'Geen dataregels gevonden (verwacht header + minstens 1 rij)' }, { status: 400 })
  }

  // Header inspectie — vind kolomvolgorde
  const header = rows[0].map(h => h.trim().toLowerCase())
  const idxName = header.findIndex(h => h === 'name' || h === 'naam')
  const idxTeam = header.findIndex(h => h === 'team_code' || h === 'team' || h === 'land' || h === 'country')
  const idxPos = header.findIndex(h => h === 'position' || h === 'positie' || h === 'pos')
  if (idxName < 0 || idxTeam < 0 || idxPos < 0) {
    return NextResponse.json({
      error: 'Verwachte kolommen: name, team_code, position (mag ook naam/team/positie)',
      header_found: header,
    }, { status: 400 })
  }

  const admin = await createAdminClient()

  // Geldige team-codes ophalen
  const { data: teams } = await admin.from('teams').select('id')
  const validTeams = new Set((teams ?? []).map(t => t.id))

  // Parse + valideer alle dataregels
  type ImportRow = { name: string; team_id: string; position: string }
  const accepted: ImportRow[] = []
  const skipped: { row: number; reason: string }[] = []

  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r]
    const name = (cells[idxName] || '').trim()
    const team = (cells[idxTeam] || '').trim().toUpperCase()
    const pos = (cells[idxPos] || '').trim().toUpperCase()
    if (!name) { skipped.push({ row: r + 1, reason: 'naam ontbreekt' }); continue }
    if (!validTeams.has(team)) { skipped.push({ row: r + 1, reason: `team_code "${team}" niet bekend` }); continue }
    if (!VALID_POSITIONS.has(pos)) { skipped.push({ row: r + 1, reason: `position "${pos}" moet GK/DEF/MID/FWD zijn` }); continue }
    accepted.push({ name, team_id: team, position: pos })
  }

  if (accepted.length === 0) {
    return NextResponse.json({ error: 'Geen geldige rijen om te importeren', skipped }, { status: 400 })
  }

  // Optioneel: verwijder bestaande spelers voor de geraakte teams (= 'replace mode')
  let deleted = 0
  if (replaceExisting) {
    const teamsInImport = Array.from(new Set(accepted.map(a => a.team_id)))
    const { count } = await admin.from('players').delete({ count: 'exact' }).in('team_id', teamsInImport)
    deleted = count ?? 0
  }

  // Bulk insert in batches van 500 — voorkomt PostgREST max-rows limiet (default 1000)
  // en houdt request-payloads beheersbaar
  const BATCH_SIZE = 500
  let totalInserted = 0
  const insertErrors: string[] = []
  for (let i = 0; i < accepted.length; i += BATCH_SIZE) {
    const batch = accepted.slice(i, i + BATCH_SIZE)
    const { error: insertErr, count } = await admin
      .from('players')
      .insert(batch, { count: 'exact' })
    if (insertErr) {
      insertErrors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${insertErr.message}`)
    } else {
      totalInserted += count ?? batch.length
    }
  }

  if (insertErrors.length > 0 && totalInserted === 0) {
    return NextResponse.json({ error: insertErrors.join('; '), skipped }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    imported: totalInserted,
    skipped,
    deleted,
    batch_errors: insertErrors.length > 0 ? insertErrors : undefined,
  })
}

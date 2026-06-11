// PostgREST geeft standaard maximaal 1000 rijen per request terug. Alles
// daarboven wordt stilletjes afgekapt — geen foutmelding. Deze helper haalt
// álle rijen op in pagina's van 500 (zelfde patroon als /app/admin/players).
//
// Gebruik (de query MOET een .order() hebben voor stabiele paginering):
//   const rows = await fetchAllRows<MatchPrediction>((from, to) =>
//     supabase.from('match_predictions').select('*').order('id').range(from, to)
//   )
export async function fetchAllRows<T>(
  buildQuery: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const PAGE = 500
  const all: T[] = []
  let from = 0
  while (true) {
    const { data, error } = await buildQuery(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    if (!data || data.length === 0) break
    all.push(...data)
    if (data.length < PAGE) break
    from += PAGE
    if (from > 100_000) break // noodrem
  }
  return all
}

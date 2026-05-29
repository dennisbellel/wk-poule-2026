import Link from 'next/link'

export const dynamic = 'force-dynamic'

type PageProps = { searchParams: Promise<Record<string, string | undefined>> }

// Tussenpagina tegen e-mail link-scanners. Deze pagina verifieert het token NIET zelf —
// ze toont alleen een knop. Pas bij een echte klik gaat de gebruiker naar /auth/callback
// dat het token uitwisselt. Zo kan een automatische scanner het eenmalige token niet
// vooraf "opbranden".
export default async function ConfirmPage({ searchParams }: PageProps) {
  const params = await searchParams
  const tokenHash = params.token_hash ?? ''
  const type = params.type ?? 'invite'
  const next = params.next ?? '/auth/register'

  const hasToken = tokenHash.length > 0
  const callbackUrl = `/auth/callback?token_hash=${encodeURIComponent(tokenHash)}&type=${encodeURIComponent(type)}&next=${encodeURIComponent(next)}`

  const isRecovery = type === 'recovery'

  return (
    <div className="min-h-screen bg-[#f6f4ef] flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="heading text-3xl font-extrabold text-[#1a5c38] mb-1">Dé WK Poule</h1>
          <p className="text-sm text-[#aaa]">FIFA World Cup 2026</p>
        </div>

        <div className="bg-white rounded-2xl border border-[#e5e1d8] p-6 text-center">
          {hasToken ? (
            <>
              <div className="text-3xl mb-3">{isRecovery ? '🔐' : '🎉'}</div>
              <h2 className="heading text-xl font-bold text-gray-900 mb-2">
                {isRecovery ? 'Wachtwoord herstellen' : 'Nog één klik'}
              </h2>
              <p className="text-sm text-[#888] mb-5">
                {isRecovery
                  ? 'Klik hieronder om een nieuw wachtwoord in te stellen.'
                  : 'Klik hieronder om je account te activeren en mee te doen aan de poule.'}
              </p>
              <Link
                href={callbackUrl}
                className="block w-full btn-primary py-3.5 text-sm"
              >
                {isRecovery ? 'Wachtwoord herstellen →' : 'Account activeren →'}
              </Link>
            </>
          ) : (
            <>
              <div className="text-3xl mb-3">⚠️</div>
              <h2 className="heading text-xl font-bold text-gray-900 mb-2">Link onvolledig</h2>
              <p className="text-sm text-[#888] mb-5">
                Deze link mist gegevens. Vraag de organisator om een nieuwe uitnodiging.
              </p>
              <Link href="/auth/login" className="block w-full btn-secondary py-3.5 text-sm">
                Naar inloggen
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

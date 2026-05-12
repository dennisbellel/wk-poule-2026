'use client'
import { useTour } from './TourProvider'
import { TOUR_STEPS } from './tour-steps'

export default function TourBanner() {
  const { isActive, step, totalSteps, next, previous, close } = useTour()
  if (!isActive) return null

  const current = TOUR_STEPS[step]
  if (!current) return null

  const isFirst = step === 0
  const isLast = step === totalSteps - 1

  return (
    <div className="sticky top-0 z-40 bg-[#1a5c38] text-white shadow-lg border-b-2 border-white/20">
      <div className="max-w-3xl mx-auto px-4 py-3 lg:px-6 lg:py-4">
        {/* Bovenste rij: stap-teller + sluit */}
        <div className="flex items-center justify-between gap-3 mb-2">
          <span className="text-[11px] font-bold text-white/70 uppercase tracking-wide">
            Stap {step + 1} van {totalSteps}
          </span>
          <button
            onClick={close}
            aria-label="Sluit rondleiding"
            className="text-white/60 hover:text-white text-base w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/10 border-0 bg-transparent cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Voortgangsbalkje */}
        <div className="flex gap-0.5 mb-3">
          {TOUR_STEPS.map((_, i) => (
            <div key={i} className={`h-0.5 flex-1 rounded-full transition-colors ${i <= step ? 'bg-white' : 'bg-white/25'}`} />
          ))}
        </div>

        {/* Inhoud */}
        <h2 className="heading text-base lg:text-lg font-extrabold mb-1 leading-tight">{current.title}</h2>
        <p className="text-sm text-white/90 mb-3 leading-snug">{current.body}</p>

        {/* Acties */}
        <div className="flex items-center gap-2">
          {!isFirst ? (
            <button
              onClick={previous}
              className="text-xs font-semibold text-white/80 hover:text-white border-0 bg-transparent cursor-pointer px-2 py-1"
            >
              ← Vorige
            </button>
          ) : (
            <button
              onClick={close}
              className="text-xs font-semibold text-white/80 hover:text-white border-0 bg-transparent cursor-pointer px-2 py-1"
            >
              Sla over
            </button>
          )}
          <div className="flex-1" />
          <button
            onClick={next}
            className="bg-white text-[#1a5c38] text-sm font-bold py-2 px-4 rounded-xl border-0 cursor-pointer hover:bg-[#eaf4ef] transition-colors"
          >
            {isLast ? '✓ Klaar' : 'Volgende →'}
          </button>
        </div>
      </div>
    </div>
  )
}

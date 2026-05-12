'use client'
import { useState } from 'react'
import { TOUR_SLIDES } from './tour-steps'

export default function OnboardingTour({
  onClose, onFinish,
}: {
  onClose: () => void   // Sla over of kruisje
  onFinish: () => void  // 'Klaar' op laatste slide
}) {
  const [step, setStep] = useState(0)
  const current = TOUR_SLIDES[step]
  const isLast = step === TOUR_SLIDES.length - 1
  const isFirst = step === 0

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-[#1a5c38] px-6 py-5 relative flex-shrink-0">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 text-white/70 hover:text-white text-lg w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors cursor-pointer border-0 bg-transparent"
            aria-label="Sluiten"
          >
            ✕
          </button>
          <div className="text-3xl mb-1">{current.emoji}</div>
          <h2 className="heading text-xl font-extrabold text-white pr-6">{current.title}</h2>
          {/* Klikbare voortgangsdots */}
          <div className="flex gap-1 mt-3">
            {TOUR_SLIDES.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                aria-label={`Naar slide ${i + 1}`}
                className={`h-1 flex-1 rounded-full transition-colors cursor-pointer border-0 ${i <= step ? 'bg-white' : 'bg-white/25 hover:bg-white/50'}`}
              />
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 text-sm text-gray-700 space-y-3 overflow-y-auto">
          {current.body.map((p, i) => (
            <p key={i} className="leading-snug">{p}</p>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#f6f4ef] flex items-center justify-between gap-3 flex-shrink-0">
          {!isFirst ? (
            <button
              onClick={() => setStep(s => s - 1)}
              className="text-sm font-semibold text-[#888] hover:text-gray-900 cursor-pointer border-0 bg-transparent"
            >
              ← Vorige
            </button>
          ) : (
            <button
              onClick={onClose}
              className="text-sm font-medium text-[#aaa] hover:text-gray-700 cursor-pointer border-0 bg-transparent"
            >
              Sla over
            </button>
          )}

          <span className="text-xs text-[#aaa]">{step + 1} / {TOUR_SLIDES.length}</span>

          {isLast ? (
            <button
              onClick={onFinish}
              className="btn-primary text-sm py-2 px-4"
            >
              ✓ Klaar
            </button>
          ) : (
            <button
              onClick={() => setStep(s => s + 1)}
              className="btn-primary text-sm py-2 px-4"
            >
              Volgende →
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
